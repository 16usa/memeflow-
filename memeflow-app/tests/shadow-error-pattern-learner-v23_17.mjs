import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createShadowErrorPatternLearnerV23_17
} from '../src/shadow-error-pattern-learner-v23_17.mjs';

const tmp=
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'mf-v23-17-'
    )
  );

function review({
  mint,
  at,
  miss,
  tags=[],
  resultType=null,
  confidence=80,
  horizonMs=300_000
}){
  return {
    key:`${mint}:${at}:${horizonMs}`,
    mint,
    anchorAt:at,
    observedAt:
      at+horizonMs,
    horizonMs,
    hit:miss!==true,
    miss:miss===true,
    resultType:
      resultType||
      (
        miss
          ? 'FALSE_POSITIVE'
          : 'TRUE_POSITIVE'
      ),
    stageAtAnchor:'DEEP',
    regimeAtAnchor:'EXPANSION',
    forecast:{
      source:'V23_11_CALIBRATED',
      predictedClass:'POSITIVE',
      confidencePct:confidence
    },
    attributionTags:tags
  };
}

try{
  const learner=
    createShadowErrorPatternLearnerV23_17({
      dataDir:tmp
    });

  const base=1_801_500_000_000;

  for(let i=0;i<20;i++){
    learner.observeReview(
      review({
        mint:`RISK_${i}`,
        at:base+i*1000,
        miss:i<16,
        tags:[
          'HIGH_MODEL_DISAGREEMENT',
          'TRAJECTORY_FADING',
          ...(i<16
            ? ['HIGH_CONFIDENCE_MISS']
            : [])
        ],
        resultType:
          i<16
            ? 'FALSE_POSITIVE'
            : 'TRUE_POSITIVE'
      })
    );
  }

  for(let i=0;i<30;i++){
    learner.observeReview(
      review({
        mint:`BASE_${i}`,
        at:base+100_000+i*1000,
        miss:i<3,
        tags:['DATA_OK'],
        resultType:
          i<3
            ? 'FALSE_POSITIVE'
            : 'TRUE_POSITIVE',
        confidence:60
      })
    );
  }

  const report=
    learner.patternReport({
      horizonMs:300_000,
      limit:100
    });

  assert.equal(
    report.scoredRows,
    50
  );

  assert.ok(
    report.globalMissRatePct>0
  );

  const pair=
    report.patterns.find(
      row=>
        row.tags.includes(
          'HIGH_MODEL_DISAGREEMENT'
        ) &&
        row.tags.includes(
          'TRAJECTORY_FADING'
        )
    );

  assert.ok(pair);
  assert.equal(
    pair.mature,
    true
  );
  assert.ok(
    pair.support>=20
  );
  assert.ok(
    pair.missLift>=1.25
  );

  assert.ok(
    report.patterns.every(
      row=>
        !row.tags.includes(
          'HIGH_CONFIDENCE_MISS'
        )
    )
  );

  assert.equal(
    report.autoCorrection,
    false
  );

  assert.equal(
    report.policy.maxCombinationSize,
    2
  );

  assert.equal(
    await learner.flush(),
    true
  );

  const restored=
    createShadowErrorPatternLearnerV23_17({
      dataDir:tmp
    });

  assert.equal(
    restored.status().rowsLoaded,
    50
  );

  const source=
    fs.readFileSync(
      'src/shadow-error-pattern-learner-v23_17.mjs',
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

  assert.match(
    shadow,
    /createShadowErrorPatternLearnerV23_17/
  );

  assert.match(
    shadow,
    /shadowErrorPatternLearner\.observeReview/
  );

  assert.match(
    shadow,
    /errorPatternLearnerStatus/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/error-patterns/
  );

  assert.match(
    html,
    /id="errorPatternList"/
  );

  assert.match(
    js,
    /loadErrorPatterns/
  );

  console.log(
    'shadow error pattern learner v23.17 ok'
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
