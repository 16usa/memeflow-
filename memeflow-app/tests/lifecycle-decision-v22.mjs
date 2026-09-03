import assert from 'node:assert/strict';
import {
  evaluatePositionDecision,
  POSITION_DECISION_PRIORITY_V22
} from '../src/position-decision.mjs';

const now=1_800_000_000_000;
const settings={
  hardStopPct:25,
  trailingStopPct:15,
  tp1Pct:100,
  tp1SellPct:50,
  tp2Pct:200,
  tp2SellPct:25,
  maxHoldMinutes:60,
  exitOnWeakBuyPressure:true,
  exitBuyPressure:1
};

const position=(overrides={})=>({
  entryPriceSol:0.001,
  currentPriceSol:0.001,
  highestPriceSol:0.001,
  trailingStopPriceSol:null,
  initialTokenQuantity:1000,
  remainingTokenQuantity:1000,
  openedAtMs:now-10*60_000,
  decisionScore:90,
  tp1Executed:false,
  tp2Executed:false,
  ...overrides
});

const token=(price,overrides={})=>({
  priceSol:price,
  buyPressure:2,
  opportunityEvidenceReady:true,
  opportunityTrendHealthy:true,
  recentNetFlowSol:0.2,
  drawdownFromPeakPct:0,
  ...overrides
});

const decision=(score=90,state='BUY READY')=>({
  state,
  score,
  scoreAvailable:true,
  scoreFresh:true,
  scoreSource:'evaluate-live'
});

// Emergency outranks every price rule.
{
  const d=evaluatePositionDecision({
    position:position(),
    token:token(0.0005,{dead:true,deadReason:'CREATOR_EXIT'}),
    settings,
    currentDecision:decision(20,'BLOCKED'),
    now
  });
  assert.equal(d.action,'CLOSE');
  assert.equal(d.code,'EMERGENCY_EXIT');
  assert.equal(d.priority,POSITION_DECISION_PRIORITY_V22.EMERGENCY);
  assert.match(d.reason,/CREATOR_EXIT/);
}

// Hard stop.
{
  const d=evaluatePositionDecision({
    position:position(),
    token:token(0.00074),
    settings,
    currentDecision:decision(60,'WATCH'),
    now
  });
  assert.equal(d.action,'CLOSE');
  assert.equal(d.reason,'HARD STOP');
}

// Trailing stop.
{
  const d=evaluatePositionDecision({
    position:position({highestPriceSol:0.002}),
    token:token(0.00169),
    settings,
    currentDecision:decision(80,'WATCH'),
    now
  });
  assert.equal(d.action,'CLOSE');
  assert.equal(d.reason,'TRAILING STOP');
}

// A jump through TP2 yields one lifecycle decision with both partial exits.
{
  const d=evaluatePositionDecision({
    position:position(),
    token:token(0.0031),
    settings,
    currentDecision:decision(96,'BUY READY'),
    now
  });
  assert.equal(d.action,'REDUCE');
  assert.deepEqual(d.actions.map(x=>x.reason),['TP1','TP2']);
  assert.deepEqual(d.actions.map(x=>x.percentOfInitial),[50,25]);
}

// Conservative deterioration requires all four signals, not just WATCH/BLOCKED.
{
  const d=evaluatePositionDecision({
    position:position(),
    token:token(0.0011,{
      opportunityTrendHealthy:false,
      recentNetFlowSol:-0.25,
      drawdownFromPeakPct:25
    }),
    settings,
    currentDecision:decision(60,'WATCH'),
    now
  });
  assert.equal(d.action,'CLOSE');
  assert.equal(d.reason,'DETERIORATION EXIT');
  assert.equal(d.metrics.scoreDeltaFromEntry,-30);
}

// A low Score alone does NOT force an exit.
{
  const d=evaluatePositionDecision({
    position:position(),
    token:token(0.0011,{
      opportunityTrendHealthy:true,
      recentNetFlowSol:0.1,
      drawdownFromPeakPct:5
    }),
    settings,
    currentDecision:decision(40,'WATCH'),
    now
  });
  assert.equal(d.action,'HOLD');
}

// Max hold.
{
  const d=evaluatePositionDecision({
    position:position({openedAtMs:now-61*60_000}),
    token:token(0.0011),
    settings,
    currentDecision:decision(85,'WATCH'),
    now
  });
  assert.equal(d.action,'CLOSE');
  assert.equal(d.reason,'MAX HOLD TIME');
}

// Weak pressure.
{
  const d=evaluatePositionDecision({
    position:position(),
    token:token(0.0011,{buyPressure:0.5}),
    settings,
    currentDecision:decision(85,'WATCH'),
    now
  });
  assert.equal(d.action,'CLOSE');
  assert.equal(d.reason,'BUY PRESSURE EXIT');
}

// Healthy position holds and exposes canonical assessment telemetry.
{
  const d=evaluatePositionDecision({
    position:position(),
    token:token(0.0012),
    settings,
    currentDecision:decision(88,'WATCH'),
    now
  });
  assert.equal(d.action,'HOLD');
  assert.equal(d.metrics.entryScore,90);
  assert.equal(d.metrics.currentScore,88);
  assert.equal(d.metrics.scoreDeltaFromEntry,-2);
  assert.equal(d.metrics.currentState,'WATCH');
}

console.log('unified lifecycle decision v22 ok');
