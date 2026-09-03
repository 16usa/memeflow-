import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createShadowOutcomeReviewV23_16
} from '../src/shadow-outcome-review-v23_16.mjs';

const tmp=
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'mf-v23-16-'
    )
  );

function anchor({
  mint,
  at,
  probability=80,
  confidence=80,
  trajectory='RISING',
  disagreement=10,
  coordination=false,
  completeness=100
}){
  return {
    mint,
    at,
    stage:'DEEP',
    canonicalScore:70,
    priceSol:1,
    features:{
      evidence:{
        regime:'EXPANSION',
        dataQuality:{
          completenessPct:
            completeness
        }
      },
      specialists:{
        wallet:{
          topBuyerSolSharePct:20
        },
        coordination:{
          suspectedCoordination:
            coordination
        },
        smartMoneyMemory:{
          reputationReady:true,
          weightedPositiveProbabilityPct:
            72
        }
      },
      shadowTokenTrajectory:{
        trajectoryState:
          trajectory,
        turningPoint:false
      },
      shadowTokenPattern:{
        ready:true,
        patternProbabilityPositivePct:
          75
      },
      shadowDriftRegime:{
        status:'REGIME_READY',
        driftStatus:'STABLE'
      },
      shadowConfidenceGovernor:{
        ready:true,
        disagreementPct:
          disagreement,
        consensusProbabilityPositivePct:
          probability,
        ensembleConfidencePct:
          confidence
      },
      shadowEvidenceSynthesis:{
        ready:true,
        status:'SYNTHESIS_STRONG',
        direction:'BULLISH',
        synthesisProbabilityPositivePct:
          probability,
        synthesisConfidencePct:
          confidence,
        crossSourceDisagreementPct:
          disagreement,
        blockers:[]
      },
      shadowOutcomeCalibration:{
        ready:true,
        status:'CALIBRATION_HEALTHY',
        calibratedProbabilityPositivePct:
          probability,
        calibratedConfidencePct:
          confidence
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
        ? 40
        : -35,
    maxFavorableExcursionPct:
      positive
        ? 60
        : 5,
    maxAdverseExcursionPct:
      positive
        ? -5
        : -40,
    dead:false
  };
}

try{
  const review=
    createShadowOutcomeReviewV23_16({
      dataDir:tmp
    });

  const base=
    1_801_400_000_000;

  const hit=
    review.recordOutcome({
      anchor:
        anchor({
          mint:'HIT',
          at:base,
          probability:82,
          confidence:78
        }),
      outcome:
        outcome({
          mint:'HIT',
          at:base,
          positive:true
        })
    });

  assert.equal(
    hit.resultType,
    'TRUE_POSITIVE'
  );

  assert.equal(
    hit.hit,
    true
  );

  const miss=
    review.recordOutcome({
      anchor:
        anchor({
          mint:'MISS',
          at:base+1000,
          probability:84,
          confidence:82,
          trajectory:'FADING',
          disagreement:52,
          coordination:true,
          completeness:50
        }),
      outcome:
        outcome({
          mint:'MISS',
          at:base+1000,
          positive:false
        })
    });

  assert.equal(
    miss.resultType,
    'FALSE_POSITIVE'
  );

  assert.equal(
    miss.miss,
    true
  );

  assert.equal(
    miss.highConfidenceMiss,
    true
  );

  assert.ok(
    miss.attributionTags.includes(
      'HIGH_MODEL_DISAGREEMENT'
    )
  );

  assert.ok(
    miss.attributionTags.includes(
      'TRAJECTORY_FADING'
    )
  );

  assert.ok(
    miss.attributionTags.includes(
      'SUSPECTED_WALLET_COORDINATION'
    )
  );

  assert.ok(
    miss.attributionTags.includes(
      'LOW_DATA_COMPLETENESS'
    )
  );

  assert.ok(
    miss.attributionTags.includes(
      'HIGH_CONFIDENCE_MISS'
    )
  );

  const summary=
    review.summary({
      horizonMs:300_000
    });

  assert.equal(
    summary.scored,
    2
  );

  assert.equal(
    summary.hits,
    1
  );

  assert.equal(
    summary.misses,
    1
  );

  assert.equal(
    summary.falsePositives,
    1
  );

  assert.equal(
    summary.highConfidenceMisses,
    1
  );

  assert.equal(
    review.recent({
      missesOnly:true
    }).length,
    1
  );

  assert.equal(
    await review.flush(),
    true
  );

  const restored=
    createShadowOutcomeReviewV23_16({
      dataDir:tmp
    });

  assert.equal(
    restored.status().rowsLoaded,
    2
  );

  const source=
    fs.readFileSync(
      'src/shadow-outcome-review-v23_16.mjs',
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
    /createShadowOutcomeReviewV23_16/
  );

  assert.match(
    shadow,
    /shadowOutcomeReview\.recordOutcome/
  );

  assert.match(
    shadow,
    /outcomeReviewStatus/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/outcome-reviews/
  );

  assert.match(
    html,
    /id="outcomeReviewList"/
  );

  assert.match(
    js,
    /loadOutcomeReviews/
  );

  console.log(
    'shadow outcome review v23.16 ok'
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
