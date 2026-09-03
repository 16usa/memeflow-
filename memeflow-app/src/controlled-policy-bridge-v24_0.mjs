import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_V24_CONTROLLED_POLICY_BRIDGE_V24_0
//
// First real integration bridge between frozen V23 intelligence and V22.
//
// This bridge is intentionally one-way and conservative:
//   BUY READY -> WATCH
//
// It can NEVER:
// - upgrade WAITING/WATCH/BLOCKED to BUY READY
// - open or close a position
// - change Score
// - change Settings
// - change V23 forecasts
// - auto-promote a policy
//
// Default runtime mode is OFF.
// Optional runtime modes:
//   OFF     : no policy effect
//   SHADOW  : records what WOULD be downgraded, no state mutation
//   ENFORCE : may downgrade BUY READY -> WATCH, but ONLY when all
//             V23.23/V23.22 readiness contracts are satisfied.
//
// A bridge-local kill switch disables V24 policy influence immediately.
// V22 remains the underlying decision authority.

const MODES=new Set([
  'OFF',
  'SHADOW',
  'ENFORCE'
]);

const finite=value=>{
  if(
    value===null ||
    value===undefined ||
    value===''
  ){
    return null;
  }

  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const upper=value=>
  String(value||'').trim().toUpperCase();

function parseBool(value,fallback=false){
  if(value===true||value===false)return value;

  const text=
    String(value??'')
      .trim()
      .toLowerCase();

  if(['1','true','yes','on'].includes(text))return true;
  if(['0','false','no','off'].includes(text))return false;

  return fallback;
}

function normalizedMode(value){
  const mode=upper(value||'OFF');
  return MODES.has(mode)?mode:'OFF';
}

function cloneDecision(decision={}){
  return {
    ...decision,
    reasons:
      Array.isArray(decision?.reasons)
        ? [...decision.reasons]
        : []
  };
}

function triggerMatches(
  intelligence={},
  candidate={}
){
  const errorAware=
    intelligence
      ?.snapshot
      ?.shadowErrorAwareConfidence||{};

  const trigger=
    candidate?.trigger||{};

  if(
    trigger?.requirePenaltyApplied===true &&
    upper(errorAware?.status)!==
      'PENALTY_APPLIED'
  ){
    return {
      match:false,
      reason:
        'V23_18_PENALTY_NOT_APPLIED',
      errorAware
    };
  }

  if(
    trigger?.requireMatureErrorPattern===true &&
    upper(errorAware?.status)!==
      'PENALTY_APPLIED'
  ){
    return {
      match:false,
      reason:
        'MATURE_ERROR_PATTERN_NOT_CONFIRMED',
      errorAware
    };
  }

  const penalty=
    finite(
      errorAware?.penaltyPct
    );

  const adjusted=
    finite(
      errorAware?.adjustedConfidencePct
    );

  if(
    penalty===null ||
    adjusted===null
  ){
    return {
      match:false,
      reason:
        'ERROR_AWARE_EVIDENCE_INCOMPLETE',
      errorAware
    };
  }

  const minPenalty=
    Number(
      trigger?.minPenaltyPct||0
    );

  const maxAdjusted=
    Number(
      trigger
        ?.maxAdjustedConfidencePct??100
    );

  if(penalty<minPenalty){
    return {
      match:false,
      reason:
        'PENALTY_BELOW_POLICY_THRESHOLD',
      errorAware
    };
  }

  if(adjusted>maxAdjusted){
    return {
      match:false,
      reason:
        'ADJUSTED_CONFIDENCE_ABOVE_POLICY_THRESHOLD',
      errorAware
    };
  }

  return {
    match:true,
    reason:'POLICY_TRIGGER_MATCH',
    errorAware
  };
}

export function createV24ControlledPolicyBridgeV24_0({
  dataDir=null,
  mode='OFF',
  killSwitch=true,
  readinessProvider=null,
  candidateProvider=null,
  tokenIntelligenceProvider=null
}={}){
  const configuredMode=
    normalizedMode(mode);

  let killed=
    parseBool(
      killSwitch,
      true
    );

  let decisionsSeen=0;
  let buyReadySeen=0;
  let shadowWouldDowngrade=0;
  let enforcedDowngrades=0;
  let blockedByReadiness=0;
  let blockedByKillSwitch=0;
  let errors=0;
  let last=null;

  const recent=[];
  const file=
    dataDir
      ? path.join(
          dataDir,
          'v24-policy-bridge-audit.jsonl'
        )
      : null;

  let writeQueue=[];
  let writing=false;
  let writeErrors=0;

  if(file){
    try{
      fs.mkdirSync(
        path.dirname(file),
        {recursive:true}
      );
    }catch{}
  }

  function drain(){
    if(
      writing ||
      !writeQueue.length ||
      !file
    ){
      return;
    }

    writing=true;

    setImmediate(async()=>{
      try{
        while(writeQueue.length){
          const batch=
            writeQueue.splice(0,100);

          await fs.promises.appendFile(
            file,
            batch
              .map(row=>JSON.stringify(row))
              .join('\n')+
              '\n',
            'utf8'
          );
        }
      }catch{
        writeErrors++;
      }finally{
        writing=false;

        if(writeQueue.length){
          drain();
        }
      }
    });
  }

  function audit(row){
    last=row;

    recent.unshift(row);

    if(recent.length>200){
      recent.length=200;
    }

    if(file){
      writeQueue.push(row);

      if(writeQueue.length>5000){
        writeQueue=
          writeQueue.slice(-5000);
      }

      drain();
    }
  }

  function baseMeta({
    uid,
    token,
    decision
  }={}){
    return {
      version:
        'MEMEFLOW_V24_CONTROLLED_POLICY_BRIDGE_V24_0',
      at:Date.now(),
      mode:
        configuredMode,
      killSwitch:killed,
      uid:
        uid?String(uid):null,
      mint:
        token?.mint
          ? String(token.mint)
          : null,
      inputState:
        upper(decision?.state)||'UNKNOWN',
      score:
        finite(decision?.score)
    };
  }

  function status(){
    return {
      version:
        'MEMEFLOW_V24_CONTROLLED_POLICY_BRIDGE_V24_0',
      authority:
        'V22_WITH_OPTIONAL_V24_DOWNGRADE_GUARD',
      mode:
        configuredMode,
      killSwitch:killed,
      defaultSafe:
        configuredMode==='OFF' ||
        killed===true,
      oneWayOnly:true,
      allowedMutation:
        'BUY_READY_TO_WATCH_ONLY',
      canUpgrade:false,
      canExecuteTrade:false,
      scoreMutation:false,
      settingsMutation:false,
      forecastMutation:false,
      automaticPromotion:false,
      decisionsSeen,
      buyReadySeen,
      shadowWouldDowngrade,
      enforcedDowngrades,
      blockedByReadiness,
      blockedByKillSwitch,
      errors,
      writeErrors,
      queuedAuditRows:
        writeQueue.length,
      auditFile:file,
      last
    };
  }

  function inspectReadiness(){
    try{
      return typeof readinessProvider==='function'
        ? readinessProvider()
        : null;
    }catch{
      return null;
    }
  }

  function inspectCandidate(){
    try{
      return typeof candidateProvider==='function'
        ? candidateProvider()
        : null;
    }catch{
      return null;
    }
  }

  function inspectToken(mint){
    try{
      return typeof tokenIntelligenceProvider==='function'
        ? tokenIntelligenceProvider(mint)
        : null;
    }catch{
      return null;
    }
  }

  function apply({
    uid=null,
    token=null,
    decision=null
  }={}){
    decisionsSeen++;

    const input=
      cloneDecision(
        decision&&typeof decision==='object'
          ? decision
          : {}
      );

    const meta=
      baseMeta({
        uid,
        token,
        decision:input
      });

    const inputState=
      upper(input?.state);

    if(inputState!=='BUY READY'){
      const row={
        ...meta,
        action:'NO_CHANGE',
        reason:
          'INPUT_STATE_NOT_BUY_READY',
        outputState:
          inputState||'UNKNOWN'
      };

      audit(row);

      return {
        ...input,
        v24PolicyBridge:row
      };
    }

    buyReadySeen++;

    if(configuredMode==='OFF'){
      const row={
        ...meta,
        action:'NO_CHANGE',
        reason:
          'BRIDGE_MODE_OFF',
        outputState:'BUY READY'
      };

      audit(row);

      return {
        ...input,
        v24PolicyBridge:row
      };
    }

    if(killed){
      blockedByKillSwitch++;

      const row={
        ...meta,
        action:'NO_CHANGE',
        reason:
          'BRIDGE_KILL_SWITCH_ACTIVE',
        outputState:'BUY READY'
      };

      audit(row);

      return {
        ...input,
        v24PolicyBridge:row
      };
    }

    try{
      const readiness=
        inspectReadiness();

      const candidateResult=
        inspectCandidate();

      const candidate=
        candidateResult?.candidate||null;

      const architectureFrozen=
        readiness
          ?.architecture
          ?.structuralReady===true;

      const activationEligible=
        readiness
          ?.v24
          ?.controlledActivationEligible===true;

      const candidateReady=
        candidateResult?.ready===true &&
        Boolean(candidate);

      if(
        !architectureFrozen ||
        !activationEligible ||
        !candidateReady
      ){
        blockedByReadiness++;

        const row={
          ...meta,
          action:'NO_CHANGE',
          reason:
            'V24_ACTIVATION_READINESS_NOT_SATISFIED',
          outputState:'BUY READY',
          readiness:{
            architectureFrozen,
            activationEligible,
            candidateReady
          }
        };

        audit(row);

        return {
          ...input,
          v24PolicyBridge:row
        };
      }

      const intelligence=
        inspectToken(
          token?.mint
        );

      const trigger=
        triggerMatches(
          intelligence,
          candidate
        );

      if(trigger.match!==true){
        const row={
          ...meta,
          action:'NO_CHANGE',
          reason:
            trigger.reason,
          outputState:'BUY READY',
          candidateId:
            candidate?.candidateId||null,
          penaltyPct:
            finite(
              trigger
                ?.errorAware
                ?.penaltyPct
            ),
          adjustedConfidencePct:
            finite(
              trigger
                ?.errorAware
                ?.adjustedConfidencePct
            )
        };

        audit(row);

        return {
          ...input,
          v24PolicyBridge:row
        };
      }

      const common={
        ...meta,
        candidateId:
          candidate?.candidateId||null,
        proposedAction:
          candidate?.proposedAction||null,
        penaltyPct:
          finite(
            trigger
              ?.errorAware
              ?.penaltyPct
          ),
        adjustedConfidencePct:
          finite(
            trigger
              ?.errorAware
              ?.adjustedConfidencePct
          )
      };

      if(configuredMode==='SHADOW'){
        shadowWouldDowngrade++;

        const row={
          ...common,
          action:
            'WOULD_DOWNGRADE_TO_WATCH',
          reason:
            'V24_POLICY_TRIGGER_MATCH_SHADOW_ONLY',
          outputState:'BUY READY'
        };

        audit(row);

        return {
          ...input,
          v24PolicyBridge:row
        };
      }

      if(configuredMode==='ENFORCE'){
        enforcedDowngrades++;

        const reason=
          'V24 controlled policy guard downgraded BUY READY to WATCH';

        const priorReasons=
          Array.isArray(input?.reasons)
            ? input.reasons.filter(Boolean)
            : [];

        const row={
          ...common,
          action:
            'DOWNGRADE_TO_WATCH',
          reason:
            'V24_POLICY_TRIGGER_MATCH_ENFORCED',
          outputState:'WATCH'
        };

        audit(row);

        return {
          ...input,
          state:'WATCH',
          displayState:'WATCH',
          tradeEligible:false,
          terminal:false,
          primaryReason:reason,
          reasons:[
            reason,
            ...priorReasons.filter(
              item=>item!==reason
            )
          ],
          v24PolicyBridge:row
        };
      }

      // Normalization guard: unknown mode can never mutate.
      const row={
        ...meta,
        action:'NO_CHANGE',
        reason:
          'UNRECOGNIZED_MODE_NORMALIZED_TO_OFF',
        outputState:'BUY READY'
      };

      audit(row);

      return {
        ...input,
        v24PolicyBridge:row
      };
    }catch(error){
      errors++;

      // Fail-closed only if ENFORCE was explicitly selected.
      // This prevents a broken bridge from allowing an entry it was
      // expected to guard. OFF/SHADOW never mutate on error.
      if(configuredMode==='ENFORCE'){
        const reason=
          'V24 policy bridge fail-closed: internal bridge error';

        const priorReasons=
          Array.isArray(input?.reasons)
            ? input.reasons.filter(Boolean)
            : [];

        const row={
          ...meta,
          action:
            'FAIL_CLOSED_TO_WATCH',
          reason:
            'BRIDGE_INTERNAL_ERROR',
          error:
            String(
              error?.message||
              error||
              'UNKNOWN'
            ).slice(0,160),
          outputState:'WATCH'
        };

        audit(row);

        return {
          ...input,
          state:'WATCH',
          displayState:'WATCH',
          tradeEligible:false,
          terminal:false,
          primaryReason:reason,
          reasons:[
            reason,
            ...priorReasons.filter(
              item=>item!==reason
            )
          ],
          v24PolicyBridge:row
        };
      }

      const row={
        ...meta,
        action:'NO_CHANGE',
        reason:
          'BRIDGE_INTERNAL_ERROR_NON_ENFORCE',
        outputState:'BUY READY'
      };

      audit(row);

      return {
        ...input,
        v24PolicyBridge:row
      };
    }
  }

  function setKillSwitch(value){
    killed=
      parseBool(
        value,
        true
      );

    return status();
  }

  function listRecent({
    limit=50,
    action=null
  }={}){
    const safe=
      Math.max(
        1,
        Math.min(
          200,
          Number(limit)||50
        )
      );

    const wanted=
      action
        ? upper(action)
        : null;

    return recent
      .filter(
        row=>
          !wanted ||
          upper(row?.action)===wanted
      )
      .slice(0,safe);
  }

  async function flush(){
    drain();

    const started=Date.now();

    while(
      writing ||
      writeQueue.length
    ){
      if(
        Date.now()-started>5000
      ){
        return false;
      }

      await new Promise(
        resolve=>
          setTimeout(resolve,5)
      );
    }

    return true;
  }

  return {
    apply,
    status,
    listRecent,
    setKillSwitch,
    flush
  };
}
