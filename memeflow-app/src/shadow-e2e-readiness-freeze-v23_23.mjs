import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_V23_E2E_READINESS_FREEZE_V23_23
//
// Final V23 architecture closure / freeze audit.
//
// IMPORTANT:
// - this module does NOT make trading decisions
// - this module does NOT mutate Score / State / Settings / BUY / SELL
// - this module does NOT apply V23.20 policy
// - this module does NOT auto-promote V23
// - V22 remains the only live trading authority
//
// It answers two different questions:
// 1) Is the V23 architecture/contract complete and frozen?
// 2) Has enough real evidence accumulated to allow V24 controlled activation?
//
// Those are deliberately NOT the same thing.

const EXPECTED_COMPONENTS=Object.freeze([
  'walletReputation',
  'learningDataset',
  'shadowMathBrain',
  'shadowModelArena',
  'shadowDriftRegime',
  'shadowConfidenceGovernor',
  'shadowTokenTrajectory',
  'shadowTokenPatternMemory',
  'shadowEvidenceSynthesis',
  'shadowOutcomeCalibration',
  'shadowChampionBenchmark',
  'shadowPromotionGate',
  'shadowPromotionReport',
  'tokenIntelligenceScorecard',
  'shadowOutcomeReview',
  'shadowErrorPatternLearner',
  'shadowErrorAwareConfidence',
  'shadowErrorAwareBenchmark',
  'shadowPolicyCandidateBuilder',
  'shadowPolicySimulator',
  'shadowPolicyReviewGate'
]);

const REQUIRED_MANIFEST_FLAGS=Object.freeze({
  shadowOnly:true,
  liveAuthority:'V22',
  automaticPromotion:false,
  applicationAllowed:false,
  applyEndpointExists:false
});

const upper=value=>
  String(value||'UNKNOWN').trim().toUpperCase()||'UNKNOWN';

function safeStatus(component){
  if(
    !component ||
    typeof component.status!=='function'
  ){
    return {
      ok:false,
      error:'STATUS_UNAVAILABLE',
      status:null
    };
  }

  try{
    const status=
      component.status();

    return {
      ok:true,
      error:null,
      status:
        status&&typeof status==='object'
          ? status
          : {value:status}
    };
  }catch(error){
    return {
      ok:false,
      error:
        String(
          error?.message||
          error||
          'STATUS_ERROR'
        ).slice(0,180),
      status:null
    };
  }
}

function readManifest(manifestPath){
  try{
    const raw=
      fs.readFileSync(
        manifestPath,
        'utf8'
      );

    const data=
      JSON.parse(raw);

    return {
      ok:true,
      error:null,
      data
    };
  }catch(error){
    return {
      ok:false,
      error:
        String(
          error?.message||
          error||
          'MANIFEST_READ_ERROR'
        ).slice(0,180),
      data:null
    };
  }
}

function manifestContractOk(manifest={}){
  return Boolean(
    manifest?.version===
      'MEMEFLOW_V23_FREEZE_MANIFEST_V23_23' &&
    manifest?.frozen===true &&
    manifest?.shadowOnly===
      REQUIRED_MANIFEST_FLAGS.shadowOnly &&
    manifest?.liveAuthority===
      REQUIRED_MANIFEST_FLAGS.liveAuthority &&
    manifest?.automaticPromotion===
      REQUIRED_MANIFEST_FLAGS.automaticPromotion &&
    manifest?.applicationAllowed===
      REQUIRED_MANIFEST_FLAGS.applicationAllowed &&
    manifest?.applyEndpointExists===
      REQUIRED_MANIFEST_FLAGS.applyEndpointExists &&
    manifest?.nextMajor===
      'V24_CONTROLLED_INTEGRATION'
  );
}

export function createV23E2EReadinessFreezeV23_23({
  components={},
  manifestPath=null
}={}){
  let audits=0;
  let errors=0;
  let last=null;

  const resolvedManifestPath=
    manifestPath||
    path.resolve(
      process.cwd(),
      'v23-freeze-manifest.json'
    );

  function audit(){
    try{
      const manifestResult=
        readManifest(
          resolvedManifestPath
        );

      const componentRows=
        EXPECTED_COMPONENTS.map(name=>{
          const result=
            safeStatus(
              components?.[name]
            );

          return {
            name,
            present:
              Boolean(
                components?.[name]
              ),
            statusCallable:
              typeof components?.[name]
                ?.status==='function',
            statusOk:
              result.ok,
            statusVersion:
              result?.status?.version||
              null,
            statusError:
              result.error
          };
        });

      const missing=
        componentRows
          .filter(
            row=>
              !row.present ||
              !row.statusCallable
          )
          .map(row=>row.name);

      const statusErrors=
        componentRows
          .filter(
            row=>row.statusOk!==true
          )
          .map(row=>row.name);

      const structuralReady=
        manifestResult.ok===true &&
        manifestContractOk(
          manifestResult.data
        ) &&
        missing.length===0 &&
        statusErrors.length===0;

      const reviewStatus=
        safeStatus(
          components
            ?.shadowPolicyReviewGate
        );

      const reviewLast=
        reviewStatus
          ?.status
          ?.last||null;

      const reviewState=
        upper(
          reviewLast?.status
        );

      const candidateForManualReview=
        reviewLast
          ?.candidateForManualReview===true;

      const severeDrift=
        upper(
          reviewLast
            ?.drift
            ?.status
        );

      const calibration=
        upper(
          reviewLast
            ?.calibration
            ?.status
        );

      const evidenceBlocked=
        [
          'DRIFT',
          'ERROR'
        ].includes(severeDrift) ||
        calibration===
          'CALIBRATION_MISALIGNED' ||
        reviewState===
          'POLICY_REVIEW_BLOCKED' ||
        reviewState===
          'POLICY_REVIEW_GATE_ERROR';

      const evidenceReady=
        structuralReady &&
        !evidenceBlocked &&
        candidateForManualReview;

      const result={
        version:
          'MEMEFLOW_V23_E2E_READINESS_FREEZE_V23_23',
        shadowOnly:true,
        authority:
          'READINESS_AUDIT_ONLY',

        architecture:{
          structuralReady,
          freezeStatus:
            structuralReady
              ? 'V23_ARCHITECTURE_FROZEN'
              : 'V23_FREEZE_BLOCKED',
          manifestOk:
            manifestResult.ok===true,
          manifestContractOk:
            manifestContractOk(
              manifestResult.data||{}
            ),
          manifestVersion:
            manifestResult
              ?.data
              ?.version||null,
          expectedComponents:
            EXPECTED_COMPONENTS.length,
          presentComponents:
            componentRows.filter(
              row=>
                row.present &&
                row.statusCallable
            ).length,
          missing,
          statusErrors,
          components:
            componentRows
        },

        evidence:{
          status:
            evidenceReady
              ? 'V23_EVIDENCE_READY_FOR_V24_CONTROLLED_ACTIVATION'
              : (
                  evidenceBlocked
                    ? 'V23_EVIDENCE_BLOCKED'
                    : 'V23_EVIDENCE_BUILDING'
                ),
          ready:
            evidenceReady,
          candidateForManualReview,
          policyReviewStatus:
            reviewState,
          driftStatus:
            severeDrift,
          calibrationStatus:
            calibration
        },

        v24:{
          integrationCodeMayBegin:
            structuralReady,
          controlledActivationEligible:
            evidenceReady,
          requiredBeforeActivation:[
            'V23_ARCHITECTURE_FROZEN',
            'POLICY_CANDIDATE_FOR_MANUAL_REVIEW',
            'NO_SEVERE_DRIFT',
            'CALIBRATION_HEALTHY',
            'OWNER_CONTROLLED_ROLLOUT',
            'KILL_SWITCH_AND_ROLLBACK'
          ]
        },

        freeze:{
          frozen:
            structuralReady,
          frozenAtRuntime:
            structuralReady,
          frozenRange:
            'V23.0-V23.23',
          nextMajor:
            'V24_CONTROLLED_INTEGRATION',
          rule:
            'NO_NEW_V23_INTELLIGENCE_MODULES_AFTER_V23_23; FIXES_ONLY'
        },

        controls:{
          v22OnlyTradingAuthority:true,
          scoreMutation:false,
          stateMutation:false,
          settingsMutation:false,
          buySellMutation:false,
          forecastMutation:false,
          automaticPromotion:false,
          applicationAllowed:false,
          applyEndpointExists:false
        },

        manifest:
          manifestResult.ok
            ? manifestResult.data
            : null,

        manifestError:
          manifestResult.error
      };

      audits++;
      last=result;
      return result;
    }catch(error){
      errors++;

      const result={
        version:
          'MEMEFLOW_V23_E2E_READINESS_FREEZE_V23_23',
        shadowOnly:true,
        authority:
          'READINESS_AUDIT_ONLY',
        architecture:{
          structuralReady:false,
          freezeStatus:
            'V23_FREEZE_AUDIT_ERROR'
        },
        evidence:{
          status:
            'V23_EVIDENCE_BLOCKED',
          ready:false
        },
        v24:{
          integrationCodeMayBegin:false,
          controlledActivationEligible:false
        },
        freeze:{
          frozen:false,
          frozenRange:
            'V23.0-V23.23',
          nextMajor:
            'V24_CONTROLLED_INTEGRATION'
        },
        controls:{
          v22OnlyTradingAuthority:true,
          scoreMutation:false,
          stateMutation:false,
          settingsMutation:false,
          buySellMutation:false,
          forecastMutation:false,
          automaticPromotion:false,
          applicationAllowed:false,
          applyEndpointExists:false
        },
        error:
          String(
            error?.message||
            error||
            'V23_FREEZE_AUDIT_ERROR'
          ).slice(0,180)
      };

      last=result;
      return result;
    }
  }

  function status(){
    return {
      version:
        'MEMEFLOW_V23_E2E_READINESS_FREEZE_V23_23',
      shadowOnly:true,
      authority:
        'READINESS_AUDIT_ONLY',
      audits,
      errors,
      last:
        last||audit()
    };
  }

  return {
    audit,
    status
  };
}
