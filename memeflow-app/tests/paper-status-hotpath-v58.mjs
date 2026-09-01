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

function makeStore(userId='v58-user'){
  return {
    state:{
      users:{
        [userId]:{
          id:userId,
          killSwitch:false,
          settings:{
            tradingEnvironment:'paper',
            operatingMode:'automate'
          }
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

const store=makeStore();

store.state.paperPositions={
  open1:{
    id:'open1',
    userId:'v58-user',
    status:'OPEN',
    realizedPnlSol:0.01
  },
  open2:{
    id:'open2',
    userId:'v58-user',
    status:'OPEN',
    realizedPnlSol:-0.005
  },
  closed1:{
    id:'closed1',
    userId:'v58-user',
    status:'CLOSED',
    realizedPnlSol:0.20
  },
  closed2:{
    id:'closed2',
    userId:'v58-user',
    status:'CLOSED',
    realizedPnlSol:-0.03
  },
  otherState:{
    id:'otherState',
    userId:'v58-user',
    status:'CANCELLED',
    realizedPnlSol:0.001
  },
  foreign:{
    id:'foreign',
    userId:'someone-else',
    status:'OPEN',
    realizedPnlSol:99
  }
};

store.state.paperProposals={
  p1:{id:'p1',userId:'v58-user',status:'PENDING'},
  p2:{id:'p2',userId:'v58-user',status:'PENDING'},
  p3:{id:'p3',userId:'v58-user',status:'APPROVED'},
  p4:{id:'p4',userId:'someone-else',status:'PENDING'}
};

const paper=new PaperEngine(store);

// 1. Exact legacy status semantics, including realized PnL from every user
//    position regardless of OPEN/CLOSED state.
{
  const snapshot=paper._statusSnapshotV58('v58-user');

  assert.equal(snapshot.openPositions,2);
  assert.equal(snapshot.closedPositions,2);
  assert.equal(snapshot.pendingProposals,2);
  assertClose(snapshot.realizedPnlSol,0.176);
}

// 2. status() must not touch any sorted public-history helper.
{
  paper.userPositions=()=>{
    throw new Error('V58_STATUS_CALLED_USER_POSITIONS');
  };

  paper.userProposals=()=>{
    throw new Error('V58_STATUS_CALLED_USER_PROPOSALS');
  };

  const status=paper.status('v58-user');

  assert.equal(status.environment,'paper');
  assert.equal(status.operatingMode,'automate');
  assert.equal(status.paperAutomationActive,true);
  assert.equal(status.openPositions,2);
  assert.equal(status.closedPositions,2);
  assert.equal(status.pendingProposals,2);
  assertClose(status.realizedPnlSol,0.176);
  assert.equal(status.simulated,true);
  assert.equal(status.walletRequired,false);
  assert.equal(status.proRequired,false);
}

// 3. Large-history deterministic regression.
//    No timing assertion: correctness across 20k positions + 20k proposals.
{
  const largeStore=makeStore();

  let expectedOpen=0;
  let expectedClosed=0;
  let expectedPending=0;
  let expectedPnl=0;

  for(let i=0;i<20000;i++){
    const mine=i%2===0;
    const status=i%3===0?'OPEN':i%3===1?'CLOSED':'CANCELLED';
    const pnl=(i%7-3)*0.00001;

    largeStore.state.paperPositions[`pos-${i}`]={
      id:`pos-${i}`,
      userId:mine?'v58-user':'someone-else',
      status,
      realizedPnlSol:pnl
    };

    if(mine){
      if(status==='OPEN')expectedOpen++;
      if(status==='CLOSED')expectedClosed++;
      expectedPnl+=pnl;
    }

    const pending=i%4===0;

    largeStore.state.paperProposals[`proposal-${i}`]={
      id:`proposal-${i}`,
      userId:mine?'v58-user':'someone-else',
      status:pending?'PENDING':'APPROVED'
    };

    if(mine&&pending)expectedPending++;
  }

  const largePaper=new PaperEngine(largeStore);
  const snapshot=largePaper._statusSnapshotV58('v58-user');

  assert.equal(snapshot.openPositions,expectedOpen);
  assert.equal(snapshot.closedPositions,expectedClosed);
  assert.equal(snapshot.pendingProposals,expectedPending);
  assertClose(snapshot.realizedPnlSol,expectedPnl,1e-10);
}

// 4. Static contract: status() itself contains no old history-helper calls.
{
  const source=fs.readFileSync('src/paper-engine.mjs','utf8');

  const start=source.indexOf('  status(userId) {');
  const end=source.indexOf('\n  }\n}',start);

  assert.ok(start>=0&&end>start,'status block missing');

  const block=source.slice(start,end);

  assert.match(block,/_statusSnapshotV58/);
  assert.doesNotMatch(block,/this\.userPositions\s*\(/);
  assert.doesNotMatch(block,/this\.userProposals\s*\(/);
  assert.doesNotMatch(block,/\.sort\s*\(/);
}

console.log('paper status hotpath v58 ok');
