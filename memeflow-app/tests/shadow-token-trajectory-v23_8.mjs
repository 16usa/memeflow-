import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createShadowTokenTrajectoryMemoryV23_8
} from '../src/shadow-token-trajectory-v23_8.mjs';

const tmp=
  fs.mkdtempSync(
    path.join(os.tmpdir(),'mf-v23-8-')
  );

function snapshot({
  mint='T1',
  at,
  probability,
  confidence,
  disagreement=5,
  regime='EXPANSION',
  drift='STABLE',
  flow=0.2,
  priceReturn=2,
  smartMoney=70
}){
  return {
    mint,
    observedAt:at,
    stage:'DEEP',
    windows:{
      '15000':{
        price:{
          returnPct:priceReturn,
          volatility:0.03
        },
        flow:{
          uniqueBuyers:12
        }
      }
    },
    specialists:{
      coordination:{
        suspectedCoordination:false
      },
      smartMoneyMemory:{
        reputationReady:true,
        readyWallets:3,
        weightedPositiveProbabilityPct:smartMoney,
        historicalConfidencePct:65
      }
    },
    evidence:{
      regime,
      flowAcceleration:{
        netFlow5s:flow,
        netFlow15s:flow*2
      },
      holders:{
        holderDelta:10
      },
      dataQuality:{
        completenessPct:100
      }
    },
    shadowConfidenceGovernor:{
      status:
        disagreement>=20
          ? 'HIGH_DISAGREEMENT'
          : 'MODERATE_CONFIDENCE',
      ready:true,
      consensusProbabilityPositivePct:probability,
      ensembleConfidencePct:confidence,
      disagreementPct:disagreement,
      agreementPct:100-disagreement*2,
      effectiveSourceCount:2.8
    },
    shadowDriftRegime:{
      driftStatus:drift
    }
  };
}

try{
  const memory=
    createShadowTokenTrajectoryMemoryV23_8({
      dataDir:tmp,
      maxMints:10,
      maxPointsPerMint:20,
      persistIntervalMs:1_000
    });

  const base=1_800_800_000_000;

  let row=
    memory.observe(
      snapshot({
        at:base,
        probability:52,
        confidence:42,
        flow:0.1
      })
    );

  assert.equal(
    row.trajectoryState,
    'STABLE'
  );

  memory.observe(
    snapshot({
      at:base+8_000,
      probability:60,
      confidence:50,
      flow:0.2
    })
  );

  row=
    memory.observe(
      snapshot({
        at:base+18_000,
        probability:73,
        confidence:58,
        flow:0.4
      })
    );

  assert.equal(
    row.trajectoryState,
    'RISING'
  );

  assert.ok(
    row.probabilityDeltaWindow>=20
  );

  const conflict=
    memory.observe(
      snapshot({
        at:base+20_000,
        probability:70,
        confidence:55,
        disagreement:28
      })
    );

  assert.equal(
    conflict.trajectoryState,
    'CONFLICTED'
  );

  const drifted=
    memory.observe(
      snapshot({
        at:base+22_000,
        probability:68,
        confidence:20,
        drift:'DRIFT'
      })
    );

  assert.equal(
    drifted.trajectoryState,
    'DRIFTED'
  );

  const positive=
    memory.recordOutcome({
      anchor:{
        mint:'T1',
        at:base,
        features:{
          shadowConfidenceGovernor:{
            status:'MODERATE_CONFIDENCE',
            consensusProbabilityPositivePct:80,
            ensembleConfidencePct:70
          }
        }
      },
      outcome:{
        mint:'T1',
        observedAt:base+300_000,
        horizonMs:300_000,
        returnPct:35,
        maxFavorableExcursionPct:60,
        maxAdverseExcursionPct:-10,
        dead:false
      }
    });

  assert.equal(
    positive.classification,
    'POSITIVE'
  );

  assert.equal(
    positive.scored,
    true
  );

  assert.equal(
    positive.correct,
    true
  );

  assert.ok(
    positive.brier<0.05
  );

  const inspected=
    memory.inspect('T1');

  assert.equal(
    inspected.currentState,
    'DRIFTED'
  );

  assert.ok(
    inspected.turningPoints>=2
  );

  assert.equal(
    inspected.forecastQuality.scored,
    1
  );

  assert.equal(
    inspected.horizonQuality[0].horizonMs,
    300_000
  );

  const listed=
    memory.list({
      limit:10,
      state:'DRIFTED'
    });

  assert.equal(listed.length,1);
  assert.equal(listed[0].mint,'T1');

  const bounded=
    createShadowTokenTrajectoryMemoryV23_8({
      maxMints:2
    });

  for(const mint of ['A','B','C']){
    bounded.observe(
      snapshot({
        mint,
        at:
          base+
          (
            mint.charCodeAt(0)-65
          )*1_000,
        probability:50,
        confidence:40
      }),
      {mint}
    );
  }

  assert.ok(
    bounded.status().trajectories<=2
  );

  assert.ok(
    bounded.status().evictions>=1
  );

  assert.equal(
    await memory.flush(),
    true
  );

  const restored=
    createShadowTokenTrajectoryMemoryV23_8({
      dataDir:tmp
    });
  await restored.whenHydrated();

  const restoredCell=
    restored.inspect('T1');

  assert.ok(restoredCell);

  assert.ok(
    restored.status().rowsLoaded>=1
  );

  assert.equal(
    restoredCell.forecastQuality.scored,
    1
  );

  assert.equal(
    typeof memory.buy,
    'undefined'
  );

  assert.equal(
    typeof memory.sell,
    'undefined'
  );

  assert.equal(
    typeof memory.execute,
    'undefined'
  );

  // Project wiring / strict SHADOW contract.
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

  assert.match(
    shadow,
    /createShadowTokenTrajectoryMemoryV23_8/
  );

  assert.match(
    shadow,
    /shadowTokenTrajectory\.observe/
  );

  assert.match(
    shadow,
    /shadowTokenTrajectory\.recordOutcome/
  );

  assert.match(
    shadow,
    /shadowTokenTrajectory:shadowTokenTrajectory\.status\(\)/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/token-trajectories/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/token-trajectory/
  );

  const source=
    fs.readFileSync(
      'src/shadow-token-trajectory-v23_8.mjs',
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

  assert.doesNotMatch(
    source,
    /trajectoryScore/
  );

  console.log(
    'shadow token trajectory v23.8 ok'
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
