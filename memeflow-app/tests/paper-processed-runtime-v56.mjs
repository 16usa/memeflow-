import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {JsonStore} from '../src/store.mjs';
import {PaperEngine} from '../src/paper-engine.mjs';

async function closeStore(store){
  if(!store)return;

  try{
    await store.flushStateSave();
  }catch{}

  try{
    store.close();
  }catch{}
}

function makePaperStore(userId='v56-user'){
  return {
    state:{
      users:{
        [userId]:{
          id:userId,
          killSwitch:false,
          settings:{}
        }
      },
      tokens:{},
      positions:{},
      paperPositions:{},
      paperTrades:{},
      paperProposals:{},
      paperProcessed:{},
      paperMetrics:{entries:0,exits:0,errors:0}
    },
    save(){}
  };
}

function baseSettings(overrides={}){
  return {
    operatingMode:'assist',
    tradingEnvironment:'paper',
    positionSize:0.1,
    maxPositionSize:0.5,
    maxOpenPositions:4,
    maxDailyEntries:10,
    dailySpendLimit:0,
    tradingCapital:0,
    dailyLossLimit:0,
    decisionFreshnessSec:60,
    ...overrides
  };
}

// 1. Legacy durable paperProcessed rows are accepted for backward-compatible
//    recovery, but are NOT restored into the new evaluator runtime.
{
  const dir=
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'memeflow-v56-legacy-'
      )
    );

  let store=null;

  try{
    fs.writeFileSync(
      path.join(dir,'state.json'),
      JSON.stringify({
        users:{
          legacy:{
            id:'legacy',
            plan:'free'
          }
        },
        paperPositions:{},
        paperTrades:{},
        paperProposals:{},
        paperProcessed:{
          'legacy:mint:1':{
            result:'REJECTED',
            at:'2026-08-01T00:00:00.000Z'
          }
        },
        paperMetrics:{
          entries:0,
          exits:0,
          errors:0
        }
      }),
      'utf8'
    );

    store=new JsonStore(dir);

    assert.equal(
      Object.keys(store.state.paperProcessed||{}).length,
      0,
      'legacy persisted replay cache must not survive restart'
    );

    assert.ok(
      store.state.users.legacy,
      'real durable user state must still restore'
    );

    store.save();

    const result=
      await store.flushStateSave();

    assert.equal(result.ok,true);

    const persisted=
      JSON.parse(
        fs.readFileSync(
          store.file,
          'utf8'
        )
      );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        persisted,
        'paperProcessed'
      ),
      false,
      'paperProcessed must not be serialized'
    );

    assert.ok(
      Object.prototype.hasOwnProperty.call(
        persisted,
        'paperPositions'
      ),
      'paperPositions history must remain persisted'
    );

    assert.ok(
      Object.prototype.hasOwnProperty.call(
        persisted,
        'paperTrades'
      ),
      'paperTrades history must remain persisted'
    );

    assert.ok(
      Object.prototype.hasOwnProperty.call(
        persisted,
        'paperProposals'
      ),
      'paperProposals must remain persisted'
    );
  }finally{
    await closeStore(store);

    fs.rmSync(
      dir,
      {
        recursive:true,
        force:true
      }
    );
  }
}

// 2. Same-runtime idempotency remains active.
{
  let now=Date.parse('2026-09-01T04:00:00.000Z');
  const store=makePaperStore();

  const paper=
    new PaperEngine(
      store,
      {
        clock:()=>now,
        paperProcessedMaxEntries:64
      }
    );

  const token={
    mint:'V56Assist1111111111111111111111111111111',
    name:'V56',
    symbol:'V56',
    priceSol:0.001,
    holderFresh:true,
    updatedAt:now,
    lastPriceAt:now
  };

  const decision={
    state:'BUY READY',
    score:90,
    confidence:90,
    updatedAt:now
  };

  const first=
    paper.onDecision(
      'v56-user',
      token,
      decision,
      baseSettings()
    );

  assert.equal(first.action,'PROPOSED');

  const second=
    paper.onDecision(
      'v56-user',
      token,
      decision,
      baseSettings()
    );

  assert.equal(second.action,'NONE');
  assert.equal(second.reason,'IDEMPOTENT');
  assert.equal(
    Object.keys(store.state.paperProposals).length,
    1
  );
}

// 3. Runtime cache is bounded and trims in batches, keeping newest rows.
{
  let now=Date.parse('2026-09-01T05:00:00.000Z');
  const store=makePaperStore();

  const paper=
    new PaperEngine(
      store,
      {
        clock:()=>now,
        paperProcessedMaxEntries:20
      }
    );

  for(let i=0;i<75;i++){
    now+=1000;

    paper._recordPaperProcessedV56(
      `v56-user:mint:${i}`,
      {
        result:'REJECTED',
        at:new Date(now).toISOString()
      }
    );
  }

  const keys=
    Object.keys(
      store.state.paperProcessed
    );

  assert.ok(
    keys.length<=20,
    `runtime replay cache exceeded bound: ${keys.length}`
  );

  assert.ok(
    store.state.paperProcessed['v56-user:mint:74'],
    'newest replay row must survive trimming'
  );

  assert.equal(
    Boolean(
      store.state.paperProcessed['v56-user:mint:0']
    ),
    false,
    'oldest replay rows must be trimmed first'
  );
}

// 4. Static persistence contract.
{
  const source=
    fs.readFileSync(
      'src/store.mjs',
      'utf8'
    );

  const start=
    source.indexOf(
      '_statePersistPayload(){'
    );

  const end=
    source.indexOf(
      '\n  _scheduleStateSaveDrainV50(){',
      start
    );

  assert.ok(
    start>=0 && end>start,
    'state persistence block missing'
  );

  const block=
    source.slice(start,end);

  // paperProcessed is allowed exactly once in this block: only as the
  // excluded destructuring binding. It must never be emitted into the JSON
  // object returned by _statePersistPayload().
  const excludedMatches =
    block.match(
      /paperProcessed\s*:\s*_paperProcessed/g
    ) || [];

  assert.equal(
    excludedMatches.length,
    1,
    'paperProcessed must be excluded exactly once in state destructuring'
  );

  const returnStart =
    block.indexOf(
      'return JSON.stringify({'
    );

  assert.ok(
    returnStart >= 0,
    'state persistence return block missing'
  );

  const returned =
    block.slice(returnStart);

  assert.doesNotMatch(
    returned,
    /paperProcessed\s*:/,
    'paperProcessed must not be emitted into durable JSON'
  );
}

console.log(
  'paper processed runtime v56 ok'
);
