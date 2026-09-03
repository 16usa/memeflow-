import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createV24ProbationTelemetryV24_1
} from '../src/v24-probation-telemetry-v24_1.mjs';

const tmp=fs.mkdtempSync(
  path.join(os.tmpdir(),'mf-v24-1-')
);

const bridgeFile=
  path.join(tmp,'v24-policy-bridge-audit.jsonl');
const outcomeFile=
  path.join(tmp,'shadow-outcome-review-v23-16.jsonl');

const base=1_800_000_000_000;

const bridges=[];
const outcomes=[];

for(let i=0;i<60;i++){
  const mint=`MintV241_${i}`;
  const at=base+i*1_000_000;

  bridges.push({
    at,
    mint,
    mode:i<30?'SHADOW':'ENFORCE',
    action:
      i<30
        ? 'WOULD_DOWNGRADE_TO_WATCH'
        : 'DOWNGRADE_TO_WATCH',
    candidateId:'candidate-v24-1',
    penaltyPct:20,
    adjustedConfidencePct:44
  });

  const negative=i<40;

  outcomes.push({
    mint,
    anchorAt:at-1_000,
    observedAt:at+300_000,
    horizonMs:300_000,
    outcome:{
      classification:
        negative?'NEGATIVE':'POSITIVE',
      returnPct:
        negative?-25:30,
      maxFavorableExcursionPct:
        negative?5:45,
      maxAdverseExcursionPct:
        negative?-30:-5
    }
  });
}

fs.writeFileSync(
  bridgeFile,
  bridges.map(JSON.stringify).join('\n')+'\n'
);
fs.writeFileSync(
  outcomeFile,
  outcomes.map(JSON.stringify).join('\n')+'\n'
);

const telemetry=createV24ProbationTelemetryV24_1({
  dataDir:tmp,
  bridgeStatusProvider:()=>({
    mode:'ENFORCE',
    killSwitch:false,
    buyReadySeen:120
  })
});

const report=telemetry.report({limit:100});

assert.equal(report.readOnly,true);
assert.equal(report.authority,'DIAGNOSTIC_ONLY');
assert.equal(report.sample.interventions,60);
assert.equal(report.sample.shadowInterventions,30);
assert.equal(report.sample.enforcedInterventions,30);
assert.equal(report.sample.resolved,60);
assert.equal(report.sample.directional,60);
assert.equal(report.sample.negativeOutcomes,40);
assert.equal(report.sample.positiveOutcomes,20);
assert.equal(report.impact.affectedRatePct,50);
assert.equal(report.impact.blockedNegativePrecisionPct,66.67);
assert.equal(report.impact.positiveOpportunityCostPct,33.33);
assert.equal(report.impact.preventedNegativeCount,40);
assert.equal(report.impact.missedPositiveCount,20);
assert.equal(report.probation.evidenceReady,true);
assert.equal(
  report.probation.verdict,
  'EVIDENCE_READY_FOR_OWNER_REVIEW'
);
assert.equal(report.safety.stateMutation,false);
assert.equal(report.safety.automaticPromotion,false);
assert.equal(report.safety.applicationAllowed,false);

// A later same-mint episode outside the match window must not be attributed.
fs.appendFileSync(
  bridgeFile,
  JSON.stringify({
    at:base+99_000_000,
    mint:'NoMatchingEpisode',
    mode:'SHADOW',
    action:'WOULD_DOWNGRADE_TO_WATCH'
  })+'\n'
);

fs.appendFileSync(
  outcomeFile,
  JSON.stringify({
    mint:'NoMatchingEpisode',
    anchorAt:base,
    observedAt:base+100_000_000,
    horizonMs:300_000,
    outcome:{classification:'NEGATIVE'}
  })+'\n'
);

const report2=telemetry.report({limit:100});
assert.equal(report2.sample.interventions,61);
assert.equal(report2.sample.resolved,60);
assert.equal(report2.sample.pending,1);

console.log('v24 probation telemetry v24.1 ok');
