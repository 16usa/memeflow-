import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createShadowErrorAwareBenchmarkV23_19
} from '../src/shadow-error-aware-benchmark-v23_19.mjs';

const tmp=
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'mf-v23-19-'
    )
  );

function anchor({
  mint,
  at,
  probability,
  rawConfidence=80,
  adjustedConfidence=40,
  penalty=50
}){
  return {
    mint,
    at,
    features:{
      shadowErrorAwareConfidence:{
        status:
          penalty>0
            ? 'PENALTY_APPLIED'
            : 'NO_PATTERN_MATCH',
        probabilityPositivePct:
          probability,
        rawConfidencePct:
          rawConfidence,
        adjustedConfidencePct:
          adjustedConfidence,
        penaltyPct:
          penalty,
        forecastSource:
          'V23_11_CALIBRATED'
      }
    }
  };
}

function outcome({
  mint,
  at,
  positive,
  horizonMs=300_000
}){
  return {
    mint,
    observedAt:
      at+horizonMs,
    horizonMs,
    returnPct:
      positive
        ? 35
        : -35,
    maxFavorableExcursionPct:
      positive
        ? 55
        : 5,
    maxAdverseExcursionPct:
      positive
        ? -5
        : -40,
    dead:false
  };
}

try{
  const bench=
    createShadowErrorAwareBenchmarkV23_19({
      dataDir:tmp
    });

  const base=
    1_801_700_000_000;

  // 120 paired rows, 60 positive / 60 negative.
  // Raw V23 is deliberately overconfident; challenger shrinks toward 50.
  for(let i=0;i<120;i++){
    const positive=i<60;
    const wrong=
      i%5<2;

    const probability=
      positive
        ? (wrong?20:80)
        : (wrong?80:20);

    const at=
      base+i*1000;

    const a=
      anchor({
        mint:`MINT_${i}`,
        at,
        probability,
        rawConfidence:85,
        adjustedConfidence:42.5,
        penalty:50
      });

    const o=
      outcome({
        mint:`MINT_${i}`,
        at,
        positive
      });

    const row=
      bench.recordOutcome({
        anchor:a,
        outcome:o
      });

    assert.ok(row);
    assert.equal(
      row.rawProbabilityPct,
      probability
    );
    assert.ok(
      Math.abs(
        row.challengerProbabilityPct-(
          50+(probability-50)*0.5
        )
      )<1e-9
    );
  }

  const report=
    bench.report({
      horizonMs:300_000
    });

  assert.equal(
    report.pairedRows,
    120
  );

  assert.equal(
    report.positive,
    60
  );

  assert.equal(
    report.negative,
    60
  );

  assert.ok(
    report.challenger.meanBrier<
    report.raw.meanBrier
  );

  assert.ok(
    report.challenger.meanLogLoss<
    report.raw.meanLogLoss
  );

  assert.ok(
    report.delta.ecePct>=0
  );

  assert.equal(
    report.liveProbabilityMutation,
    false
  );

  assert.equal(
    report.benchmarkDerivedProbabilityOnly,
    true
  );

  assert.equal(
    report.autoPromotion,
    false
  );

  assert.equal(
    report.verdict.status,
    'ERROR_AWARE_CHALLENGER_WINS'
  );

  assert.equal(
    report.verdict.reviewEligible,
    true
  );

  assert.equal(
    await bench.flush(),
    true
  );

  const restored=
    createShadowErrorAwareBenchmarkV23_19({
      dataDir:tmp
    });

  assert.equal(
    restored.status().rowsLoaded,
    120
  );

  const source=
    fs.readFileSync(
      'src/shadow-error-aware-benchmark-v23_19.mjs',
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
    /createShadowErrorAwareBenchmarkV23_19/
  );

  assert.match(
    shadow,
    /shadowErrorAwareBenchmark\.recordOutcome/
  );

  assert.match(
    shadow,
    /errorAwareBenchmarkStatus/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/error-aware-benchmark/
  );

  assert.match(
    html,
    /id="errorAwareBenchmarkVerdict"/
  );

  assert.match(
    js,
    /loadErrorAwareBenchmark/
  );

  console.log(
    'shadow error-aware benchmark v23.19 ok'
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
