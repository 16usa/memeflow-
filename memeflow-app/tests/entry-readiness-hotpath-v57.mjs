import assert from 'node:assert/strict';
import fs from 'node:fs';

import {PaperEngine} from '../src/paper-engine.mjs';

function assertClose(actual, expected, epsilon = 1e-12, message = '') {
  assert.ok(
    Number.isFinite(actual) &&
    Math.abs(actual - expected) <= epsilon,
    message ||
      `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

function makeStore(userId='v57-user'){
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
    save(){}
  };
}

function paperSettings(overrides={}){
  return {
    operatingMode:'automate',
    tradingEnvironment:'paper',
    positionSize:0.1,
    maxPositionSize:0.5,
    maxOpenPositions:4,
    maxDailyEntries:10,
    dailySpendLimit:1.0,
    tradingCapital:2.0,
    dailyLossLimit:0.5,
    decisionFreshnessSec:60,
    ...overrides
  };
}

const now=Date.parse('2026-09-01T12:00:00.000Z');
const day='2026-09-01';
const yesterday='2026-08-31';

const store=makeStore();

store.state.paperPositions={
  openTargetOld:{
    id:'openTargetOld',
    userId:'v57-user',
    mint:'TARGET',
    status:'OPEN',
    openedAt:`${day}T08:00:00.000Z`,
    openedAtMs:Date.parse(`${day}T08:00:00.000Z`),
    initialSizeSol:0.10,
    remainingSizeSol:0.08
  },
  openTargetNewest:{
    id:'openTargetNewest',
    userId:'v57-user',
    mint:'TARGET',
    status:'OPEN',
    openedAt:`${day}T09:00:00.000Z`,
    openedAtMs:Date.parse(`${day}T09:00:00.000Z`),
    initialSizeSol:0.20,
    remainingSizeSol:0.15
  },
  openOther:{
    id:'openOther',
    userId:'v57-user',
    mint:'OTHER',
    status:'OPEN',
    openedAt:`${yesterday}T22:00:00.000Z`,
    openedAtMs:Date.parse(`${yesterday}T22:00:00.000Z`),
    initialSizeSol:0.30,
    remainingSizeSol:0.25
  },
  closedToday:{
    id:'closedToday',
    userId:'v57-user',
    mint:'CLOSED',
    status:'CLOSED',
    openedAt:`${day}T07:00:00.000Z`,
    openedAtMs:Date.parse(`${day}T07:00:00.000Z`),
    initialSizeSol:0.40,
    remainingSizeSol:0
  },
  otherUser:{
    id:'otherUser',
    userId:'someone-else',
    mint:'TARGET',
    status:'OPEN',
    openedAt:`${day}T06:00:00.000Z`,
    openedAtMs:Date.parse(`${day}T06:00:00.000Z`),
    initialSizeSol:9,
    remainingSizeSol:9
  }
};

store.state.paperTrades={
  sellToday:{
    id:'sellToday',
    userId:'v57-user',
    side:'SELL',
    executedAt:`${day}T10:00:00.000Z`,
    executedAtMs:Date.parse(`${day}T10:00:00.000Z`),
    realizedPnlSol:-0.12
  },
  buyToday:{
    id:'buyToday',
    userId:'v57-user',
    side:'BUY',
    executedAt:`${day}T08:00:00.000Z`,
    executedAtMs:Date.parse(`${day}T08:00:00.000Z`),
    realizedPnlSol:0
  },
  sellYesterday:{
    id:'sellYesterday',
    userId:'v57-user',
    side:'SELL',
    executedAt:`${yesterday}T10:00:00.000Z`,
    executedAtMs:Date.parse(`${yesterday}T10:00:00.000Z`),
    realizedPnlSol:-8
  },
  otherUserTrade:{
    id:'otherUserTrade',
    userId:'someone-else',
    side:'SELL',
    executedAt:`${day}T11:00:00.000Z`,
    executedAtMs:Date.parse(`${day}T11:00:00.000Z`),
    realizedPnlSol:-99
  }
};

const paper=
  new PaperEngine(
    store,
    {
      clock:()=>now
    }
  );

// 1. New snapshot must exactly preserve the legacy readiness aggregates.
{
  const snapshot=
    paper._entryReadinessSnapshotV57(
      'v57-user',
      'TARGET',
      now
    );

  assert.equal(snapshot.openPositions.length,3);
  assert.equal(snapshot.existingPosition?.id,'openTargetNewest');
  assert.equal(snapshot.dailyEntries,3);
  assertClose(snapshot.dailySpent,0.70);
  assertClose(snapshot.deployed,0.48);
  assertClose(snapshot.dailyRealizedPnl,-0.12);
}

// 2. entryReadiness hot path must NOT call sorting history helpers at all.
//    If any old helper is touched, the regression fails immediately.
{
  paper.userPositions=()=>{
    throw new Error('V57_ENTRY_HOTPATH_CALLED_USER_POSITIONS');
  };

  paper.userTrades=()=>{
    throw new Error('V57_ENTRY_HOTPATH_CALLED_USER_TRADES');
  };

  paper.openForMint=()=>{
    throw new Error('V57_ENTRY_HOTPATH_CALLED_OPEN_FOR_MINT');
  };

  paper.dailyEntries=()=>{
    throw new Error('V57_ENTRY_HOTPATH_CALLED_DAILY_ENTRIES');
  };

  paper.dailySpent=()=>{
    throw new Error('V57_ENTRY_HOTPATH_CALLED_DAILY_SPENT');
  };

  paper.dailyRealizedPnl=()=>{
    throw new Error('V57_ENTRY_HOTPATH_CALLED_DAILY_PNL');
  };

  const readiness=
    paper.entryReadiness(
      'v57-user',
      {
        mint:'TARGET',
        priceSol:0.001,
        holderFresh:true,
        updatedAt:now,
        lastPriceAt:now
      },
      paperSettings()
    );

  assert.equal(readiness.metrics.openPositions,3);
  assert.equal(readiness.metrics.dailyEntries,3);
  assertClose(readiness.metrics.dailySpent,0.70);
  assertClose(readiness.metrics.deployed,0.48);
  assertClose(readiness.metrics.dailyRealizedPnl,-0.12);

  const existingCheck=
    readiness.checks.find(
      check=>check.key==='noExistingPosition'
    );

  assert.equal(existingCheck?.pass,false);
  assert.equal(existingCheck?.code,'POSITION_EXISTS');
}

// 3. Public history helpers remain unchanged for UI/API behavior.
{
  const source=
    fs.readFileSync(
      'src/paper-engine.mjs',
      'utf8'
    );

  const positionsStart=source.indexOf('  userPositions(userId, status = null) {');
  const tradesStart=source.indexOf('  userTrades(userId) {');

  assert.ok(positionsStart>=0);
  assert.ok(tradesStart>=0);

  const positionsBlock=source.slice(positionsStart,tradesStart);

  assert.match(
    positionsBlock,
    /\.sort\(\(a, b\) => b\.openedAtMs - a\.openedAtMs\)/
  );

  const readinessStart=source.indexOf('  entryReadiness(userId, token, settings) {');
  const readinessEnd=source.indexOf('\n  canEnter(',readinessStart);
  const readinessBlock=source.slice(readinessStart,readinessEnd);

  assert.match(
    readinessBlock,
    /_entryReadinessSnapshotV57/
  );

  assert.doesNotMatch(
    readinessBlock,
    /this\.userPositions\s*\(/
  );

  assert.doesNotMatch(
    readinessBlock,
    /this\.userTrades\s*\(/
  );

  assert.doesNotMatch(
    readinessBlock,
    /this\.openForMint\s*\(/
  );

  assert.doesNotMatch(
    readinessBlock,
    /this\.dailyEntries\s*\(/
  );

  assert.doesNotMatch(
    readinessBlock,
    /this\.dailySpent\s*\(/
  );

  assert.doesNotMatch(
    readinessBlock,
    /this\.dailyRealizedPnl\s*\(/
  );
}

// 4. Large-history guard: exactly one positions enumeration + one trades
//    enumeration per snapshot. This is deterministic and does not use timing.
{
  const largeStore=makeStore();

  for(let i=0;i<10000;i++){
    largeStore.state.paperPositions[`p${i}`]={
      id:`p${i}`,
      userId:i%2===0?'v57-user':'someone-else',
      mint:`M${i}`,
      status:i%5===0?'OPEN':'CLOSED',
      openedAt:`${day}T01:00:00.000Z`,
      openedAtMs:now-i,
      initialSizeSol:0.01,
      remainingSizeSol:i%5===0?0.005:0
    };

    largeStore.state.paperTrades[`t${i}`]={
      id:`t${i}`,
      userId:i%2===0?'v57-user':'someone-else',
      executedAt:`${day}T02:00:00.000Z`,
      executedAtMs:now-i,
      realizedPnlSol:0.0001
    };
  }

  const largePaper=
    new PaperEngine(
      largeStore,
      {
        clock:()=>now
      }
    );

  const snapshot=
    largePaper._entryReadinessSnapshotV57(
      'v57-user',
      'NOT-OPEN',
      now
    );

  assert.equal(snapshot.dailyEntries,5000);
  assertClose(snapshot.dailySpent,50,1e-9);
  assertClose(snapshot.dailyRealizedPnl,0.5,1e-9);
}

console.log('entry readiness hotpath v57 ok');
