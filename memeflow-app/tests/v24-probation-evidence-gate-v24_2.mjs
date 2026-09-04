import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createV24ProbationEvidenceGateV24_2
} from '../src/v24-probation-evidence-gate-v24_2.mjs';

const strongTelemetry={
  sample:{
    directional:120,
    negativeOutcomes:84,
    positiveOutcomes:36,
    resolved:126,
    pending:14,
    shadowInterventions:80,
    enforcedInterventions:0
  },
  impact:{
    blockedNegativePrecisionPct:70,
    positiveOpportunityCostPct:30,
    affectedRatePct:18,
    preventedNegativeCount:84,
    missedPositiveCount:36
  },
  probation:{
    evidenceReady:true,
    verdict:'EVIDENCE_READY_FOR_OWNER_REVIEW'
  }
};

const readiness={
  architecture:{structuralReady:true},
  v24:{controlledActivationEligible:true}
};

const result=createV24ProbationEvidenceGateV24_2({
  telemetryProvider:()=>strongTelemetry,
  readinessProvider:()=>readiness,
  bridgeStatusProvider:()=>({mode:'SHADOW',killSwitch:false})
}).evaluate();

assert.equal(result.status,'V24_CANDIDATE_FOR_MANUAL_ENFORCE_REVIEW');
assert.equal(result.candidateForManualEnforceReview,true);
assert.equal(result.blockers.length,0);
assert.ok(result.gates.every(row=>row.pass===true));
assert.equal(result.reviewPacket.recommendation,'MANUAL_ENFORCE_REVIEW_ALLOWED');
assert.ok(result.impact.blockedNegativePrecisionWilsonLower95Pct>=55);
assert.equal(result.controls.applicationAllowed,false);
assert.equal(result.controls.modeMutation,false);
assert.equal(result.controls.thresholdMutation,false);
assert.equal(result.controls.automaticPromotion,false);

const building=createV24ProbationEvidenceGateV24_2({
  telemetryProvider:()=>({
    sample:{
      directional:40,
      negativeOutcomes:28,
      positiveOutcomes:12,
      resolved:40,
      pending:10,
      shadowInterventions:20
    },
    impact:{
      blockedNegativePrecisionPct:70,
      positiveOpportunityCostPct:30
    },
    probation:{evidenceReady:false,verdict:'BUILDING_EVIDENCE'}
  }),
  readinessProvider:()=>readiness,
  bridgeStatusProvider:()=>({mode:'SHADOW',killSwitch:false})
}).evaluate();

assert.equal(building.status,'V24_PROBATION_EVIDENCE_BUILDING');
assert.equal(building.candidateForManualEnforceReview,false);
assert.ok(building.blockers.includes('DIRECTIONAL_SAMPLE'));

const active=createV24ProbationEvidenceGateV24_2({
  telemetryProvider:()=>strongTelemetry,
  readinessProvider:()=>readiness,
  bridgeStatusProvider:()=>({mode:'ENFORCE',killSwitch:false})
}).evaluate();

assert.equal(active.status,'V24_ENFORCE_ALREADY_ACTIVE_REVIEW_REQUIRED');
assert.equal(active.candidateForManualEnforceReview,false);
assert.ok(active.blockers.includes('NOT_ALREADY_ENFORCING'));

const source=fs.readFileSync(
  'src/v24-probation-evidence-gate-v24_2.mjs','utf8'
);
assert.doesNotMatch(source,/from ['"]\.\/evaluate\.mjs['"]/);
assert.doesNotMatch(source,/openPosition\s*\(/);
assert.doesNotMatch(source,/closePosition\s*\(/);
assert.doesNotMatch(source,/\.setMode\s*\(/);
assert.doesNotMatch(source,/\.setKillSwitch\s*\(/);

const app=fs.readFileSync('app-server.mjs','utf8');
const html=fs.readFileSync('owner-intelligence.html','utf8');
const js=fs.readFileSync('owner-intelligence.js','utf8');

assert.match(app,/createV24ProbationEvidenceGateV24_2/);
assert.match(app,/\/api\/owner\/intelligence\/v24-probation-gate/);
assert.doesNotMatch(app,/\/api\/owner\/intelligence\/v24-probation-gate\/apply/);
assert.match(html,/id="v24ProbationGateStatus"/);
assert.match(js,/loadV24ProbationGate/);

console.log('v24 probation evidence gate v24.2 ok');
