import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createLearningDatasetShadowV23_3,
  LEARNING_FEATURES_V23_3
} from '../src/learning-dataset-shadow-v23_3.mjs';

const dir=fs.mkdtempSync(
  path.join(os.tmpdir(),'mf-learning-v23-3-')
);

const learning=createLearningDatasetShadowV23_3({
  dataDir:dir,
  maxRows:1000
});

function snapshot({
  canonicalScore=80,
  opportunityScore=75,
  completeness=100,
  net5=0.3,
  net15=0.6,
  buyers=10,
  holderDelta=15,
  coord=5,
  smart=65
}={}){
  return {
    shadowOnly:true,
    windows:{
      '5000':{
        price:{
          returnPct:8,
          volatility:0.02,
          efficiency:0.7
        },
        flow:{
          uniqueBuyers:buyers,
          buyPressure:3,
          volumeSol:0.8
        }
      },
      '15000':{
        price:{
          returnPct:18,
          volatility:0.03,
          efficiency:0.75
        },
        flow:{
          uniqueBuyers:buyers,
          buyPressure:3.5,
          volumeSol:1.4
        }
      }
    },
    specialists:{
      wallet:{
        uniqueBuyerWallets:buyers,
        repeatBuyerWalletRatioPct:20,
        topBuyerSolSharePct:18,
        buyerConcentrationHhi:0.13
      },
      coordination:{
        sameSlotBuySharePct:coord,
        maxDistinctBuyers250ms:2,
        similarAmountBuySharePct:10
      },
      smartMoneyMemory:{
        strongWalletSharePct:25,
        weightedPositiveProbabilityPct:smart,
        historicalConfidencePct:55
      }
    },
    evidence:{
      flowAcceleration:{
        tradesPerSecond1s:4,
        tradesPerSecond5s:2,
        tradesPerSecond15s:1,
        netFlow5s:net5,
        netFlow15s:net15
      },
      regime:'EXPANSION',
      holders:{
        holderCount:150,
        holderDelta,
        top10Pct:18,
        developerPct:2
      },
      liquidity:{
        liquiditySol:10,
        marketCapSol:100,
        mcToLiquidity:10,
        bondingCurvePct:70
      },
      risk:{
        drawdownFromPeakPct:5,
        bundlePct:2,
        sniperPct:3,
        insidersPct:1,
        suspectedRiskyWalletsPct:4
      },
      sourceSignals:{
        canonicalScore,
        opportunityScore
      },
      dataQuality:{
        completenessPct:completeness
      }
    }
  };
}

function anchor(mint,opts={}){
  const features=snapshot(opts);
  return {
    mint,
    at:1_800_400_000_000,
    priceSol:0.001,
    stage:'DEEP',
    canonicalScore:
      features.evidence.sourceSignals.canonicalScore,
    opportunityScore:
      features.evidence.sourceSignals.opportunityScore,
    features
  };
}

function outcome({
  horizonMs=300_000,
  ret=40,
  mfe=70,
  mae=-8,
  lag=1000,
  dead=false
}={}){
  return {
    horizonMs,
    observedAt:1_800_400_300_000,
    observationLagMs:lag,
    returnPct:ret,
    maxFavorableExcursionPct:mfe,
    maxAdverseExcursionPct:mae,
    dead
  };
}

// Build enough independent positive + negative token coverage to make one
// feature report validation-ready.
for(let i=0;i<6;i++){
  const row=learning.recordOutcome({
    anchor:anchor(`POS${i}`,{
      net5:0.5+i*0.02,
      holderDelta:20+i,
      smart:70+i
    }),
    outcome:outcome({
      ret:30+i,
      mfe:60+i,
      mae:-5
    })
  });

  assert.ok(row);
  assert.equal(row.quality.clean,true);
  assert.equal(row.classification,'POSITIVE');
}

for(let i=0;i<6;i++){
  const row=learning.recordOutcome({
    anchor:anchor(`NEG${i}`,{
      net5:-0.4-i*0.02,
      holderDelta:-5-i,
      smart:35-i
    }),
    outcome:outcome({
      ret:-30-i,
      mfe:5,
      mae:-35
    })
  });

  assert.ok(row);
  assert.equal(row.quality.clean,true);
  assert.equal(row.classification,'NEGATIVE');
}

// Low-quality anchor is retained for audit but excluded from clean stats.
const dirty=learning.recordOutcome({
  anchor:anchor('DIRTY',{
    completeness:25
  }),
  outcome:outcome({
    ret:50,
    mfe:70,
    mae:-5
  })
});

assert.ok(dirty);
assert.equal(dirty.quality.clean,false);
assert.ok(
  dirty.quality.issues.includes('DATA_COMPLETENESS_LOW')
);

// Very late label is also auditable but not clean.
const late=learning.recordOutcome({
  anchor:anchor('LATE'),
  outcome:outcome({
    horizonMs:60_000,
    lag:80_000,
    ret:25,
    mfe:40,
    mae:-8
  })
});

assert.ok(late);
assert.equal(late.quality.clean,false);
assert.ok(
  late.quality.issues.includes('LABEL_LATE')
);

// Duplicate mint+anchor+horizon cannot double count.
assert.equal(
  learning.recordOutcome({
    anchor:anchor('POS0',{
      net5:0.5,
      holderDelta:20,
      smart:70
    }),
    outcome:outcome({
      ret:30,
      mfe:60,
      mae:-5
    })
  }),
  null
);

const report=learning.featureReport({
  limit:200,
  minimumTokens:5
});

const netFlow=report.find(
  row=>row.feature==='netFlow5s'
);

assert.ok(netFlow);
assert.equal(netFlow.validationReady,true);
assert.ok(netFlow.positive.mean>0);
assert.ok(netFlow.negative.mean<0);
assert.ok(netFlow.positiveMinusNegativeMean>0);

const status=learning.status();
assert.equal(status.shadowOnly,true);
assert.equal(
  status.trackedFeatures,
  Object.keys(LEARNING_FEATURES_V23_3).length
);
assert.equal(status.acceptedRows,14);
assert.equal(status.cleanRows,12);
assert.ok(status.cleanRatePct<100);
assert.ok(
  status.qualityIssues.some(
    row=>row.issue==='DATA_COMPLETENESS_LOW'
  )
);
assert.ok(
  status.qualityIssues.some(
    row=>row.issue==='LABEL_LATE'
  )
);

assert.equal(
  learning.recent({clean:true,limit:100}).length,
  12
);

assert.equal(await learning.flush(),true);

// Persistence can rebuild the dataset/statistics after restart.
const reloaded=createLearningDatasetShadowV23_3({
  dataDir:dir,
  maxRows:1000
});
await reloaded.whenHydrated();

assert.equal(
  reloaded.status().acceptedRows,
  status.acceptedRows
);

const reloadedNet=reloaded
  .featureReport({
    limit:200,
    minimumTokens:5
  })
  .find(row=>row.feature==='netFlow5s');

assert.ok(reloadedNet);
assert.equal(
  reloadedNet.positiveMinusNegativeMean,
  netFlow.positiveMinusNegativeMean
);

// Source wiring / strict shadow contract.
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
  /createLearningDatasetShadowV23_3/
);
assert.match(
  shadow,
  /learningDataset\.recordOutcome/
);
assert.match(
  shadow,
  /learningDataset:learningDataset\.status\(\)/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/learning-dataset/
);
assert.match(
  app,
  /\/api\/owner\/intelligence\/learning-features/
);
assert.match(
  app,
  /listLearningRows/
);
assert.match(
  app,
  /learningFeatureReport/
);

const source=fs.readFileSync(
  'src/learning-dataset-shadow-v23_3.mjs',
  'utf8'
);

assert.doesNotMatch(
  source,
  /from ['"]\.\/evaluate\.mjs['"]/
);
assert.doesNotMatch(source,/openPosition\s*\(/);
assert.doesNotMatch(source,/closePosition\s*\(/);
assert.doesNotMatch(source,/tradeEligible/);
assert.doesNotMatch(source,/learningScore/);

console.log('learning dataset shadow v23.3 ok');
