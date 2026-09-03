import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowPromotionReportV23_14
} from '../src/shadow-promotion-report-v23_14.mjs';

function providers({
  gateStatus='PROMOTION_EVIDENCE_BUILDING',
  candidate=false,
  paired=55,
  positive=28,
  negative=27,
  failed=['PAIRED_5M_SAMPLE'],
  verdict='BENCHMARK_INCONCLUSIVE',
  brierDelta=0.004,
  logLossDelta=0.008,
  accuracyDelta=1,
  calibration='CALIBRATION_LEARNING',
  ece=12,
  drift='STABLE'
}={}){
  const checks=[
    {
      name:'PAIRED_5M_SAMPLE',
      pass:!failed.includes('PAIRED_5M_SAMPLE'),
      actual:paired,
      required:'>=100'
    },
    {
      name:'CALIBRATION_HEALTH',
      pass:!failed.includes('CALIBRATION_HEALTH'),
      actual:calibration,
      required:'CALIBRATION_HEALTHY'
    }
  ];

  return {
    promotionGate:{
      status(){
        return {
          status:gateStatus,
          automaticPromotion:false,
          candidateForManualReview:candidate,
          checks
        };
      }
    },
    championBenchmark:{
      status(){
        return {
          target:{
            pairedRows:paired,
            positive,
            negative,
            v22:{
              meanBrier:0.24,
              meanLogLoss:0.68,
              accuracyPct:58
            },
            v23:{
              meanBrier:0.20,
              meanLogLoss:0.61,
              accuracyPct:63
            },
            delta:{
              brier:brierDelta,
              logLoss:logLossDelta,
              accuracyPct:accuracyDelta
            },
            pairedWins:{
              v22:20,
              v23:30,
              ties:5
            },
            verdict:{
              status:verdict
            }
          }
        };
      }
    },
    outcomeCalibration:{
      status(){
        return {
          targetScoredRows:paired,
          targetStatus:calibration,
          targetAccuracyPct:63,
          targetEcePct:ece,
          targetBrier:0.20,
          targetLogLoss:0.61
        };
      }
    },
    driftRegime:{
      status(){
        return {
          drift:{
            status:drift,
            ready:true
          }
        };
      }
    },
    evidenceSynthesis:{
      status(){
        return {
          predictions:90,
          coldStarts:10,
          conflicts:4,
          errors:0
        };
      }
    }
  };
}

{
  const monitor=
    createShadowPromotionReportV23_14(
      providers()
    );

  const report=
    monitor.report();

  assert.equal(
    report.tradingAuthority,
    'V22'
  );

  assert.equal(
    report.automaticPromotion,
    false
  );

  assert.equal(
    report.sample.paired5m,
    55
  );

  assert.equal(
    report.sample.requiredPaired5m,
    100
  );

  assert.ok(
    report.readinessPct>0 &&
    report.readinessPct<100
  );

  assert.equal(
    report.gate.primaryBlocker,
    'PAIRED_5M_SAMPLE'
  );

  assert.equal(
    report.safety.buySellMutation,
    false
  );
}

{
  const monitor=
    createShadowPromotionReportV23_14(
      providers({
        gateStatus:'PROMOTION_CANDIDATE',
        candidate:true,
        paired:140,
        positive:70,
        negative:70,
        failed:[],
        verdict:'V23_CHALLENGER_WINS',
        brierDelta:0.02,
        logLossDelta:0.04,
        accuracyDelta:4,
        calibration:'CALIBRATION_HEALTHY',
        ece:5
      })
    );

  const report=
    monitor.report();

  assert.equal(
    report.status,
    'PROMOTION_CANDIDATE'
  );

  assert.equal(
    report.statusLabel,
    'READY FOR MANUAL REVIEW'
  );

  assert.equal(
    report.candidateForManualReview,
    true
  );

  assert.equal(
    report.readinessPct,
    100
  );
}

const source=
  fs.readFileSync(
    'src/shadow-promotion-report-v23_14.mjs',
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
  /createShadowPromotionReportV23_14/
);

assert.match(
  shadow,
  /promotionReportStatus/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/promotion-report/
);

assert.match(
  html,
  /id="promotionReadiness"/
);

assert.match(
  html,
  /id="promotionChecks"/
);

assert.match(
  js,
  /loadPromotionReport/
);

assert.match(
  js,
  /\/api\/owner\/intelligence\/promotion-report/
);

console.log(
  'shadow promotion report v23.14 ok'
);
