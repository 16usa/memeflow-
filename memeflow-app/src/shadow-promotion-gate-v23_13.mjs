// MEMEFLOW_SHADOW_PROMOTION_GATE_V23_13
// SHADOW ONLY. Manual review readiness only. Never promotes or trades.

const num=v=>{
  const n=Number(v);
  return Number.isFinite(n)?n:null;
};
const up=v=>String(v||'UNKNOWN').trim().toUpperCase()||'UNKNOWN';
const check=(name,pass,actual,required)=>({
  name,
  pass:pass===true,
  actual:actual??null,
  required
});

export function createShadowPromotionGateV23_13({
  championBenchmark=null,
  outcomeCalibration=null,
  driftRegime=null
}={}){
  let evaluations=0;
  let errors=0;

  function evaluate(){
    try{
      const bs=championBenchmark?.status?.()||{};
      const target=bs?.target||{};
      const verdict=up(target?.verdict?.status);

      const cs=outcomeCalibration?.status?.()||{};
      const calibrationStatus=up(cs?.targetStatus);
      const ece=num(cs?.targetEcePct);

      const ds=driftRegime?.status?.()||{};
      const driftStatus=up(ds?.drift?.status);

      const paired=Number(target?.pairedRows||0);
      const positive=Number(target?.positive||0);
      const negative=Number(target?.negative||0);
      const brier=num(target?.delta?.brier);
      const logLoss=num(target?.delta?.logLoss);
      const accuracy=num(target?.delta?.accuracyPct);

      const checks=[
        check('PAIRED_5M_SAMPLE',paired>=100,paired,'>=100'),
        check('POSITIVE_COVERAGE',positive>=20,positive,'>=20'),
        check('NEGATIVE_COVERAGE',negative>=20,negative,'>=20'),
        check(
          'V23_12_VERDICT',
          verdict==='V23_CHALLENGER_WINS',
          verdict,
          'V23_CHALLENGER_WINS'
        ),
        check(
          'BRIER_IMPROVEMENT',
          brier!==null&&brier>=0.0075,
          brier,
          '>=0.0075'
        ),
        check(
          'LOG_LOSS_IMPROVEMENT',
          logLoss!==null&&logLoss>=0.015,
          logLoss,
          '>=0.015'
        ),
        check(
          'ACCURACY_NON_REGRESSION',
          accuracy!==null&&accuracy>=-1,
          accuracy,
          '>=-1 pct'
        ),
        check(
          'CALIBRATION_HEALTH',
          calibrationStatus==='CALIBRATION_HEALTHY',
          calibrationStatus,
          'CALIBRATION_HEALTHY'
        ),
        check(
          'CALIBRATION_ECE',
          ece!==null&&ece<=10,
          ece,
          '<=10%'
        ),
        check(
          'DRIFT_HEALTH',
          !['DRIFT','ERROR'].includes(driftStatus),
          driftStatus,
          'not DRIFT/ERROR'
        )
      ];

      const failed=checks.filter(x=>!x.pass);
      const hardBlocked=
        ['DRIFT','ERROR'].includes(driftStatus) ||
        calibrationStatus==='CALIBRATION_MISALIGNED';

      let status='PROMOTION_LOCKED';
      let candidateForManualReview=false;

      if(hardBlocked){
        status='PROMOTION_BLOCKED';
      }else if(failed.length===0){
        status='PROMOTION_CANDIDATE';
        candidateForManualReview=true;
      }else if(paired<100){
        status='PROMOTION_EVIDENCE_BUILDING';
      }else if(verdict==='V23_CHALLENGER_WINS'){
        status='PROMOTION_PROBATION';
      }

      evaluations++;

      return {
        version:'MEMEFLOW_SHADOW_PROMOTION_GATE_V23_13',
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        automaticPromotion:false,
        candidateForManualReview,
        status,
        targetHorizonMs:300_000,
        benchmark:{
          verdict,
          pairedRows:paired,
          positive,
          negative,
          brierDelta:brier,
          logLossDelta:logLoss,
          accuracyDeltaPct:accuracy
        },
        calibration:{
          status:calibrationStatus,
          ecePct:ece,
          brier:num(cs?.targetBrier),
          logLoss:num(cs?.targetLogLoss)
        },
        drift:{
          status:driftStatus,
          ready:ds?.drift?.ready===true
        },
        checks,
        failedChecks:failed.map(x=>x.name)
      };
    }catch{
      errors++;
      return {
        version:'MEMEFLOW_SHADOW_PROMOTION_GATE_V23_13',
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        automaticPromotion:false,
        candidateForManualReview:false,
        status:'PROMOTION_GATE_ERROR',
        targetHorizonMs:300_000,
        checks:[],
        failedChecks:['PROMOTION_GATE_ERROR']
      };
    }
  }

  function status(){
    return {
      ...evaluate(),
      evaluations,
      errors,
      policy:{
        minPaired5mRows:100,
        minPositive5m:20,
        minNegative5m:20,
        minBrierImprovement:0.0075,
        minLogLossImprovement:0.015,
        minAccuracyDeltaPct:-1,
        requiredCalibrationStatus:'CALIBRATION_HEALTHY',
        maxCalibrationEcePct:10,
        forbiddenDriftStatuses:['DRIFT','ERROR'],
        manualReviewRequired:true
      }
    };
  }

  return {evaluate,status};
}
