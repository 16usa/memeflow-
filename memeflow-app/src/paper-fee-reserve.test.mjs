import test from 'node:test';
import assert from 'node:assert/strict';
import {PaperEngine} from './paper-engine.mjs';

function fakeStore(){
  return {
    state:{
      users:{u1:{killSwitch:false}},
      paperPositions:{},paperTrades:{},paperProposals:{},paperProcessed:{},
      paperMetrics:{entries:0,exits:0,errors:0}
    },
    save(){}
  };
}

const token=()=>({
  mint:'Mint111',
  name:'Token',
  symbol:'TOK',
  priceSol:1,
  holderFresh:true,
  updatedAt:Date.now()
});

const settings=(patch={})=>({
  operatingMode:'automate',
  tradingEnvironment:'paper',
  positionSize:0.2,
  maxPositionSize:0.5,
  maxOpenPositions:4,
  maxDailyEntries:10,
  dailySpendLimit:0,
  tradingCapital:1,
  dailyLossLimit:0,
  feeReserve:0.1,
  requireFreshHolderSnapshot:true,
  decisionFreshnessSec:60,
  ...patch
});

test('fee reserve reduces tradable paper capital',()=>{
  const engine=new PaperEngine(fakeStore());
  const r=engine.entryReadiness('u1',token(),settings({tradingCapital:1,feeReserve:0.9,positionSize:0.2}));
  const capital=r.checks.find(x=>x.key==='paperCapital');
  assert.equal(capital.pass,false);
  assert.equal(r.metrics.tradableCapital,0.1);
  assert.equal(r.metrics.feeReserve,0.9);
});

test('position passes capital gate when reserve is preserved',()=>{
  const engine=new PaperEngine(fakeStore());
  const r=engine.entryReadiness('u1',token(),settings({tradingCapital:1,feeReserve:0.1,positionSize:0.2}));
  assert.equal(r.checks.find(x=>x.key==='paperCapital').pass,true);
  assert.equal(r.metrics.tradableCapital,0.9);
});
