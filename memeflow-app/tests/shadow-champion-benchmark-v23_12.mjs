import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createShadowChampionBenchmarkV23_12
} from '../src/shadow-champion-benchmark-v23_12.mjs';

const tmp=fs.mkdtempSync(
  path.join(os.tmpdir(),'mf-v23-12-')
);

function anchor({
  mint,
  at,
  canonicalScore,
  v23Probability,
  calibrated=true,
  confidence=75
}){
  return {
    mint,
    at,
    canonicalScore,
    features:{
      shadowEvidenceSynthesis:{
        ready:true,
        status:'SYNTHESIS_MODERATE',
        synthesisProbabilityPositivePct:v23Probability,
        synthesisConfidencePct:confidence
      },
      shadowOutcomeCalibration:{
        ready:calibrated,
        status:calibrated?'CALIBRATION_HEALTHY':'CALIBRATION_LEARNING',
        calibratedProbabilityPositivePct:calibrated?v23Probability:null,
        calibratedConfidencePct:calibrated?confidence:0
      }
    }
  };
}

function outcome({mint,at,positive,horizonMs=300_000}){
  return {
    mint,
    observedAt:at+horizonMs,
    horizonMs,
    returnPct:positive?35:-30,
    maxFavorableExcursionPct:positive?60:5,
    maxAdverseExcursionPct:positive?-5:-35,
    dead:false
  };
}

try{
  const benchmark=createShadowChampionBenchmarkV23_12({
    dataDir:tmp
  });

  const base=1_801_300_000_000;

  for(let i=0;i<60;i++){
    const positive=i<30;
    const mint=`PAIR_${i}`;
    const at=base+i*1000;

    assert.ok(
      benchmark.recordOutcome({
        anchor:anchor({
          mint,
          at,
          canonicalScore:positive?58:42,
          v23Probability:positive?80:20,
          calibrated:i%2===0
        }),
        outcome:outcome({mint,at,positive})
      })
    );
  }

  const report=benchmark.report({
    horizonMs:300_000
  });

  assert.equal(report.pairedRows,60);
  assert.equal(report.positive,30);
  assert.equal(report.negative,30);

  assert.ok(report.v23.meanBrier<report.v22.meanBrier);
  assert.ok(report.v23.meanLogLoss<report.v22.meanLogLoss);

  assert.equal(
    report.verdict.status,
    'V23_CHALLENGER_WINS'
  );

  assert.equal(
    report.verdict.promotionEligible,
    true
  );

  benchmark.recordOutcome({
    anchor:anchor({
      mint:'ONE_MINUTE',
      at:base+100_000,
      canonicalScore:55,
      v23Probability:70
    }),
    outcome:outcome({
      mint:'ONE_MINUTE',
      at:base+100_000,
      positive:true,
      horizonMs:60_000
    })
  });

  assert.equal(
    benchmark.report({horizonMs:60_000}).verdict.status,
    'DIAGNOSTIC_HORIZON_ONLY'
  );

  const recent=benchmark.listRecent({limit:100});

  assert.ok(
    recent.some(row=>row.v23ProbabilitySource==='V23_11_CALIBRATED')
  );

  assert.ok(
    recent.some(row=>row.v23ProbabilitySource==='V23_10_SYNTHESIS')
  );

  assert.equal(await benchmark.flush(),true);

  const restored=createShadowChampionBenchmarkV23_12({
    dataDir:tmp
  });
  await restored.whenHydrated();

  assert.ok(restored.status().rowsLoaded>=60);

  assert.equal(typeof benchmark.buy,'undefined');
  assert.equal(typeof benchmark.sell,'undefined');
  assert.equal(typeof benchmark.execute,'undefined');

  // Project wiring / strict SHADOW contract.
  const shadow=fs.readFileSync(
    'src/token-intelligence-shadow-v23.mjs',
    'utf8'
  );

  const app=fs.readFileSync(
    'app-server.mjs',
    'utf8'
  );

  assert.match(shadow,/createShadowChampionBenchmarkV23_12/);
  assert.match(shadow,/shadowChampionBenchmark\.recordOutcome/);
  assert.match(shadow,/shadowChampionBenchmark:shadowChampionBenchmark\.status\(\)/);

  assert.match(app,/\/api\/owner\/intelligence\/champion-benchmark/);
  assert.match(app,/championBenchmarkHorizonReport/);

  const source=fs.readFileSync(
    'src/shadow-champion-benchmark-v23_12.mjs',
    'utf8'
  );

  assert.doesNotMatch(source,/from ['"]\.\/evaluate\.mjs['"]/);
  assert.doesNotMatch(source,/openPosition\s*\(/);
  assert.doesNotMatch(source,/closePosition\s*\(/);
  assert.doesNotMatch(source,/setSettings\s*\(/);
  assert.doesNotMatch(source,/tradeEligible/);
  assert.doesNotMatch(source,/decisionScore/);
  assert.doesNotMatch(source,/benchmarkScore/);

  console.log('shadow champion benchmark v23.12 ok');
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}
