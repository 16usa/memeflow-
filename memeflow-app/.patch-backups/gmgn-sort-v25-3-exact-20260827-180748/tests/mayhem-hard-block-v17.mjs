import assert from 'node:assert/strict';

import {PaperEngine} from '../src/paper-engine.mjs';
import {CopyTradingManager} from '../src/copy-trading.mjs';

const now=Date.now();

const store={
  state:{
    users:{
      u:{
        id:'u',
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
  save(){},
};

const paper=new PaperEngine(
  store,
  {clock:()=>now}
);

const settings={
  operatingMode:'automate',
  tradingEnvironment:'paper',
  positionSize:0.1,
  maxPositionSize:0.5,
  maxOpenPositions:10,
  maxDailyEntries:10,
  dailySpendLimit:10,
  tradingCapital:10,
  dailyLossLimit:10,
  decisionFreshnessSec:60
};

const mayhem={
  mint:'MayhemMint111111111111111111111111111111',
  name:'MAYHEM',
  symbol:'MAYHEM',
  isMayhemMode:true,
  launchMode:'mayhem',
  priceSol:0.000001,
  holderFresh:true,
  updatedAt:now,
  lastPriceAt:now
};

const readiness=
  paper.entryReadiness(
    'u',
    mayhem,
    settings
  );

assert.equal(readiness.ok,false);
assert.equal(
  readiness.checks[0]?.code,
  'MAYHEM_MODE_BLOCKED'
);

const gate=
  paper.canEnter(
    'u',
    mayhem,
    settings
  );

assert.deepEqual(
  gate,
  {
    ok:false,
    code:'MAYHEM_MODE_BLOCKED'
  }
);

const decisionResult=
  paper.onDecision(
    'u',
    mayhem,
    {state:'BUY READY',score:99},
    settings
  );

assert.equal(
  decisionResult.action,
  'REJECTED'
);
assert.equal(
  decisionResult.reason,
  'MAYHEM_MODE_BLOCKED'
);
assert.equal(
  Object.keys(store.state.paperPositions).length,
  0
);
assert.equal(
  Object.keys(store.state.paperProposals).length,
  0
);

const copy=
  new CopyTradingManager({
    store,
    paper,
    rpc:null,
    logger:{
      warn(){}
    },
    clock:()=>now
  });

const copyResult=
  await copy.processUser(
    store.state.users.u,
    {
      ...settings,
      copyTradingBuyAmountSol:0.1,
      copyTradingWallet:'Wallet111'
    },
    {
      isBuy:true,
      mint:mayhem.mint,
      user:'Wallet111'
    },
    mayhem,
    null
  );

assert.equal(copyResult.ok,false);
assert.equal(
  copyResult.code,
  'MAYHEM_MODE_BLOCKED'
);
assert.equal(
  Object.keys(store.state.paperPositions).length,
  0
);

console.log('mayhem hard block v17 ok');
