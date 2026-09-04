#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

[[ -n "$ROOT" ]] || {
  echo "ERROR: run inside MEMEFLOW repo"
  exit 1
}

cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="2cdaae33c42aefd437c8d12da84380443ec567d3"

APP="memeflow-app/app-server.mjs"
PKG="memeflow-app/package.json"
HTML="memeflow-app/owner-intelligence.html"
JS="memeflow-app/owner-intelligence.js"
CSS="memeflow-app/owner-intelligence.css"
MODULE="memeflow-app/src/controlled-policy-bridge-v24_0.mjs"
TEST="memeflow-app/tests/controlled-policy-bridge-v24_0.mjs"

MODIFIED=("$APP" "$PKG" "$HTML" "$JS" "$CSS")
NEW_FILES=("$MODULE" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW V24.0 CONTROLLED POLICY BRIDGE ==="

clear_lock(){
  if [[ -e .git/index.lock ]]; then
    active=""

    for proc in /proc/[0-9]*; do
      [[ -r "$proc/comm" ]] || continue
      comm="$(cat "$proc/comm" 2>/dev/null || true)"

      case "$comm" in
        git|git-*)
          cwd="$(readlink -f "$proc/cwd" 2>/dev/null || true)"

          if [[ "$cwd" == "$ROOT" || "$cwd" == "$ROOT/"* ]]; then
            active="$proc:$comm:$cwd"
            break
          fi
        ;;
      esac
    done

    if [[ -n "$active" ]]; then
      echo "V24.0 REFUSED: active git process"
      echo "$active"
      exit 1
    fi

    rm -f .git/index.lock
  fi
}

clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V24.0 REFUSED: wrong branch"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V24.0 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || {
    echo "V24.0 REFUSED: missing $f"
    exit 1
  }

  git diff --quiet -- "$f" || {
    echo "V24.0 REFUSED: local changes in $f"
    exit 1
  }

  git diff --cached --quiet -- "$f" || {
    echo "V24.0 REFUSED: staged changes in $f"
    exit 1
  }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || {
    echo "V24.0 REFUSED: $f already exists"
    exit 1
  }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/v24-controlled-policy-bridge-v24-0-$STAMP"

mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V24.0 FAILED - RESTORING ==="

    for f in "${MODIFIED[@]}"; do
      [[ -f "$BACKUP/$f" ]] &&
        cp "$BACKUP/$f" "$f" ||
        true
    done

    for f in "${NEW_FILES[@]}"; do
      rm -f "$f"
    done

    git reset -- "${ALL_FILES[@]}" >/dev/null 2>&1 || true

    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi

  exit "$rc"
}

trap rollback EXIT INT TERM

cat > "$MODULE" <<'EOF_MODULE'
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

EOF_MODULE

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createV24ControlledPolicyBridgeV24_0
} from '../src/controlled-policy-bridge-v24_0.mjs';

const tmp=
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'mf-v24-0-'
    )
  );

const mint='V240Mint111111111111111111111111111111111';

const decision={
  state:'BUY READY',
  displayState:'BUY READY',
  score:91,
  scoreAuthority:'evaluate',
  scoreFresh:true,
  scoreSource:'evaluate-live',
  primaryReason:'V22 ready',
  reasons:['V22 ready']
};

const token={
  mint
};

const readiness=()=>({
  architecture:{
    structuralReady:true
  },
  v24:{
    controlledActivationEligible:true
  }
});

const candidate=()=>({
  ready:true,
  candidate:{
    candidateId:
      'V23_20_ERROR_AWARE_ENTRY_GUARD_BALANCED',
    proposedAction:
      'DOWNGRADE_SHADOW_ENTRY_READINESS_TO_WATCH',
    trigger:{
      requireMatureErrorPattern:true,
      requirePenaltyApplied:true,
      minPenaltyPct:10,
      maxAdjustedConfidencePct:55
    }
  }
});

const intelligence=()=>({
  mint,
  snapshot:{
    shadowErrorAwareConfidence:{
      status:'PENALTY_APPLIED',
      penaltyPct:20,
      adjustedConfidencePct:44,
      rawConfidencePct:80
    }
  }
});

try{
  // Default OFF: V22 decision is untouched.
  const off=
    createV24ControlledPolicyBridgeV24_0({
      dataDir:tmp,
      mode:'OFF',
      killSwitch:false,
      readinessProvider:readiness,
      candidateProvider:candidate,
      tokenIntelligenceProvider:
        intelligence
    });

  const offResult=
    off.apply({
      uid:'u1',
      token,
      decision
    });

  assert.equal(
    offResult.state,
    'BUY READY'
  );

  assert.equal(
    offResult.score,
    91
  );

  assert.equal(
    offResult.v24PolicyBridge.action,
    'NO_CHANGE'
  );

  // SHADOW: records would-downgrade, still no mutation.
  const shadow=
    createV24ControlledPolicyBridgeV24_0({
      dataDir:tmp,
      mode:'SHADOW',
      killSwitch:false,
      readinessProvider:readiness,
      candidateProvider:candidate,
      tokenIntelligenceProvider:
        intelligence
    });

  const shadowResult=
    shadow.apply({
      uid:'u1',
      token,
      decision
    });

  assert.equal(
    shadowResult.state,
    'BUY READY'
  );

  assert.equal(
    shadowResult.v24PolicyBridge.action,
    'WOULD_DOWNGRADE_TO_WATCH'
  );

  // ENFORCE: only allowed mutation is BUY READY -> WATCH.
  const enforce=
    createV24ControlledPolicyBridgeV24_0({
      dataDir:tmp,
      mode:'ENFORCE',
      killSwitch:false,
      readinessProvider:readiness,
      candidateProvider:candidate,
      tokenIntelligenceProvider:
        intelligence
    });

  const enforced=
    enforce.apply({
      uid:'u1',
      token,
      decision
    });

  assert.equal(
    enforced.state,
    'WATCH'
  );

  assert.equal(
    enforced.displayState,
    'WATCH'
  );

  assert.equal(
    enforced.tradeEligible,
    false
  );

  assert.equal(
    enforced.score,
    91
  );

  assert.equal(
    enforced.scoreAuthority,
    'evaluate'
  );

  assert.equal(
    enforced.v24PolicyBridge.action,
    'DOWNGRADE_TO_WATCH'
  );

  // Non-BUY READY can never be upgraded.
  const watch=
    enforce.apply({
      uid:'u1',
      token,
      decision:{
        ...decision,
        state:'WATCH',
        displayState:'WATCH'
      }
    });

  assert.equal(
    watch.state,
    'WATCH'
  );

  assert.equal(
    watch.v24PolicyBridge.action,
    'NO_CHANGE'
  );

  // Kill switch bypasses V24 influence immediately.
  enforce.setKillSwitch(true);

  const killed=
    enforce.apply({
      uid:'u1',
      token,
      decision
    });

  assert.equal(
    killed.state,
    'BUY READY'
  );

  assert.equal(
    killed.v24PolicyBridge.reason,
    'BRIDGE_KILL_SWITCH_ACTIVE'
  );

  // Missing activation evidence can never apply policy.
  const notReady=
    createV24ControlledPolicyBridgeV24_0({
      mode:'ENFORCE',
      killSwitch:false,
      readinessProvider:()=>({
        architecture:{
          structuralReady:true
        },
        v24:{
          controlledActivationEligible:false
        }
      }),
      candidateProvider:candidate,
      tokenIntelligenceProvider:
        intelligence
    }).apply({
      uid:'u1',
      token,
      decision
    });

  assert.equal(
    notReady.state,
    'BUY READY'
  );

  assert.equal(
    notReady.v24PolicyBridge.reason,
    'V24_ACTIVATION_READINESS_NOT_SATISFIED'
  );

  assert.equal(
    await off.flush(),
    true
  );

  const source=
    fs.readFileSync(
      'src/controlled-policy-bridge-v24_0.mjs',
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

  const app=
    fs.readFileSync(
      'app-server.mjs',
      'utf8'
    );

  assert.match(
    app,
    /createV24ControlledPolicyBridgeV24_0/
  );

  assert.match(
    app,
    /__mfApplyV24PolicyBridge/
  );

  assert.match(
    app,
    /const rawDecision=evaluate\(token,settings\);/
  );

  assert.match(
    app,
    /decision=__mfApplyV24PolicyBridge\(\s*uid,\s*token,\s*decision\s*\);/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/v24-policy-bridge/
  );

  assert.doesNotMatch(
    app,
    /\/api\/owner\/intelligence\/v24-policy-bridge\/enable/
  );

  assert.doesNotMatch(
    app,
    /\/api\/owner\/intelligence\/v24-policy-bridge\/apply/
  );

  console.log(
    'controlled policy bridge v24.0 ok'
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

EOF_TEST

python3 - <<'PY'
from pathlib import Path

ap=Path("memeflow-app/app-server.mjs")
hp=Path("memeflow-app/owner-intelligence.html")
jp=Path("memeflow-app/owner-intelligence.js")
cp=Path("memeflow-app/owner-intelligence.css")

a=ap.read_text(encoding="utf-8")
h=hp.read_text(encoding="utf-8")
j=jp.read_text(encoding="utf-8")
c=cp.read_text(encoding="utf-8")

def once(text,old,new,label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(
            f"V24.0 REFUSED: {label}: expected 1 exact match, got {n}"
        )
    return text.replace(old,new,1)

old="""import {createTokenIntelligenceShadowV23} from './src/token-intelligence-shadow-v23.mjs'; // MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23"""

a=once(
    a,
    old,
    old+"""
import {createV24ControlledPolicyBridgeV24_0} from './src/controlled-policy-bridge-v24_0.mjs'; // MEMEFLOW_V24_CONTROLLED_POLICY_BRIDGE_V24_0""",
    "bridge import"
)

old="""const tokenIntelligenceShadowV23=createTokenIntelligenceShadowV23({dataDir}); // SHADOW ONLY: never feeds evaluate()/execution"""

new="""const tokenIntelligenceShadowV23=createTokenIntelligenceShadowV23({dataDir}); // Frozen V23 intelligence
const v24ControlledPolicyBridge=createV24ControlledPolicyBridgeV24_0({
  dataDir,
  mode:process.env.MEMEFLOW_V24_POLICY_BRIDGE_MODE||'OFF',
  killSwitch:
    String(
      process.env.MEMEFLOW_V24_POLICY_BRIDGE_KILL_SWITCH??'true'
    ).toLowerCase()!=='false',
  readinessProvider:
    ()=>tokenIntelligenceShadowV23.auditV23ReadinessFreeze(),
  candidateProvider:
    ()=>tokenIntelligenceShadowV23.buildPolicyCandidate(),
  tokenIntelligenceProvider:
    mint=>tokenIntelligenceShadowV23.inspect(mint)
}); // V24.0 defaults OFF + killed; only BUY READY -> WATCH can ever be enforced

function __mfApplyV24PolicyBridge(uid,token,decision){
  return v24ControlledPolicyBridge.apply({
    uid,
    token,
    decision
  });
}"""

a=once(
    a,
    old,
    new,
    "bridge construction"
)

old="""  return {
    ...decision,
    mint,
    // MEMEFLOW_TRADE_ELIGIBLE_CANONICAL_STATE_V21
    tradeEligible:
      isOpen
        ? true
        : (
            eligible &&
            liveTruth.pass===true &&
            String(decision?.state||'').toUpperCase()==='BUY READY'
          ),
"""

new="""  if(!isOpen){
    decision=__mfApplyV24PolicyBridge(
      uid,
      token,
      decision
    );
  }

  return {
    ...decision,
    mint,
    // MEMEFLOW_TRADE_ELIGIBLE_CANONICAL_STATE_V21
    tradeEligible:
      isOpen
        ? true
        : (
            eligible &&
            liveTruth.pass===true &&
            String(decision?.state||'').toUpperCase()==='BUY READY'
          ),
"""

a=once(
    a,
    old,
    new,
    "live decision bridge"
)

old="""        const d=evaluate(token,settings);
        const saved={
          ...d,
"""

new="""        const rawDecision=evaluate(token,settings);
        const d=__mfApplyV24PolicyBridge(
          uid,
          token,
          rawDecision
        );
        const saved={
          ...d,
"""

a=once(
    a,
    old,
    new,
    "settings reevaluation bridge"
)

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route=r"""/* MEMEFLOW_V24_CONTROLLED_POLICY_BRIDGE_MONITOR_V24_0
 * Owner-only diagnostics. Runtime mode comes from environment/configuration;
 * there is intentionally NO enable/apply HTTP endpoint in V24.0.
 */
 if(
   url.pathname==='/api/owner/intelligence/v24-policy-bridge' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const limit=Math.max(
     1,
     Math.min(
       200,
       Number(
         url.searchParams.get('limit')||50
       )
     )
   );

   return json(res,200,{
     ok:true,
     owner:true,
     controlledIntegration:true,
     bridge:
       v24ControlledPolicyBridge.status(),
     recent:
       v24ControlledPolicyBridge.listRecent({
         limit
       }),
     readiness:
       tokenIntelligenceShadowV23
         .auditV23ReadinessFreeze()
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

a=once(
    a,
    anchor,
    route,
    "bridge owner route"
)

ap.write_text(a,encoding="utf-8")

html_anchor="""      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

html_block=r"""      <!-- MEMEFLOW_V24_CONTROLLED_POLICY_BRIDGE_V24_0_UI -->
      <section
        id="v24PolicyBridgeMonitor"
        class="oi-panel oi-v24-policy-bridge"
      >
        <div class="oi-panel-head">
          <div>
            <span class="oi-eyebrow">
              V24 CONTROLLED INTEGRATION
            </span>
            <h2>V24.0 Policy Bridge</h2>
            <p>
              First one-way bridge from frozen V23 intelligence into the
              V22 decision path. It can only downgrade BUY READY to WATCH.
              Default mode is OFF and the bridge kill switch defaults ON.
            </p>
          </div>

          <span
            id="v24PolicyBridgeStatus"
            class="oi-ai-status"
          >
            LOADING
          </span>
        </div>

        <div class="oi-grid oi-grid-4">
          <article class="oi-stat">
            <span>MODE</span>
            <strong id="v24PolicyBridgeMode">—</strong>
            <small>OFF / SHADOW / ENFORCE</small>
          </article>

          <article class="oi-stat">
            <span>KILL SWITCH</span>
            <strong id="v24PolicyBridgeKill">—</strong>
            <small>bridge-local control</small>
          </article>

          <article class="oi-stat">
            <span>WOULD DOWNGRADE</span>
            <strong id="v24PolicyBridgeShadowCount">—</strong>
            <small>shadow observations</small>
          </article>

          <article class="oi-stat">
            <span>ENFORCED</span>
            <strong id="v24PolicyBridgeEnforcedCount">—</strong>
            <small>BUY READY → WATCH</small>
          </article>
        </div>

        <div class="oi-grid oi-grid-2">
          <div>
            <h3>Bridge contract</h3>
            <div
              id="v24PolicyBridgeContract"
              class="oi-list"
            ></div>
          </div>

          <div>
            <h3>Readiness</h3>
            <div
              id="v24PolicyBridgeReadiness"
              class="oi-list"
            ></div>
          </div>
        </div>

        <div
          id="v24PolicyBridgeVerdict"
          class="oi-promotion-blocker"
          data-state="blocked"
        >
          Loading controlled integration status.
        </div>
      </section>

      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

h=once(
    h,
    html_anchor,
    html_block,
    "bridge UI"
)

hp.write_text(h,encoding="utf-8")

js_anchor="""/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

js_block=r"""/* MEMEFLOW_V24_CONTROLLED_POLICY_BRIDGE_V24_0_UI_JS */
function renderV24PolicyBridge(payload={}){
  const bridge=payload?.bridge||{};
  const readiness=payload?.readiness||{};
  const v24=readiness?.v24||{};

  const badge=$('v24PolicyBridgeStatus');

  if(badge){
    const mode=String(bridge?.mode||'OFF').toUpperCase();
    const killed=bridge?.killSwitch===true;

    badge.className=
      'oi-ai-status '+
      (
        mode==='ENFORCE' && !killed
          ? 'online'
          : ''
      );

    badge.textContent=
      killed
        ? 'KILLED'
        : mode;
  }

  $('v24PolicyBridgeMode').textContent=
    bridge?.mode||'OFF';

  $('v24PolicyBridgeKill').textContent=
    bridge?.killSwitch===true
      ? 'ON'
      : 'OFF';

  $('v24PolicyBridgeShadowCount').textContent=
    num(
      bridge?.shadowWouldDowngrade,
      0
    );

  $('v24PolicyBridgeEnforcedCount').textContent=
    num(
      bridge?.enforcedDowngrades,
      0
    );

  $('v24PolicyBridgeContract').innerHTML=[
    ['Allowed mutation','BUY READY → WATCH only'],
    ['Can upgrade','NO'],
    ['Can execute trade','NO'],
    ['Score mutation','NO'],
    ['Settings mutation','NO'],
    ['Forecast mutation','NO'],
    ['Automatic promotion','NO']
  ].map(([name,value])=>`
    <div class="oi-row">
      <span>${esc(name)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join('');

  $('v24PolicyBridgeReadiness').innerHTML=[
    [
      'Architecture frozen',
      readiness?.architecture?.structuralReady===true
        ? 'YES'
        : 'NO'
    ],
    [
      'Controlled activation eligible',
      v24?.controlledActivationEligible===true
        ? 'YES'
        : 'NO'
    ],
    [
      'Evidence',
      readiness?.evidence?.status||'—'
    ],
    [
      'Policy review',
      readiness?.evidence?.policyReviewStatus||'—'
    ]
  ].map(([name,value])=>`
    <div class="oi-row">
      <span>${esc(name)}</span>
      <strong>${esc(String(value).replaceAll('_',' '))}</strong>
    </div>
  `).join('');

  const verdict=$('v24PolicyBridgeVerdict');

  if(verdict){
    const active=
      bridge?.mode==='ENFORCE' &&
      bridge?.killSwitch!==true &&
      v24?.controlledActivationEligible===true;

    verdict.dataset.state=
      active
        ? 'ready'
        : 'blocked';

    verdict.textContent=
      active
        ? 'V24 BRIDGE ENFORCEMENT IS ACTIVE. It remains one-way: only BUY READY → WATCH.'
        : (
            bridge?.mode==='SHADOW' &&
            bridge?.killSwitch!==true
              ? 'V24 BRIDGE IS IN SHADOW MODE. It records would-downgrade decisions but cannot change live state.'
              : 'V24 BRIDGE IS SAFE/INACTIVE. V22 decisions remain unchanged.'
          );
  }
}

async function loadV24PolicyBridge(){
  try{
    const payload=await api(
      '/api/owner/intelligence/v24-policy-bridge'
    );

    renderV24PolicyBridge(payload);
  }catch(error){
    const badge=$('v24PolicyBridgeStatus');

    if(badge){
      badge.className='oi-ai-status offline';
      badge.textContent='UNAVAILABLE';
    }

    const verdict=$('v24PolicyBridgeVerdict');

    if(verdict){
      verdict.dataset.state='blocked';
      verdict.textContent=
        `V24 policy bridge unavailable: ${error.message}`;
    }
  }
}

/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

j=once(
    j,
    js_anchor,
    js_block,
    "bridge UI JS"
)

old="""      loadPolicyReview(),
      loadV23Readiness()
    ]);
"""

j=once(
    j,
    old,
    """      loadPolicyReview(),
      loadV23Readiness(),
      loadV24PolicyBridge()
    ]);
""",
    "bridge load"
)

jp.write_text(j,encoding="utf-8")

css_anchor="""/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

css_block=r"""/* ==========================================================
   MEMEFLOW_V24_CONTROLLED_POLICY_BRIDGE_V24_0
   ========================================================== */

.oi-v24-policy-bridge
.oi-grid-2{
  margin-top:12px;
}

.oi-v24-policy-bridge
.oi-list{
  margin-top:7px;
}

/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

c=once(
    c,
    css_anchor,
    css_block,
    "bridge CSS"
)

cp.write_text(c,encoding="utf-8")

print("V24_0_TRANSFORM_OK")

PY

python3 - <<'PY'
import json
from pathlib import Path

p=Path("memeflow-app/package.json")
d=json.loads(p.read_text(encoding="utf-8"))
s=d["scripts"]["test:core"]

needle="node tests/shadow-e2e-readiness-freeze-v23_23.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-e2e-readiness-freeze-v23_23.mjs && node tests/controlled-policy-bridge-v24_0.mjs && node tests/assist-fresh-decision-v22.mjs"

if s.count(needle)!=1:
    raise SystemExit(
        "V24.0 REFUSED: package test anchor changed"
    )

if "controlled-policy-bridge-v24_0.mjs" in s:
    raise SystemExit(
        "V24.0 REFUSED: bridge test already installed"
    )

d["scripts"]["test:core"]=s.replace(
    needle,
    replacement,
    1
)

p.write_text(
    json.dumps(d,indent=2)+"\n",
    encoding="utf-8"
)

print("PACKAGE_TRANSFORM_OK")

PY

python3 - <<'PY'
from pathlib import Path

for name in [
 "memeflow-app/app-server.mjs",
 "memeflow-app/package.json",
 "memeflow-app/owner-intelligence.html",
 "memeflow-app/owner-intelligence.js",
 "memeflow-app/owner-intelligence.css",
 "memeflow-app/src/controlled-policy-bridge-v24_0.mjs",
 "memeflow-app/tests/controlled-policy-bridge-v24_0.mjs"
]:
    p=Path(name)
    p.write_text(
        p.read_text(encoding="utf-8").rstrip("\n")+"\n",
        encoding="utf-8"
    )

print("V24_0_EOF_NORMALIZATION_OK")
PY

echo
echo "=== V24.0 SYNTAX ==="

node --check "$APP"
node --check "$MODULE"
node --check "$TEST"
node --check "$JS"

node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"

echo "SYNTAX_OK"

echo
echo "=== V24.0 TARGETED TESTS ==="

(
  cd memeflow-app

  node tests/shadow-e2e-readiness-freeze-v23_23.mjs
  node tests/controlled-policy-bridge-v24_0.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
  node tests/settings-reevaluate-live-priority-v42.mjs
  node tests/preopen-admission-recheck-v46.mjs
  node tests/paper-engine-auto.mjs
)

echo "TARGETED_TESTS_OK"

echo
echo "=== V24.0 FULL PROJECT TEST SUITE ==="

(
  cd memeflow-app
  npm test
)

echo "FULL_TEST_SUITE_OK"

echo
echo "=== V24.0 STATIC CONTRACT AUDIT ==="

python3 - <<'PY'
from pathlib import Path

root=Path("memeflow-app")

m=(root/"src/controlled-policy-bridge-v24_0.mjs").read_text()
a=(root/"app-server.mjs").read_text()
h=(root/"owner-intelligence.html").read_text()
j=(root/"owner-intelligence.js").read_text()
c=(root/"owner-intelligence.css").read_text()
p=(root/"package.json").read_text()

errors=[]

for x in [
 "MEMEFLOW_V24_CONTROLLED_POLICY_BRIDGE_V24_0",
 "BUY_READY_TO_WATCH_ONLY",
 "canUpgrade:false",
 "canExecuteTrade:false",
 "scoreMutation:false",
 "settingsMutation:false",
 "forecastMutation:false",
 "automaticPromotion:false",
 "WOULD_DOWNGRADE_TO_WATCH",
 "DOWNGRADE_TO_WATCH",
 "FAIL_CLOSED_TO_WATCH",
 "V24_ACTIVATION_READINESS_NOT_SATISFIED"
]:
    if x not in m:
        errors.append("bridge marker missing: "+x)

for x in [
 "from './evaluate.mjs'",
 "openPosition(",
 "closePosition(",
 "setSettings("
]:
    if x in m:
        errors.append("forbidden bridge authority: "+x)

for x in [
 "createV24ControlledPolicyBridgeV24_0",
 "__mfApplyV24PolicyBridge",
 "MEMEFLOW_V24_POLICY_BRIDGE_MODE",
 "MEMEFLOW_V24_POLICY_BRIDGE_KILL_SWITCH",
 "rawDecision=evaluate(token,settings)",
 "/api/owner/intelligence/v24-policy-bridge"
]:
    if x not in a:
        errors.append("app wiring missing: "+x)

if "/api/owner/intelligence/v24-policy-bridge/enable" in a:
    errors.append("forbidden enable endpoint exists")

if "/api/owner/intelligence/v24-policy-bridge/apply" in a:
    errors.append("forbidden apply endpoint exists")

for x in [
 'id="v24PolicyBridgeStatus"',
 'id="v24PolicyBridgeMode"',
 'id="v24PolicyBridgeKill"',
 'id="v24PolicyBridgeShadowCount"',
 'id="v24PolicyBridgeEnforcedCount"',
 'id="v24PolicyBridgeVerdict"'
]:
    if x not in h:
        errors.append("UI missing: "+x)

for x in [
 "loadV24PolicyBridge",
 "renderV24PolicyBridge",
 "/api/owner/intelligence/v24-policy-bridge"
]:
    if x not in j:
        errors.append("UI JS missing: "+x)

if ".oi-v24-policy-bridge" not in c:
    errors.append("UI CSS missing")

if "controlled-policy-bridge-v24_0.mjs" not in p:
    errors.append("V24.0 test missing from package")

# Frozen V23 must remain frozen and untouched.
manifest=(root/"v23-freeze-manifest.json").read_text()
if '"frozen": true' not in manifest:
    errors.append("V23 freeze manifest lost frozen=true")
if '"liveAuthority": "V22"' not in manifest:
    errors.append("V23 freeze liveAuthority changed")

if errors:
    raise SystemExit(
        "V24_0_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V24_0_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V24.0 DIFF ==="
git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|owner-intelligence\.html|owner-intelligence\.js|owner-intelligence\.css|src/controlled-policy-bridge-v24_0\.mjs|tests/controlled-policy-bridge-v24_0\.mjs)$'

BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "V24.0 REFUSED: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V24.0 STAGED ==="
git diff --cached --stat

git commit -m "feat: add controlled v23-to-v22 policy bridge v24.0"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline --decorate

echo
echo "V24.0 CONTRACT:"
echo "  bridge is wired into canonical live decision + settings reevaluation paths"
echo "  default mode OFF"
echo "  default bridge kill switch ON"
echo "  OFF: no effect"
echo "  SHADOW: records would-downgrade only"
echo "  ENFORCE: only BUY READY -> WATCH, never an upgrade"
echo "  ENFORCE requires V23.23 controlledActivationEligible + ready V23.20 candidate"
echo "  bridge uses per-token V23.18 error-aware evidence"
echo "  bridge-local audit JSONL is recorded"
echo "  no enable/apply HTTP endpoint exists"
echo "  no Score/Settings/forecast mutation"
echo "  no trade execution authority"
echo "  V22 remains the underlying live decision authority"
