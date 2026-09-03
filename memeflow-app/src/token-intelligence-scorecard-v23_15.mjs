// MEMEFLOW_TOKEN_INTELLIGENCE_SCORECARD_V23_15
//
// OWNER READ-ONLY PER-TOKEN EXPLAINABILITY.
//
// "Scorecard" is a diagnostic view, NOT a second MEMEFLOW Score.
// It explains the already-existing shadow evidence:
// probability, confidence, trajectory, pattern, wallets, calibration,
// disagreement, drift and blockers.
//
// No Score/State/Settings/BUY/SELL mutation.

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

function readiness(items=[]){
  if(!items.length)return 0;
  return round(
    items.filter(Boolean).length/items.length*100,
    1
  );
}

function directionFromProbability(probability){
  const p=finite(probability);
  if(p===null)return 'UNKNOWN';
  if(p>=62)return 'BULLISH';
  if(p<=38)return 'BEARISH';
  return 'NEUTRAL';
}

function confidenceBand(confidence){
  const c=finite(confidence);
  if(c===null)return 'UNKNOWN';
  if(c>=75)return 'HIGH';
  if(c>=50)return 'MEDIUM';
  if(c>=25)return 'LOW';
  return 'VERY_LOW';
}

function factor({
  key,
  label,
  status='UNKNOWN',
  value=null,
  detail=null,
  ready=false,
  caution=false
}){
  return {
    key,
    label,
    status:upper(status),
    value,
    detail,
    ready:ready===true,
    caution:caution===true
  };
}

function summaryFromInspect(row={}){
  const snap=row?.snapshot||{};
  const specialists=snap?.specialists||{};
  const evidence=snap?.evidence||{};

  return {
    mint:row?.mint,
    stage:row?.stage,
    eventCount:row?.eventCount,
    lastObservedAt:snap?.observedAt||null,
    anchorAt:row?.anchor?.at||null,
    labelsCompleted:row?.labelsCompleted||[],
    regime:evidence?.regime||null,
    dataCompletenessPct:
      evidence?.dataQuality?.completenessPct??null,
    canonicalScore:
      evidence?.sourceSignals?.canonicalScore??null,
    opportunityEvidenceReady:
      evidence?.sourceSignals?.opportunityEvidenceReady===true,
    wallet:{
      uniqueBuyerWallets:
        specialists?.wallet?.uniqueBuyerWallets??0,
      topBuyerSolSharePct:
        specialists?.wallet?.topBuyerSolSharePct??null
    },
    coordination:{
      suspected:
        specialists?.coordination?.suspectedCoordination===true,
      sameSlotBuySharePct:
        specialists?.coordination?.sameSlotBuySharePct??0
    },
    smartMoneyMemory:{
      reputationReady:
        specialists?.smartMoneyMemory?.reputationReady===true,
      knownWallets:
        specialists?.smartMoneyMemory?.knownWallets??0,
      readyWallets:
        specialists?.smartMoneyMemory?.readyWallets??0,
      strongWallets:
        specialists?.smartMoneyMemory?.strongWallets??0,
      strongWalletSharePct:
        specialists?.smartMoneyMemory?.strongWalletSharePct??0,
      weightedPositiveProbabilityPct:
        specialists?.smartMoneyMemory?.weightedPositiveProbabilityPct??null,
      historicalConfidencePct:
        specialists?.smartMoneyMemory?.historicalConfidencePct??null
    },
    shadowDriftRegime:{
      status:
        snap?.shadowDriftRegime?.status||'COLD_START',
      driftStatus:
        snap?.shadowDriftRegime?.driftStatus||'COLD_START',
      currentRegime:
        snap?.shadowDriftRegime?.currentRegime||'UNKNOWN',
      regimeModelReady:
        snap?.shadowDriftRegime?.regimeModelReady===true,
      probabilityPositivePct:
        snap?.shadowDriftRegime?.probabilityPositivePct??null,
      modelConfidencePct:
        snap?.shadowDriftRegime?.modelConfidencePct??0
    },
    shadowConfidenceGovernor:{
      status:
        snap?.shadowConfidenceGovernor?.status||'COLD_START',
      ready:
        snap?.shadowConfidenceGovernor?.ready===true,
      consensusProbabilityPositivePct:
        snap?.shadowConfidenceGovernor?.consensusProbabilityPositivePct??null,
      ensembleConfidencePct:
        snap?.shadowConfidenceGovernor?.ensembleConfidencePct??0,
      disagreementPct:
        snap?.shadowConfidenceGovernor?.disagreementPct??null,
      agreementPct:
        snap?.shadowConfidenceGovernor?.agreementPct??null,
      sourceCount:
        snap?.shadowConfidenceGovernor?.sourceCount??0,
      validatedSourceCount:
        snap?.shadowConfidenceGovernor?.validatedSourceCount??0
    },
    shadowTokenTrajectory:{
      trajectoryState:
        snap?.shadowTokenTrajectory?.trajectoryState||'COLD',
      stateStreak:
        snap?.shadowTokenTrajectory?.stateStreak??1,
      turningPoint:
        snap?.shadowTokenTrajectory?.turningPoint===true,
      probabilityDeltaWindow:
        snap?.shadowTokenTrajectory?.probabilityDeltaWindow??null,
      confidenceDeltaWindow:
        snap?.shadowTokenTrajectory?.confidenceDeltaWindow??null,
      forecastQuality:
        snap?.shadowTokenTrajectory?.forecastQuality||null
    },
    shadowTokenPattern:{
      status:
        snap?.shadowTokenPattern?.status||'PATTERN_COLD_START',
      ready:
        snap?.shadowTokenPattern?.ready===true,
      historicalExamples:
        snap?.shadowTokenPattern?.historicalExamples??0,
      neighbourCount:
        snap?.shadowTokenPattern?.neighbourCount??0,
      patternProbabilityPositivePct:
        snap?.shadowTokenPattern?.patternProbabilityPositivePct??null,
      matchConfidencePct:
        snap?.shadowTokenPattern?.matchConfidencePct??0,
      meanSimilarityPct:
        snap?.shadowTokenPattern?.meanSimilarityPct??0
    },
    shadowEvidenceSynthesis:{
      status:
        snap?.shadowEvidenceSynthesis?.status||'SYNTHESIS_COLD_START',
      ready:
        snap?.shadowEvidenceSynthesis?.ready===true,
      direction:
        snap?.shadowEvidenceSynthesis?.direction||'UNKNOWN',
      synthesisProbabilityPositivePct:
        snap?.shadowEvidenceSynthesis?.synthesisProbabilityPositivePct??null,
      synthesisConfidencePct:
        snap?.shadowEvidenceSynthesis?.synthesisConfidencePct??0,
      crossSourceDisagreementPct:
        snap?.shadowEvidenceSynthesis?.crossSourceDisagreementPct??null,
      blockers:
        snap?.shadowEvidenceSynthesis?.blockers||[]
    },
    shadowOutcomeCalibration:{
      status:
        snap?.shadowOutcomeCalibration?.status||'CALIBRATION_COLD_START',
      ready:
        snap?.shadowOutcomeCalibration?.ready===true,
      rawProbabilityPositivePct:
        snap?.shadowOutcomeCalibration?.rawProbabilityPositivePct??null,
      calibratedProbabilityPositivePct:
        snap?.shadowOutcomeCalibration?.calibratedProbabilityPositivePct??null,
      calibratedConfidencePct:
        snap?.shadowOutcomeCalibration?.calibratedConfidencePct??0,
      reliabilitySampleCount:
        snap?.shadowOutcomeCalibration?.reliabilitySampleCount??0,
      globalEcePct:
        snap?.shadowOutcomeCalibration?.globalEcePct??null,
      globalBrier:
        snap?.shadowOutcomeCalibration?.globalBrier??null
    },
    shadowModelArena:{
      status:
        snap?.shadowModelArena?.status||'COLD_START',
      modelReady:
        snap?.shadowModelArena?.modelReady===true,
      validated:
        snap?.shadowModelArena?.validated===true,
      champion:
        snap?.shadowModelArena?.champion||null,
      calibratedProbabilityPositivePct:
        snap?.shadowModelArena?.calibratedProbabilityPositivePct??null,
      modelConfidencePct:
        snap?.shadowModelArena?.modelConfidencePct??0
    },
    shadowMathBrain:{
      status:
        snap?.shadowMathBrain?.status||'COLD_START',
      modelReady:
        snap?.shadowMathBrain?.modelReady===true,
      validated:
        snap?.shadowMathBrain?.validated===true,
      probabilityPositivePct:
        snap?.shadowMathBrain?.probabilityPositivePct??null,
      modelConfidencePct:
        snap?.shadowMathBrain?.modelConfidencePct??0
    }
  };
}

export function createTokenIntelligenceScorecardV23_15({
  inspectToken=null,
  listTokenCells=null
}={}){
  let generated=0;
  let errors=0;

  function build(input={}){
    try{
      const synthesis=input?.shadowEvidenceSynthesis||{};
      const calibration=input?.shadowOutcomeCalibration||{};
      const governor=input?.shadowConfidenceGovernor||{};
      const pattern=input?.shadowTokenPattern||{};
      const trajectory=input?.shadowTokenTrajectory||{};
      const smart=input?.smartMoneyMemory||{};
      const drift=input?.shadowDriftRegime||{};

      let probabilityPositivePct=null;
      let confidencePct=0;
      let probabilitySource='NONE';

      if(
        calibration?.ready===true &&
        finite(calibration?.calibratedProbabilityPositivePct)!==null
      ){
        probabilityPositivePct=
          finite(calibration.calibratedProbabilityPositivePct);
        confidencePct=
          finite(calibration.calibratedConfidencePct)??0;
        probabilitySource='V23_11_CALIBRATED';
      }else if(
        synthesis?.ready===true &&
        finite(synthesis?.synthesisProbabilityPositivePct)!==null
      ){
        probabilityPositivePct=
          finite(synthesis.synthesisProbabilityPositivePct);
        confidencePct=
          finite(synthesis.synthesisConfidencePct)??0;
        probabilitySource='V23_10_SYNTHESIS';
      }else if(
        governor?.ready===true &&
        finite(governor?.consensusProbabilityPositivePct)!==null
      ){
        probabilityPositivePct=
          finite(governor.consensusProbabilityPositivePct);
        confidencePct=
          finite(governor.ensembleConfidencePct)??0;
        probabilitySource='V23_7_GOVERNOR';
      }else if(
        finite(input?.shadowModelArena?.calibratedProbabilityPositivePct)!==null
      ){
        probabilityPositivePct=
          finite(input.shadowModelArena.calibratedProbabilityPositivePct);
        confidencePct=
          finite(input.shadowModelArena.modelConfidencePct)??0;
        probabilitySource='V23_5_ARENA';
      }else if(
        finite(input?.shadowMathBrain?.probabilityPositivePct)!==null
      ){
        probabilityPositivePct=
          finite(input.shadowMathBrain.probabilityPositivePct);
        confidencePct=
          finite(input.shadowMathBrain.modelConfidencePct)??0;
        probabilitySource='V23_4_MATH_BRAIN';
      }

      const blockers=[
        ...(Array.isArray(synthesis?.blockers)?synthesis.blockers:[])
      ].map(String);

      if(input?.coordination?.suspected===true){
        blockers.push('SUSPECTED_WALLET_COORDINATION');
      }

      const driftStatus=upper(drift?.driftStatus||drift?.status);

      if(['DRIFT','ERROR'].includes(driftStatus)){
        blockers.push(`DRIFT_${driftStatus}`);
      }

      const disagreement=
        finite(synthesis?.crossSourceDisagreementPct) ??
        finite(governor?.disagreementPct);

      if(disagreement!==null&&disagreement>=45){
        blockers.push('HIGH_MODEL_DISAGREEMENT');
      }

      const completeness=
        finite(input?.dataCompletenessPct);

      if(completeness!==null&&completeness<75){
        blockers.push('LOW_DATA_COMPLETENESS');
      }

      const factorRows=[
        factor({
          key:'SYNTHESIS',
          label:'Evidence synthesis',
          status:synthesis?.status,
          value:
            finite(synthesis?.synthesisProbabilityPositivePct),
          detail:
            `${finite(synthesis?.synthesisConfidencePct)??0}% confidence`,
          ready:synthesis?.ready===true
        }),
        factor({
          key:'CALIBRATION',
          label:'Outcome calibration',
          status:calibration?.status,
          value:
            finite(calibration?.calibratedProbabilityPositivePct),
          detail:
            `${Number(calibration?.reliabilitySampleCount||0)} reliability rows`,
          ready:calibration?.ready===true,
          caution:
            upper(calibration?.status)==='CALIBRATION_MISALIGNED'
        }),
        factor({
          key:'TRAJECTORY',
          label:'Token trajectory',
          status:trajectory?.trajectoryState,
          value:
            finite(trajectory?.probabilityDeltaWindow),
          detail:
            trajectory?.turningPoint===true
              ? 'turning point detected'
              : `streak ${Number(trajectory?.stateStreak||0)}`,
          ready:
            upper(trajectory?.trajectoryState)!=='COLD',
          caution:
            ['FADING','DRIFTED','CONFLICTED']
              .includes(upper(trajectory?.trajectoryState))
        }),
        factor({
          key:'PATTERN',
          label:'Pattern memory',
          status:pattern?.status,
          value:
            finite(pattern?.patternProbabilityPositivePct),
          detail:
            `${Number(pattern?.neighbourCount||0)} neighbours · ${round(pattern?.meanSimilarityPct,1)??0}% similarity`,
          ready:pattern?.ready===true
        }),
        factor({
          key:'SMART_MONEY',
          label:'Smart money',
          status:
            smart?.reputationReady===true
              ? 'READY'
              : 'LEARNING',
          value:
            finite(smart?.weightedPositiveProbabilityPct),
          detail:
            `${Number(smart?.strongWallets||0)} strong · ${round(smart?.strongWalletSharePct,1)??0}% share`,
          ready:smart?.reputationReady===true
        }),
        factor({
          key:'DISAGREEMENT',
          label:'Model agreement',
          status:
            disagreement===null
              ? 'UNKNOWN'
              : disagreement<25
                ? 'ALIGNED'
                : disagreement<45
                  ? 'MIXED'
                  : 'CONFLICTED',
          value:
            disagreement,
          detail:
            disagreement===null
              ? 'insufficient sources'
              : `${round(100-disagreement,1)}% agreement`,
          ready:
            disagreement!==null,
          caution:
            disagreement!==null&&disagreement>=45
        }),
        factor({
          key:'DRIFT',
          label:'Market / model drift',
          status:driftStatus,
          value:
            finite(drift?.probabilityPositivePct),
          detail:
            String(drift?.currentRegime||input?.regime||'UNKNOWN'),
          ready:
            drift?.regimeModelReady===true ||
            !['COLD_START','UNKNOWN'].includes(driftStatus),
          caution:
            ['DRIFT','ERROR'].includes(driftStatus)
        }),
        factor({
          key:'DATA',
          label:'Data quality',
          status:
            completeness===null
              ? 'UNKNOWN'
              : completeness>=90
                ? 'STRONG'
                : completeness>=75
                  ? 'USABLE'
                  : 'THIN',
          value:completeness,
          detail:
            `${Number(input?.eventCount||0)} observed events`,
          ready:
            completeness!==null&&completeness>=75,
          caution:
            completeness!==null&&completeness<75
        })
      ];

      const readinessPct=
        readiness(
          factorRows.map(row=>row.ready)
        );

      generated++;

      return {
        version:'MEMEFLOW_TOKEN_INTELLIGENCE_SCORECARD_V23_15',
        ownerOnly:true,
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        secondScore:false,
        mint:String(input?.mint||''),
        stage:upper(input?.stage),
        lastObservedAt:
          Number(input?.lastObservedAt||0)||null,
        anchorAt:
          Number(input?.anchorAt||0)||null,
        labelsCompleted:
          Array.isArray(input?.labelsCompleted)
            ? input.labelsCompleted
            : [],
        canonicalScore:
          finite(input?.canonicalScore),
        opportunityEvidenceReady:
          input?.opportunityEvidenceReady===true,
        probabilityPositivePct:
          round(probabilityPositivePct,2),
        probabilitySource,
        confidencePct:
          round(confidencePct,2),
        confidenceBand:
          confidenceBand(confidencePct),
        direction:
          upper(
            synthesis?.direction||
            directionFromProbability(probabilityPositivePct)
          ),
        evidenceReadinessPct:
          readinessPct,
        regime:
          upper(input?.regime),
        dataCompletenessPct:
          completeness,
        disagreementPct:
          round(disagreement,2),
        blockers:
          [...new Set(blockers)],
        factorRows,
        wallet:{
          uniqueBuyerWallets:
            Number(input?.wallet?.uniqueBuyerWallets||0),
          topBuyerSolSharePct:
            round(input?.wallet?.topBuyerSolSharePct,2),
          suspectedCoordination:
            input?.coordination?.suspected===true,
          smartMoneyReady:
            smart?.reputationReady===true,
          strongWallets:
            Number(smart?.strongWallets||0),
          strongWalletSharePct:
            round(smart?.strongWalletSharePct,2)
        },
        trajectory:{
          state:
            upper(trajectory?.trajectoryState),
          turningPoint:
            trajectory?.turningPoint===true,
          probabilityDeltaWindow:
            round(trajectory?.probabilityDeltaWindow,2),
          confidenceDeltaWindow:
            round(trajectory?.confidenceDeltaWindow,2)
        },
        pattern:{
          ready:
            pattern?.ready===true,
          probabilityPositivePct:
            round(pattern?.patternProbabilityPositivePct,2),
          confidencePct:
            round(pattern?.matchConfidencePct,2),
          neighbours:
            Number(pattern?.neighbourCount||0),
          meanSimilarityPct:
            round(pattern?.meanSimilarityPct,2)
        },
        calibration:{
          ready:
            calibration?.ready===true,
          status:
            upper(calibration?.status),
          reliabilitySampleCount:
            Number(calibration?.reliabilitySampleCount||0),
          ecePct:
            round(calibration?.globalEcePct,2),
          brier:
            round(calibration?.globalBrier,6)
        }
      };
    }catch{
      errors++;

      return {
        version:'MEMEFLOW_TOKEN_INTELLIGENCE_SCORECARD_V23_15',
        ownerOnly:true,
        shadowOnly:true,
        authority:'DIAGNOSTIC_ONLY',
        secondScore:false,
        mint:String(input?.mint||''),
        stage:'UNKNOWN',
        probabilityPositivePct:null,
        probabilitySource:'NONE',
        confidencePct:0,
        confidenceBand:'UNKNOWN',
        direction:'UNKNOWN',
        evidenceReadinessPct:0,
        blockers:['SCORECARD_ERROR'],
        factorRows:[]
      };
    }
  }

  function inspect(mint){
    const raw=
      inspectToken?.(
        String(mint||'')
      );

    if(!raw)return null;

    return build(
      summaryFromInspect(raw)
    );
  }

  function list({
    limit=20,
    minReadinessPct=0
  }={}){
    const safeLimit=
      Math.max(
        1,
        Math.min(
          100,
          Number(limit)||20
        )
      );

    const minReady=
      clamp(
        Number(minReadinessPct)||0,
        0,
        100
      );

    const rows=
      listTokenCells?.({
        limit:100
      })||[];

    return rows
      .map(build)
      .filter(
        row=>
          row.evidenceReadinessPct>=minReady
      )
      .sort(
        (a,b)=>
          Number(b.evidenceReadinessPct||0)-
          Number(a.evidenceReadinessPct||0) ||
          Number(b.confidencePct||0)-
          Number(a.confidencePct||0) ||
          Number(b.lastObservedAt||0)-
          Number(a.lastObservedAt||0)
      )
      .slice(
        0,
        safeLimit
      );
  }

  function status(){
    const rows=
      list({limit:100});

    const withProbability=
      rows.filter(
        row=>
          finite(row.probabilityPositivePct)!==null
      );

    return {
      version:'MEMEFLOW_TOKEN_INTELLIGENCE_SCORECARD_V23_15',
      ownerOnly:true,
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      secondScore:false,
      tracked:rows.length,
      withProbability:
        withProbability.length,
      highReadiness:
        rows.filter(
          row=>row.evidenceReadinessPct>=75
        ).length,
      averageReadinessPct:
        rows.length
          ? round(
              rows.reduce(
                (sum,row)=>
                  sum+Number(row.evidenceReadinessPct||0),
                0
              )/rows.length,
              2
            )
          : null,
      generated,
      errors
    };
  }

  return {
    build,
    inspect,
    list,
    status
  };
}
