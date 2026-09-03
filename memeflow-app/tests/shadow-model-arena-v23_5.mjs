import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowModelArenaV23_5
} from '../src/shadow-model-arena-v23_5.mjs';

function learningRow({i,positive,mint}){
  const sign=positive?1:-1;

  return {
    type:'learning-example',
    mint,
    anchorAt:1_800_600_000_000+i*1_000,
    horizonMs:300_000,
    classification:positive?'POSITIVE':'NEGATIVE',
    quality:{clean:true},
    features:{
      netFlow5s:sign*(0.45+(i%5)*0.01),
      netFlow15s:sign*(0.85+(i%7)*0.01),
      tradesPerSecond5s:positive?3.8:0.7,
      priceReturn15s:positive?22+(i%4):-(18+(i%4)),
      priceVolatility15s:positive?0.025:0.065,
      priceEfficiency15s:positive?0.78:-0.5,
      uniqueBuyers15s:positive?15:3,
      buyPressure15s:positive?4.5:0.6,
      holderDelta:positive?28+(i%3):-(9+(i%3)),
      top10Pct:positive?15:36,
      developerPct:positive?2:9,
      mcToLiquidity:positive?7:27,
      drawdownFromPeakPct:positive?3:32,
      bundlePct:positive?2:20,
      suspectedRiskyWalletsPct:positive?3:24,
      buyerConcentrationHhi:positive?0.10:0.43,
      sameSlotBuySharePct:positive?7:70,
      smartMoneyStrongWalletSharePct:positive?38:3,
      smartMoneyPositiveProbabilityPct:positive?74:32,
      smartMoneyHistoricalConfidencePct:positive?62:18
    }
  };
}

// 200 unique tokens give all four chronological partitions enough examples.
const rows=[];
for(let i=0;i<200;i++){
  rows.push(
    learningRow({
      i,
      positive:i%2===0,
      mint:`ARENA_MINT_${i}`
    })
  );
}

const dataset={
  status(){
    return {
      acceptedRows:rows.length,
      cleanRows:rows.length
    };
  },
  trainingRows({limit=2000,horizonMs=300_000}={}){
    assert.equal(horizonMs,300_000);
    return rows.slice(-limit);
  }
};

const arena=createShadowModelArenaV23_5({
  learningDataset:dataset,
  minimumTrainRows:70,
  minimumPartitionRows:10,
  minimumClassRows:12
});

function snapshot(positive){
  const f=learningRow({
    i:999,
    positive,
    mint:'CURRENT'
  }).features;

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
        strongWalletSharePct:
          f.smartMoneyStrongWalletSharePct,
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
      }
    }
  };
}

const status=arena.status();

assert.equal(status.shadowOnly,true);
assert.equal(status.modelReady,true);
assert.equal(status.validated,true);
assert.ok(status.champion);
assert.equal(status.candidates.length,3);
assert.ok(
  status.candidates.every(
    row=>row.platt&&Number.isFinite(row.platt.a)
  )
);
assert.ok(
  status.candidates.some(
    row=>row.selected===true
  )
);

const champion=status.candidates.find(
  row=>row.selected===true
);

assert.ok(
  champion.final.brier<
  champion.final.baselineBrier
);
assert.ok(
  champion.final.logLoss<
  champion.final.baselineLogLoss
);

const good=arena.predict(snapshot(true));
const bad=arena.predict(snapshot(false));

assert.equal(good.status,'ARENA_VALIDATED');
assert.equal(good.validated,true);
assert.ok(good.champion);
assert.ok(
  good.calibratedProbabilityPositivePct>70
);
assert.ok(
  bad.calibratedProbabilityPositivePct<30
);
assert.ok(
  good.calibratedProbabilityPositivePct>
  bad.calibratedProbabilityPositivePct
);
assert.ok(good.featureCoveragePct>=80);

assert.equal(arena.listRecent({limit:10}).length,2);

// Cold-start contract.
const cold=createShadowModelArenaV23_5({
  learningDataset:{
    status:()=>({acceptedRows:4,cleanRows:4}),
    trainingRows:()=>rows.slice(0,4)
  }
});

const coldPrediction=cold.predict(snapshot(true));
assert.equal(coldPrediction.status,'COLD_START');
assert.equal(coldPrediction.modelReady,false);
assert.equal(
  coldPrediction.calibratedProbabilityPositivePct,
  null
);

// Project wiring and strict SHADOW isolation.
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
  /createShadowModelArenaV23_5/
);
assert.match(
  shadow,
  /shadowModelArena\.predict/
);
assert.match(
  shadow,
  /shadowModelArena:shadowModelArena\.status\(\)/
);
assert.match(
  app,
  /\/api\/owner\/intelligence\/shadow-model-arena/
);
assert.match(
  app,
  /shadowModelArenaStatus/
);
assert.match(
  app,
  /listShadowModelArenaPredictions/
);

const source=fs.readFileSync(
  'src/shadow-model-arena-v23_5.mjs',
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
assert.doesNotMatch(source,/arenaScore/);
assert.doesNotMatch(source,/decisionScore/);

console.log('shadow model arena v23.5 ok');
