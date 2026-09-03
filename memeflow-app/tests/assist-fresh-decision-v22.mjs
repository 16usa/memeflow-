import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PaperEngine} from '../src/paper-engine.mjs';

const now=1_800_100_000_000;
const uid='assist-v22-user';
const mint='AssistFreshV2211111111111111111111111111111';

const settings={
  operatingMode:'assist',
  tradingEnvironment:'paper',
  positionSize:1,
  maxPositionSize:1,
  maxOpenPositions:4,
  maxDailyEntries:10,
  dailySpendLimit:0,
  tradingCapital:0,
  dailyLossLimit:0,
  feeReserve:0,
  decisionFreshnessSec:60,
  minScore:0,
  minConfidence:0,
  minHolders:0,
  maxTop10Pct:null,
  maxDeveloperPct:null,
  minBuyPressure:0,
  minLiquidityUsd:0,
  requireFreshHolderSnapshot:true,
  hardStopPct:25,
  trailingStopPct:15,
  tp1Pct:100,
  tp1SellPct:50,
  tp2Pct:200,
  tp2SellPct:25,
  runnerPct:25,
  maxHoldMinutes:1440,
  exitBuyPressure:1,
  exitOnWeakBuyPressure:true
};

const token={
  mint,
  name:'Assist Fresh V22',
  symbol:'AF22',
  priceSol:0.001,
  holderFresh:true,
  holderCount:100,
  top10Pct:10,
  developerPct:2,
  buyPressure:2,
  updatedAt:now,
  lastPriceAt:now
};

const proposal={
  id:'proposal-v22',
  idempotencyKey:'proposal-v22-key',
  userId:uid,
  mint,
  status:'PENDING',
  mode:'paper',
  createdAt:new Date(now).toISOString(),
  createdAtMs:now,
  decisionScore:74,
  decisionConfidence:70,
  primaryReason:'old proposal snapshot'
};

const store={
  state:{
    users:{
      [uid]:{
        id:uid,
        killSwitch:false,
        settings:{...settings}
      }
    },
    tokens:{[mint]:token},
    paperPositions:{},
    paperTrades:{},
    paperProposals:{[proposal.id]:proposal},
    paperProcessed:{},
    paperMetrics:{entries:0,exits:0,errors:0}
  },
  save(){}
};

const paper=new PaperEngine(store,{clock:()=>now});

const freshDecision={
  state:'BUY READY',
  score:94,
  confidence:100,
  dataCompleteness:100,
  scoreAuthority:'evaluate',
  scoreFresh:true,
  scoreSource:'evaluate-live',
  primaryReason:'fresh final pre-open decision',
  updatedAt:now
};

const result=paper.approveProposal(
  uid,
  proposal.id,
  token,
  freshDecision
);

assert.equal(result.ok,true);
assert.equal(result.position.decisionScore,94);
assert.equal(result.position.decisionConfidence,100);
assert.equal(result.position.primaryReason,'fresh final pre-open decision');
assert.equal(result.position.positionSizing.canonicalScore,94);
assert.equal(proposal.status,'APPROVED');
assert.equal(proposal.approvedDecisionScore,94);
assert.equal(proposal.proposedDecisionScore,74);

// Production ASSIST path must pass the verified fresh decision, not only token.
const app=fs.readFileSync('app-server.mjs','utf8');
const start=app.indexOf('async function __mfApprovePaperProposalWithRisk(');
const end=app.indexOf('// MEMEFLOW_CHART_LEVELS_LIVE_V7_2_1_DIRTY_SAFE',start);
assert.ok(start>=0&&end>start);
const block=app.slice(start,end);
assert.match(
  block,
  /paper\.approveProposal\(\s*uid,\s*proposalId,\s*verified\.token,\s*verified\.decision\s*\)/
);

console.log('assist fresh decision v22 ok');
