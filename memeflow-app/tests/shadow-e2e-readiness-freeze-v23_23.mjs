import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createV23E2EReadinessFreezeV23_23
} from '../src/shadow-e2e-readiness-freeze-v23_23.mjs';

const tmp=
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'mf-v23-23-'
    )
  );

const manifestPath=
  path.join(
    tmp,
    'v23-freeze-manifest.json'
  );

fs.writeFileSync(
  manifestPath,
  JSON.stringify({
    version:
      'MEMEFLOW_V23_FREEZE_MANIFEST_V23_23',
    frozen:true,
    shadowOnly:true,
    liveAuthority:'V22',
    automaticPromotion:false,
    applicationAllowed:false,
    applyEndpointExists:false,
    nextMajor:
      'V24_CONTROLLED_INTEGRATION'
  }),
  'utf8'
);

const names=[
  'walletReputation',
  'learningDataset',
  'shadowMathBrain',
  'shadowModelArena',
  'shadowDriftRegime',
  'shadowConfidenceGovernor',
  'shadowTokenTrajectory',
  'shadowTokenPatternMemory',
  'shadowEvidenceSynthesis',
  'shadowOutcomeCalibration',
  'shadowChampionBenchmark',
  'shadowPromotionGate',
  'shadowPromotionReport',
  'tokenIntelligenceScorecard',
  'shadowOutcomeReview',
  'shadowErrorPatternLearner',
  'shadowErrorAwareConfidence',
  'shadowErrorAwareBenchmark',
  'shadowPolicyCandidateBuilder',
  'shadowPolicySimulator',
  'shadowPolicyReviewGate'
];

const components={};

for(const name of names){
  components[name]={
    status(){
      return {
        version:
          `TEST_${name}`
      };
    }
  };
}

components.shadowPolicyReviewGate={
  status(){
    return {
      version:'TEST_REVIEW',
      last:{
        status:
          'POLICY_CANDIDATE_FOR_MANUAL_REVIEW',
        candidateForManualReview:true,
        drift:{
          status:'STABLE'
        },
        calibration:{
          status:
            'CALIBRATION_HEALTHY'
        }
      }
    };
  }
};

try{
  const freeze=
    createV23E2EReadinessFreezeV23_23({
      components,
      manifestPath
    });

  const result=
    freeze.audit();

  assert.equal(
    result.architecture.structuralReady,
    true
  );

  assert.equal(
    result.architecture.freezeStatus,
    'V23_ARCHITECTURE_FROZEN'
  );

  assert.equal(
    result.architecture.expectedComponents,
    21
  );

  assert.equal(
    result.architecture.presentComponents,
    21
  );

  assert.equal(
    result.architecture.missing.length,
    0
  );

  assert.equal(
    result.evidence.ready,
    true
  );

  assert.equal(
    result.v24.integrationCodeMayBegin,
    true
  );

  assert.equal(
    result.v24.controlledActivationEligible,
    true
  );

  assert.equal(
    result.freeze.frozen,
    true
  );

  assert.equal(
    result.freeze.nextMajor,
    'V24_CONTROLLED_INTEGRATION'
  );

  assert.equal(
    result.controls.v22OnlyTradingAuthority,
    true
  );

  assert.equal(
    result.controls.applicationAllowed,
    false
  );

  assert.equal(
    result.controls.applyEndpointExists,
    false
  );

  const evidenceBuildingComponents={
    ...components,
    shadowPolicyReviewGate:{
      status(){
        return {
          version:'TEST_REVIEW',
          last:{
            status:
              'POLICY_REVIEW_EVIDENCE_BUILDING',
            candidateForManualReview:false,
            drift:{
              status:'STABLE'
            },
            calibration:{
              status:
                'CALIBRATION_HEALTHY'
            }
          }
        };
      }
    }
  };

  const building=
    createV23E2EReadinessFreezeV23_23({
      components:
        evidenceBuildingComponents,
      manifestPath
    }).audit();

  assert.equal(
    building.architecture.structuralReady,
    true
  );

  assert.equal(
    building.evidence.ready,
    false
  );

  assert.equal(
    building.v24.integrationCodeMayBegin,
    true
  );

  assert.equal(
    building.v24.controlledActivationEligible,
    false
  );

  const missingComponents={
    ...components
  };

  delete missingComponents
    .shadowPolicySimulator;

  const blocked=
    createV23E2EReadinessFreezeV23_23({
      components:
        missingComponents,
      manifestPath
    }).audit();

  assert.equal(
    blocked.architecture.structuralReady,
    false
  );

  assert.ok(
    blocked.architecture.missing
      .includes(
        'shadowPolicySimulator'
      )
  );

  const source=
    fs.readFileSync(
      'src/shadow-e2e-readiness-freeze-v23_23.mjs',
      'utf8'
    );

  assert.doesNotMatch(
    source,
    /from ['"]\.\/evaluate\.mjs['"]/
  );

  assert.doesNotMatch(
    source,
    /openPosition\s*\(/
  );

  assert.doesNotMatch(
    source,
    /closePosition\s*\(/
  );

  assert.doesNotMatch(
    source,
    /setSettings\s*\(/
  );

  assert.doesNotMatch(
    source,
    /tradeEligible/
  );

  assert.doesNotMatch(
    source,
    /decisionScore/
  );

  const shadow=
    fs.readFileSync(
      'src/token-intelligence-shadow-v23.mjs',
      'utf8'
    );

  const app=
    fs.readFileSync(
      'app-server.mjs',
      'utf8'
    );

  const html=
    fs.readFileSync(
      'owner-intelligence.html',
      'utf8'
    );

  const js=
    fs.readFileSync(
      'owner-intelligence.js',
      'utf8'
    );

  const manifest=
    JSON.parse(
      fs.readFileSync(
        'v23-freeze-manifest.json',
        'utf8'
      )
    );

  assert.match(
    shadow,
    /createV23E2EReadinessFreezeV23_23/
  );

  assert.match(
    shadow,
    /v23ReadinessFreezeStatus/
  );

  assert.match(
    shadow,
    /auditV23ReadinessFreeze/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/v23-readiness/
  );

  assert.doesNotMatch(
    app,
    /\/api\/owner\/intelligence\/v23-readiness\/apply/
  );

  assert.match(
    html,
    /id="v23ReadinessStatus"/
  );

  assert.match(
    js,
    /loadV23Readiness/
  );

  assert.equal(
    manifest.frozen,
    true
  );

  assert.equal(
    manifest.liveAuthority,
    'V22'
  );

  assert.equal(
    manifest.nextMajor,
    'V24_CONTROLLED_INTEGRATION'
  );

  console.log(
    'v23 end-to-end readiness freeze v23.23 ok'
  );
}finally{
  fs.rmSync(
    tmp,
    {
      recursive:true,
      force:true
    }
  );
}
