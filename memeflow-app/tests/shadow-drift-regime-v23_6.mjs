import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowDriftRegimeV23_6
} from '../src/shadow-drift-regime-v23_6.mjs';

function row({
  i,
  positive,
  regime='EXPANSION',
  shift=0
}){
  const sign=positive?1:-1;

  return {
    type:'learning-example',
    mint:`R_${regime}_${i}`,
    anchorAt:1_800_700_000_000+i*1000,
    horizonMs:300_000,
    regimeAtAnchor:regime,
    classification:positive?'POSITIVE':'NEGATIVE',
    quality:{clean:true},
    features:{
      netFlow5s:sign*(0.5+shift),
      netFlow15s:sign*(0.9+shift),
      priceReturn15s:sign*(20+shift*10),
      priceVolatility15s:positive?0.03:0.06,
      priceEfficiency15s:positive?0.8:-0.5,
      uniqueBuyers15s:positive?16:4,
      holderDelta:positive?25:-8,
      mcToLiquidity:positive?8:24,
      drawdownFromPeakPct:positive?4:30,
      buyerConcentrationHhi:positive?0.12:0.42,
      sameSlotBuySharePct:positive?8:65,
      smartMoneyPositiveProbabilityPct:
        positive?72:34
    }
  };
}

const stableRows=[];

// Two regimes, each with enough rows and balanced outcomes.
for(let i=0;i<80;i++){
  stableRows.push(
    row({
      i,
      positive:i%2===0,
      regime:'EXPANSION'
    })
  );
}
for(let i=80;i<160;i++){
  stableRows.push(
    row({
      i,
      positive:i%2===0,
      regime:'CHOP'
    })
  );
}

const dataset={
  status:()=>({
    acceptedRows:stableRows.length,
    cleanRows:stableRows.length
  }),
  trainingRows:()=>stableRows
};

const monitor=createShadowDriftRegimeV23_6({
  learningDataset:dataset
});

const status=monitor.status();
assert.equal(status.shadowOnly,true);
assert.equal(status.preparedRows,160);
assert.ok(
  ['STABLE','WATCH'].includes(status.drift.status)
);
assert.ok(
  status.regimes.some(
    r=>r.regime==='EXPANSION'&&r.ready===true
  )
);
assert.ok(
  status.regimes.some(
    r=>r.regime==='CHOP'&&r.ready===true
  )
);

function snapshot(positive=true,regime='EXPANSION'){
  const f=row({
    i:999,
    positive,
    regime
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
          uniqueBuyers:f.uniqueBuyers15s
        }
      }
    },
    specialists:{
      wallet:{
        buyerConcentrationHhi:
          f.buyerConcentrationHhi
      },
      coordination:{
        sameSlotBuySharePct:
          f.sameSlotBuySharePct
      },
      smartMoneyMemory:{
        weightedPositiveProbabilityPct:
          f.smartMoneyPositiveProbabilityPct
      }
    },
    evidence:{
      regime,
      flowAcceleration:{
        netFlow5s:f.netFlow5s,
        netFlow15s:f.netFlow15s
      },
      holders:{
        holderDelta:f.holderDelta
      },
      liquidity:{
        mcToLiquidity:f.mcToLiquidity
      },
      risk:{
        drawdownFromPeakPct:
          f.drawdownFromPeakPct
      }
    }
  };
}

const good=monitor.predict(
  snapshot(true,'EXPANSION')
);
const bad=monitor.predict(
  snapshot(false,'EXPANSION')
);

assert.equal(good.regimeModelReady,true);
assert.ok(good.probabilityPositivePct>bad.probabilityPositivePct);
assert.equal(good.currentRegime,'EXPANSION');
assert.ok(good.featureCoveragePct>=80);

// Unknown regime must never borrow another regime model silently.
const unknown=monitor.predict(
  snapshot(true,'PANIC')
);
assert.equal(unknown.regimeModelReady,false);
assert.equal(
  unknown.probabilityPositivePct,
  null
);

// Synthetic distribution shift should trigger drift.
const driftRows=[];
for(let i=0;i<120;i++){
  driftRows.push(
    row({
      i,
      positive:i%2===0,
      regime:'EXPANSION',
      shift:0
    })
  );
}
for(let i=120;i<160;i++){
  const r=row({
    i,
    positive:i%2===0,
    regime:'EXPANSION',
    shift:4
  });
  // Force obvious recent feature shift regardless of class sign.
  r.features.netFlow5s+=8;
  r.features.netFlow15s+=10;
  r.features.priceReturn15s+=80;
  driftRows.push(r);
}

const driftMonitor=createShadowDriftRegimeV23_6({
  learningDataset:{
    status:()=>({
      acceptedRows:driftRows.length,
      cleanRows:driftRows.length
    }),
    trainingRows:()=>driftRows
  }
});

const driftStatus=driftMonitor.status();
assert.equal(driftStatus.drift.status,'DRIFT');
assert.ok(driftStatus.drift.maxFeatureShift>=1.25);

const driftPrediction=driftMonitor.predict(
  snapshot(true,'EXPANSION')
);

if(driftPrediction.regimeModelReady){
  assert.equal(
    driftPrediction.regimeModelValidated,
    false
  );
  assert.equal(
    driftPrediction.status,
    'REGIME_DRIFTED'
  );
}

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
  /createShadowDriftRegimeV23_6/
);
assert.match(
  shadow,
  /shadowDriftRegime\.predict/
);
assert.match(
  shadow,
  /shadowDriftRegime:shadowDriftRegime\.status\(\)/
);
assert.match(
  app,
  /\/api\/owner\/intelligence\/shadow-drift-regime/
);
assert.match(
  app,
  /shadowDriftRegimeStatus/
);
assert.match(
  app,
  /listShadowDriftRegimePredictions/
);

const source=fs.readFileSync(
  'src/shadow-drift-regime-v23_6.mjs',
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
assert.doesNotMatch(source,/regimeScore/);
assert.doesNotMatch(source,/decisionScore/);

console.log('shadow drift regime v23.6 ok');
