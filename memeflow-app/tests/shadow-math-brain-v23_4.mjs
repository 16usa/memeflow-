import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowMathBrainV23_4,
  SHADOW_BRAIN_FEATURES_V23_4
} from '../src/shadow-math-brain-v23_4.mjs';

function learningRow({
  i,
  positive,
  mint
}){
  const sign=positive?1:-1;
  return {
    type:'learning-example',
    mint,
    anchorAt:1_800_500_000_000+i*1_000,
    horizonMs:300_000,
    classification:positive?'POSITIVE':'NEGATIVE',
    quality:{clean:true},
    features:{
      netFlow5s:sign*(0.4+(i%5)*0.02),
      netFlow15s:sign*(0.8+(i%7)*0.02),
      tradesPerSecond5s:positive?3.5:0.8,
      priceReturn15s:positive?20+(i%4):-(15+(i%4)),
      priceVolatility15s:positive?0.03:0.06,
      priceEfficiency15s:positive?0.75:-0.45,
      uniqueBuyers15s:positive?14:4,
      buyPressure15s:positive?4.2:0.7,
      holderDelta:positive?25+(i%3):-(8+(i%3)),
      top10Pct:positive?16:34,
      developerPct:positive?2:8,
      mcToLiquidity:positive?8:25,
      drawdownFromPeakPct:positive?4:30,
      bundlePct:positive?2:18,
      suspectedRiskyWalletsPct:positive?3:22,
      buyerConcentrationHhi:positive?0.12:0.40,
      sameSlotBuySharePct:positive?8:65,
      smartMoneyStrongWalletSharePct:positive?35:4,
      smartMoneyPositiveProbabilityPct:positive?72:35,
      smartMoneyHistoricalConfidencePct:positive?60:20
    }
  };
}

// Alternating labels across time keep both classes represented in the
// chronological holdout while maintaining a very learnable synthetic signal.
const rows=[];
for(let i=0;i<120;i++){
  const positive=i%2===0;
  rows.push(
    learningRow({
      i,
      positive,
      mint:`MINT_${i}`
    })
  );
}

let acceptedRows=rows.length;
const dataset={
  status(){
    return {
      acceptedRows,
      cleanRows:acceptedRows
    };
  },
  trainingRows({limit=1200,horizonMs=300_000}={}){
    assert.equal(horizonMs,300_000);
    return rows.slice(-limit);
  }
};

const brain=createShadowMathBrainV23_4({
  learningDataset:dataset,
  minimumTrainRows:40,
  minimumValidationRows:10,
  minimumClassRows:8,
  maxTrainingRows:1200
});

function currentSnapshot(positive){
  const row=learningRow({
    i:999,
    positive,
    mint:'CURRENT'
  });

  const f=row.features;

  return {
    mint:'CURRENT',
    windows:{
      '15000':{
        price:{
          returnPct:f.priceReturn15s,
          volatility:f.priceVolatility15s,
          efficiency:f.priceEfficiency15s
        },
        flow:{
          uniqueBuyers:f.uniqueBuyers15s,
          buyPressure:f.buyPressure15s
        }
      }
    },
    specialists:{
      wallet:{
        buyerConcentrationHhi:f.buyerConcentrationHhi
      },
      coordination:{
        sameSlotBuySharePct:f.sameSlotBuySharePct
      },
      smartMoneyMemory:{
        strongWalletSharePct:f.smartMoneyStrongWalletSharePct,
        weightedPositiveProbabilityPct:
          f.smartMoneyPositiveProbabilityPct,
        historicalConfidencePct:
          f.smartMoneyHistoricalConfidencePct
      }
    },
    evidence:{
      flowAcceleration:{
        tradesPerSecond5s:f.tradesPerSecond5s,
        netFlow5s:f.netFlow5s,
        netFlow15s:f.netFlow15s
      },
      holders:{
        holderDelta:f.holderDelta,
        top10Pct:f.top10Pct,
        developerPct:f.developerPct
      },
      liquidity:{
        mcToLiquidity:f.mcToLiquidity
      },
      risk:{
        drawdownFromPeakPct:f.drawdownFromPeakPct,
        bundlePct:f.bundlePct,
        suspectedRiskyWalletsPct:
          f.suspectedRiskyWalletsPct
      },
      dataQuality:{
        completenessPct:100
      }
    }
  };
}

const status=brain.status();
assert.equal(status.shadowOnly,true);
assert.equal(status.modelReady,true);
assert.equal(status.validated,true);
assert.equal(status.target,'P(POSITIVE_5M)');
assert.equal(status.modelType,'L2_LOGISTIC_REGRESSION');
assert.equal(
  status.configuredFeatures,
  SHADOW_BRAIN_FEATURES_V23_4.length
);
assert.ok(status.validation.brier<status.validation.baselineBrier);
assert.ok(status.validation.logLoss<status.validation.baselineLogLoss);

const good=brain.predict(currentSnapshot(true));
const bad=brain.predict(currentSnapshot(false));

assert.equal(good.shadowOnly,true);
assert.equal(good.modelReady,true);
assert.equal(good.validated,true);
assert.equal(good.status,'SHADOW_VALIDATED');
assert.ok(good.probabilityPositivePct>70);
assert.ok(good.featureCoveragePct>=80);

assert.equal(bad.status,'SHADOW_VALIDATED');
assert.ok(bad.probabilityPositivePct<30);
assert.ok(good.probabilityPositivePct>bad.probabilityPositivePct);

assert.equal(brain.listRecent({limit:10}).length,2);

// Cold-start must return no probability authority.
const cold=createShadowMathBrainV23_4({
  learningDataset:{
    status:()=>({acceptedRows:2,cleanRows:2}),
    trainingRows:()=>rows.slice(0,2)
  }
});

const coldPrediction=cold.predict(currentSnapshot(true));
assert.equal(coldPrediction.status,'COLD_START');
assert.equal(coldPrediction.modelReady,false);
assert.equal(coldPrediction.probabilityPositivePct,null);

// Project wiring and shadow isolation contracts.
const shadow=fs.readFileSync(
  'src/token-intelligence-shadow-v23.mjs',
  'utf8'
);
const app=fs.readFileSync(
  'app-server.mjs',
  'utf8'
);
const learning=fs.readFileSync(
  'src/learning-dataset-shadow-v23_3.mjs',
  'utf8'
);

assert.match(shadow,/createShadowMathBrainV23_4/);
assert.match(shadow,/shadowMathBrain\.predict/);
assert.match(shadow,/shadowMathBrain:shadowMathBrain\.status\(\)/);
assert.match(learning,/function trainingRows\(/);

assert.match(
  app,
  /\/api\/owner\/intelligence\/shadow-brain/
);
assert.match(
  app,
  /shadowBrainStatus/
);
assert.match(
  app,
  /listShadowBrainPredictions/
);

const source=fs.readFileSync(
  'src/shadow-math-brain-v23_4.mjs',
  'utf8'
);

assert.doesNotMatch(
  source,
  /from ['"]\.\/evaluate\.mjs['"]/
);
assert.doesNotMatch(source,/openPosition\s*\(/);
assert.doesNotMatch(source,/closePosition\s*\(/);
assert.doesNotMatch(source,/setSettings\s*\(/);
assert.doesNotMatch(source,/tradeEligible/);
assert.doesNotMatch(source,/decisionScore/);
assert.doesNotMatch(source,/brainScore/);

console.log('shadow mathematical brain v23.4 ok');
