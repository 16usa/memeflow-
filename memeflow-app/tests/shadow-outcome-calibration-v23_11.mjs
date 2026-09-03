import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createShadowOutcomeCalibrationV23_11
} from '../src/shadow-outcome-calibration-v23_11.mjs';

const tmp=fs.mkdtempSync(
  path.join(os.tmpdir(),'mf-v23-11-')
);

function anchor({mint,at,probability,confidence=70}){
  return {
    mint,
    at,
    features:{
      shadowEvidenceSynthesis:{
        ready:true,
        status:'SYNTHESIS_MODERATE',
        synthesisProbabilityPositivePct:probability,
        synthesisConfidencePct:confidence
      }
    }
  };
}

function outcome({mint,at,horizonMs=300_000,positive=true}){
  return {
    mint,
    observedAt:at+horizonMs,
    horizonMs,
    returnPct:positive?35:-30,
    maxFavorableExcursionPct:positive?55:5,
    maxAdverseExcursionPct:positive?-8:-35,
    dead:false
  };
}

try{
  const calibration=createShadowOutcomeCalibrationV23_11({
    dataDir:tmp
  });

  const base=1_801_200_000_000;

  for(let i=0;i<30;i++){
    const mint=`B7_${i}`;
    const at=base+i*1000;

    assert.ok(
      calibration.recordOutcome({
        anchor:anchor({mint,at,probability:75}),
        outcome:outcome({mint,at,positive:i<21})
      })
    );
  }

  for(let i=0;i<20;i++){
    const mint=`B8_${i}`;
    const at=base+40_000+i*1000;

    assert.ok(
      calibration.recordOutcome({
        anchor:anchor({mint,at,probability:85}),
        outcome:outcome({mint,at,positive:i<10})
      })
    );
  }

  for(const horizonMs of [15_000,30_000,60_000,180_000]){
    const mint=`H_${horizonMs}`;
    const at=base+100_000+horizonMs;

    calibration.recordOutcome({
      anchor:anchor({mint,at,probability:70}),
      outcome:outcome({mint,at,horizonMs,positive:true})
    });
  }

  const now=base+1_000_000;

  const calibrated=calibration.predict(
    {
      mint:'CURRENT',
      observedAt:now,
      shadowEvidenceSynthesis:{
        ready:true,
        status:'SYNTHESIS_MODERATE',
        synthesisProbabilityPositivePct:85,
        synthesisConfidencePct:80
      }
    },
    {
      mint:'CURRENT',
      at:now
    }
  );

  assert.equal(calibrated.ready,true);
  assert.equal(calibrated.reliabilitySampleCount,50);
  assert.equal(calibrated.bucketCount,20);

  assert.ok(
    calibrated.calibratedProbabilityPositivePct<
    calibrated.rawProbabilityPositivePct
  );

  assert.ok(
    calibrated.calibratedConfidencePct<
    calibrated.rawConfidencePct
  );

  assert.ok(calibrated.globalEcePct!==null);
  assert.ok(calibrated.globalBrier!==null);
  assert.ok(calibrated.globalLogLoss!==null);

  calibration.recordOutcome({
    anchor:anchor({
      mint:'CURRENT',
      at:base+200_000,
      probability:85
    }),
    outcome:outcome({
      mint:'CURRENT',
      at:base+200_000,
      positive:true
    })
  });

  const sameMintExcluded=calibration.predict(
    {
      mint:'CURRENT',
      observedAt:now+100_000,
      shadowEvidenceSynthesis:{
        ready:true,
        status:'SYNTHESIS_MODERATE',
        synthesisProbabilityPositivePct:85,
        synthesisConfidencePct:80
      }
    },
    {
      mint:'CURRENT',
      at:now+100_000
    }
  );

  assert.equal(
    sameMintExcluded.reliabilitySampleCount,
    50
  );

  const report=calibration.horizonReport();

  assert.ok(
    report.some(
      row=>row.horizonMs===300_000&&row.scored>=50
    )
  );

  assert.ok(
    report.some(
      row=>row.horizonMs===60_000
    )
  );

  const buckets=calibration.bucketReport({
    horizonMs:300_000
  });

  assert.equal(buckets.length,10);
  assert.equal(buckets[8].count,21);

  assert.equal(await calibration.flush(),true);

  const restored=createShadowOutcomeCalibrationV23_11({
    dataDir:tmp
  });

  assert.ok(restored.status().rowsLoaded>=50);

  assert.equal(typeof calibration.buy,'undefined');
  assert.equal(typeof calibration.sell,'undefined');
  assert.equal(typeof calibration.execute,'undefined');

  // Project wiring / strict SHADOW contract.
  const shadow=fs.readFileSync(
    'src/token-intelligence-shadow-v23.mjs',
    'utf8'
  );

  const app=fs.readFileSync(
    'app-server.mjs',
    'utf8'
  );

  assert.match(
    shadow,
    /createShadowOutcomeCalibrationV23_11/
  );

  assert.match(
    shadow,
    /shadowOutcomeCalibration\.predict/
  );

  assert.match(
    shadow,
    /shadowOutcomeCalibration\.recordOutcome/
  );

  assert.match(
    shadow,
    /shadowOutcomeCalibration:shadowOutcomeCalibration\.status\(\)/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/outcome-calibration/
  );

  assert.match(
    app,
    /outcomeCalibrationHorizonReport/
  );

  const source=fs.readFileSync(
    'src/shadow-outcome-calibration-v23_11.mjs',
    'utf8'
  );

  assert.doesNotMatch(source,/from ['"]\.\/evaluate\.mjs['"]/);
  assert.doesNotMatch(source,/openPosition\s*\(/);
  assert.doesNotMatch(source,/closePosition\s*\(/);
  assert.doesNotMatch(source,/setSettings\s*\(/);
  assert.doesNotMatch(source,/tradeEligible/);
  assert.doesNotMatch(source,/decisionScore/);
  assert.doesNotMatch(source,/calibrationScore/);

  console.log('shadow outcome calibration v23.11 ok');
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}
