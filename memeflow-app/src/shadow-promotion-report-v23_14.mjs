// MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
//
// OWNER READ-ONLY REPORT.
//
// Consolidates V23.10-V23.13 evidence into one promotion-readiness view.
// It NEVER changes V22, Score, State, Settings, BUY or SELL.

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const clamp=(value,min,max)=>
  Math.max(min,Math.min(max,Number(value)||0));

const round=(value,digits=2)=>{
  const n=finite(value);
  if(n===null)return null;
  const p=10**digits;
  return Math.round(n*p)/p;
};

const upper=value=>
  String(value||'UNKNOWN').trim().toUpperCase()||'UNKNOWN';

function progress(actual,target){
  const a=Math.max(0,Number(actual)||0);
  const t=Math.max(1,Number(target)||1);
  return round(clamp(a/t*100,0,100),1);
}

function labelForStatus(status){
  switch(upper(status)){
    case 'PROMOTION_CANDIDATE':
      return 'READY FOR MANUAL REVIEW';
    case 'PROMOTION_BLOCKED':
      return 'BLOCKED';
    case 'PROMOTION_PROBATION':
      return 'PROBATION';
    case 'PROMOTION_EVIDENCE_BUILDING':
      return 'LEARNING';
    case 'PROMOTION_GATE_ERROR':
      return 'ERROR';
    default:
      return 'NOT READY';
  }
}

export function createShadowPromotionReportV23_14({
  promotionGate=null,
  championBenchmark=null,
  outcomeCalibration=null,
  driftRegime=null,
  evidenceSynthesis=null
}={}){
  let generated=0;
  let errors=0;

  function report(){
    try{
      const gate=
        promotionGate?.status?.()||{};

      const benchmark=
        championBenchmark?.status?.()||{};

      const target=
        benchmark?.target||{};

      const calibration=
        outcomeCalibration?.status?.()||{};

      const drift=
        driftRegime?.status?.()||{};

      const synthesis=
        evidenceSynthesis?.status?.()||{};

      const checks=
        Array.isArray(gate?.checks)
          ? gate.checks
          : [];

      const passedChecks=
        checks.filter(row=>row?.pass===true).length;

      const totalChecks=
        checks.length;

      const failedChecks=
        checks
          .filter(row=>row?.pass!==true)
          .map(row=>String(row?.name||'UNKNOWN'));

      const paired=
        Number(target?.pairedRows||0);

      const positive=
        Number(target?.positive||0);

      const negative=
        Number(target?.negative||0);

      const status=
        upper(gate?.status);

      const candidate=
        gate?.candidateForManualReview===true;

      const automaticPromotion=
        gate?.automaticPromotion===true;

      const sampleProgressPct=
        progress(paired,100);

      const positiveProgressPct=
        progress(positive,20);

      const negativeProgressPct=
        progress(negative,20);

      const checkProgressPct=
        totalChecks
          ? round(passedChecks/totalChecks*100,1)
          : 0;

      const readinessPct=
        round(
          (
            sampleProgressPct*0.35+
            positiveProgressPct*0.10+
            negativeProgressPct*0.10+
            checkProgressPct*0.45
          ),
          1
        );

      const verdict=
        upper(target?.verdict?.status);

      const calibrationStatus=
        upper(calibration?.targetStatus);

      const driftStatus=
        upper(drift?.drift?.status);

      const primaryBlocker=
        failedChecks[0]||
        (
          candidate
            ? null
            : 'WAITING_FOR_COMPLETE_GATE'
        );

      generated++;

      return {
        version:'MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14',
        ownerOnly:true,
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        tradingAuthority:'V22',
        automaticPromotion,
        candidateForManualReview:candidate,
        status,
        statusLabel:labelForStatus(status),
        readinessPct,
        progress:{
          paired5mPct:sampleProgressPct,
          positivePct:positiveProgressPct,
          negativePct:negativeProgressPct,
          checksPct:checkProgressPct
        },
        sample:{
          paired5m:paired,
          requiredPaired5m:100,
          positive5m:positive,
          requiredPositive5m:20,
          negative5m:negative,
          requiredNegative5m:20
        },
        benchmark:{
          verdict,
          v22:
            target?.v22||{
              meanBrier:null,
              meanLogLoss:null,
              accuracyPct:null
            },
          v23:
            target?.v23||{
              meanBrier:null,
              meanLogLoss:null,
              accuracyPct:null
            },
          delta:{
            brier:
              finite(target?.delta?.brier),
            logLoss:
              finite(target?.delta?.logLoss),
            accuracyPct:
              finite(target?.delta?.accuracyPct)
          },
          pairedWins:
            target?.pairedWins||{
              v22:0,
              v23:0,
              ties:0
            }
        },
        calibration:{
          status:calibrationStatus,
          scoredRows:
            Number(
              calibration?.targetScoredRows||0
            ),
          accuracyPct:
            finite(
              calibration?.targetAccuracyPct
            ),
          ecePct:
            finite(
              calibration?.targetEcePct
            ),
          brier:
            finite(
              calibration?.targetBrier
            ),
          logLoss:
            finite(
              calibration?.targetLogLoss
            )
        },
        drift:{
          status:driftStatus,
          ready:
            drift?.drift?.ready===true
        },
        synthesis:{
          predictions:
            Number(
              synthesis?.predictions||0
            ),
          coldStarts:
            Number(
              synthesis?.coldStarts||0
            ),
          conflicts:
            Number(
              synthesis?.conflicts||0
            ),
          errors:
            Number(
              synthesis?.errors||0
            )
        },
        gate:{
          passedChecks,
          totalChecks,
          failedChecks,
          primaryBlocker,
          checks
        },
        safety:{
          v22RemainsTradingAuthority:true,
          automaticPromotionDisabled:
            automaticPromotion!==true,
          manualReviewRequired:true,
          scoreMutation:false,
          stateMutation:false,
          buySellMutation:false
        },
        generatedAt:
          Date.now()
      };
    }catch{
      errors++;

      return {
        version:'MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14',
        ownerOnly:true,
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        tradingAuthority:'V22',
        automaticPromotion:false,
        candidateForManualReview:false,
        status:'PROMOTION_REPORT_ERROR',
        statusLabel:'ERROR',
        readinessPct:0,
        progress:{
          paired5mPct:0,
          positivePct:0,
          negativePct:0,
          checksPct:0
        },
        sample:{
          paired5m:0,
          requiredPaired5m:100,
          positive5m:0,
          requiredPositive5m:20,
          negative5m:0,
          requiredNegative5m:20
        },
        benchmark:null,
        calibration:null,
        drift:null,
        synthesis:null,
        gate:{
          passedChecks:0,
          totalChecks:0,
          failedChecks:[
            'PROMOTION_REPORT_ERROR'
          ],
          primaryBlocker:
            'PROMOTION_REPORT_ERROR',
          checks:[]
        },
        safety:{
          v22RemainsTradingAuthority:true,
          automaticPromotionDisabled:true,
          manualReviewRequired:true,
          scoreMutation:false,
          stateMutation:false,
          buySellMutation:false
        },
        generatedAt:
          Date.now()
      };
    }
  }

  function status(){
    return {
      version:'MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14',
      ownerOnly:true,
      shadowOnly:true,
      generated,
      errors,
      report:
        report()
    };
  }

  return {
    report,
    status
  };
}
