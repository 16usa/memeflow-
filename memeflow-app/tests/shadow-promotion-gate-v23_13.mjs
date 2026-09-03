import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createShadowPromotionGateV23_13}
from '../src/shadow-promotion-gate-v23_13.mjs';

function providers(o={}){
  const x={
    pairedRows:120,positive:60,negative:60,
    verdict:'V23_CHALLENGER_WINS',
    brier:0.02,logLoss:0.04,accuracy:4,
    calibration:'CALIBRATION_HEALTHY',ece:5,drift:'STABLE',
    ...o
  };

  return {
    championBenchmark:{status:()=>({target:{
      pairedRows:x.pairedRows,
      positive:x.positive,
      negative:x.negative,
      delta:{brier:x.brier,logLoss:x.logLoss,accuracyPct:x.accuracy},
      verdict:{status:x.verdict}
    }})},
    outcomeCalibration:{status:()=>({
      targetStatus:x.calibration,
      targetEcePct:x.ece,
      targetBrier:0.12,
      targetLogLoss:0.35
    })},
    driftRegime:{status:()=>({drift:{status:x.drift,ready:true}})}
  };
}

let gate=createShadowPromotionGateV23_13(providers());
let r=gate.evaluate();
assert.equal(r.status,'PROMOTION_CANDIDATE');
assert.equal(r.candidateForManualReview,true);
assert.equal(r.automaticPromotion,false);
assert.equal(r.failedChecks.length,0);

gate=createShadowPromotionGateV23_13(providers({pairedRows:70}));
r=gate.evaluate();
assert.equal(r.status,'PROMOTION_EVIDENCE_BUILDING');
assert.equal(r.candidateForManualReview,false);

gate=createShadowPromotionGateV23_13(
  providers({calibration:'CALIBRATION_MISALIGNED',ece:18})
);
r=gate.evaluate();
assert.equal(r.status,'PROMOTION_BLOCKED');

gate=createShadowPromotionGateV23_13(providers({drift:'DRIFT'}));
r=gate.evaluate();
assert.equal(r.status,'PROMOTION_BLOCKED');
assert.ok(r.failedChecks.includes('DRIFT_HEALTH'));

gate=createShadowPromotionGateV23_13(
  providers({brier:0.004,logLoss:0.009})
);
r=gate.evaluate();
assert.equal(r.status,'PROMOTION_PROBATION');

const source=fs.readFileSync(
  'src/shadow-promotion-gate-v23_13.mjs','utf8'
);
assert.doesNotMatch(source,/from ['"]\.\/evaluate\.mjs['"]/);
assert.doesNotMatch(source,/openPosition\s*\(/);
assert.doesNotMatch(source,/closePosition\s*\(/);
assert.doesNotMatch(source,/setSettings\s*\(/);
assert.doesNotMatch(source,/tradeEligible/);
assert.doesNotMatch(source,/decisionScore/);

const shadow=fs.readFileSync(
  'src/token-intelligence-shadow-v23.mjs','utf8'
);
const app=fs.readFileSync('app-server.mjs','utf8');

assert.match(shadow,/createShadowPromotionGateV23_13/);
assert.match(shadow,/shadowPromotionGate:shadowPromotionGate\.status\(\)/);
assert.match(shadow,/promotionGateStatus/);
assert.match(app,/\/api\/owner\/intelligence\/promotion-gate/);

console.log('shadow promotion gate v23.13 ok');
