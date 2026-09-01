import assert from 'node:assert/strict';
import { PaperEngine } from '../src/paper-engine.mjs';

function makeStore(userId='v55-user'){
  let saveCalls=0;

  return {
    state:{
      users:{
        [userId]:{
          id:userId,
          killSwitch:false,
          settings:{}
        }
      },
      paperPositions:{},
      paperTrades:{},
      paperProposals:{},
      paperProcessed:{},
      paperMetrics:{entries:0,exits:0,errors:0}
    },

    save(){
      saveCalls++;
    },

    get saveCalls(){
      return saveCalls;
    },

    resetSaveCalls(){
      saveCalls=0;
    }
  };
}

function settings(overrides={}){
  return {
    operatingMode:'automate',
    tradingEnvironment:'paper',
    positionSize:0.1,
    maxPositionSize:0.5,
    maxOpenPositions:4,
    maxDailyEntries:10,
    dailySpendLimit:0,
    tradingCapital:0,
    dailyLossLimit:0,
    decisionFreshnessSec:60,
    hardStopPct:25,
    trailingStopPct:15,
    tp1Pct:100,
    tp1SellPct:50,
    tp2Pct:200,
    tp2SellPct:25,
    maxHoldMinutes:1440,
    exitOnWeakBuyPressure:false,
    ...overrides
  };
}

function token(now,mint,price,buyPressure=2){
  return {
    mint,
    name:'V55',
    symbol:'V55',
    priceSol:price,
    holderFresh:true,
    updatedAt:now,
    lastPriceAt:now,
    buyPressure
  };
}

function decision(now){
  return {
    state:'BUY READY',
    score:90,
    confidence:90,
    updatedAt:now
  };
}

// 1. Ordinary price ticks update in memory immediately but cannot request
//    full-state durability more than once per checkpoint interval.
{
  let now=1_800_000_000_000;
  const mint='V55Checkpoint111111111111111111111111111';
  const store=makeStore();

  const paper=
    new PaperEngine(
      store,
      {
        clock:()=>now,
        positionCheckpointMs:1000
      }
    );

  const opened=
    paper.openPosition(
      'v55-user',
      token(now,mint,0.001),
      decision(now),
      settings()
    );

  assert.equal(opened.ok,true);
  store.resetSaveCalls();

  const position=opened.position;

  for(let i=1;i<=9;i++){
    now+=100;
    paper.onTokenUpdate(
      mint,
      token(now,mint,0.001+i*0.000001)
    );
  }

  assert.equal(
    store.saveCalls,
    0,
    'sub-checkpoint MTM ticks must not schedule state saves'
  );

  assert.ok(
    position.currentPriceSol>0.001,
    'current price must still update in RAM on every tick'
  );

  assert.ok(
    position.highestPriceSol>=position.currentPriceSol,
    'high watermark must still update in RAM'
  );

  now+=100;

  paper.onTokenUpdate(
    mint,
    token(now,mint,0.00102)
  );

  assert.equal(
    store.saveCalls,
    1,
    'checkpoint boundary must schedule exactly one save'
  );

  now+=100;

  paper.onTokenUpdate(
    mint,
    token(now,mint,0.00103)
  );

  assert.equal(
    store.saveCalls,
    1,
    'tick immediately after checkpoint must not write again'
  );
}

// 2. TP1 is irreversible execution history and must force durability even
//    inside the normal checkpoint window.
{
  let now=1_800_100_000_000;
  const mint='V55TP11111111111111111111111111111111111';
  const store=makeStore();

  const paper=
    new PaperEngine(
      store,
      {
        clock:()=>now,
        positionCheckpointMs:10_000
      }
    );

  const opened=
    paper.openPosition(
      'v55-user',
      token(now,mint,0.001),
      decision(now),
      settings()
    );

  assert.equal(opened.ok,true);
  store.resetSaveCalls();

  now+=100;

  paper.onTokenUpdate(
    mint,
    token(now,mint,0.00201)
  );

  assert.equal(opened.position.tp1Executed,true);
  assert.equal(opened.position.status,'OPEN');

  assert.equal(
    store.saveCalls,
    1,
    'TP1 must force save before ordinary checkpoint is due'
  );

  assert.ok(
    Object.values(store.state.paperTrades)
      .some(t=>t.side==='SELL'&&t.reason==='TP1')
  );
}

// 3. HARD STOP must also force durability immediately and close the position.
{
  let now=1_800_200_000_000;
  const mint='V55Stop111111111111111111111111111111111';
  const store=makeStore();

  const paper=
    new PaperEngine(
      store,
      {
        clock:()=>now,
        positionCheckpointMs:10_000
      }
    );

  const opened=
    paper.openPosition(
      'v55-user',
      token(now,mint,0.001),
      decision(now),
      settings()
    );

  assert.equal(opened.ok,true);
  store.resetSaveCalls();

  now+=100;

  paper.onTokenUpdate(
    mint,
    token(now,mint,0.00074)
  );

  assert.equal(opened.position.status,'CLOSED');
  assert.equal(opened.position.closeReason,'HARD STOP');

  assert.equal(
    store.saveCalls,
    1,
    'HARD STOP must force save before checkpoint is due'
  );

  assert.ok(
    Object.values(store.state.paperTrades)
      .some(t=>t.side==='SELL'&&t.reason==='HARD STOP')
  );
}

// 4. Static contract: the old unconditional save after open-position updates
//    must be gone and the new durable signal must be wired.
{
  const fs=await import('node:fs');

  const source=
    fs.readFileSync(
      'src/paper-engine.mjs',
      'utf8'
    );

  assert.match(
    source,
    /MEMEFLOW_PAPER_POSITION_CHECKPOINT_V55/
  );

  assert.doesNotMatch(
    source,
    /for \(const position of open\) this\.updatePosition\(position, token\);\s*if \(open\.length\) this\.save\(\);/
  );

  assert.match(
    source,
    /if \(durableMutation\) \{\s*this\._checkpointOpenPositionStateV55\(true\);/
  );

  assert.match(
    source,
    /else if \(open\.length\) \{\s*this\._checkpointOpenPositionStateV55\(false\);/
  );
}

console.log('paper position checkpoint v55 ok');
