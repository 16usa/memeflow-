#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

[[ -n "$ROOT" ]] || {
  echo "ERROR: run inside MEMEFLOW repo"
  exit 1
}

cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="e17c74d5c354d2db6229efd5fc8b5ee2113e86c3"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
HTML="memeflow-app/owner-intelligence.html"
JS="memeflow-app/owner-intelligence.js"
CSS="memeflow-app/owner-intelligence.css"
MODULE="memeflow-app/src/shadow-e2e-readiness-freeze-v23_23.mjs"
TEST="memeflow-app/tests/shadow-e2e-readiness-freeze-v23_23.mjs"
MANIFEST="memeflow-app/v23-freeze-manifest.json"

MODIFIED=("$APP" "$SHADOW" "$PKG" "$HTML" "$JS" "$CSS")
NEW_FILES=("$MODULE" "$TEST" "$MANIFEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW V23 END-TO-END READINESS / FREEZE V23.23 ==="

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
      echo "V23.23 REFUSED: active git process"
      echo "$active"
      exit 1
    fi

    rm -f .git/index.lock
  fi
}

clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.23 REFUSED: wrong branch"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.23 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || {
    echo "V23.23 REFUSED: missing $f"
    exit 1
  }

  git diff --quiet -- "$f" || {
    echo "V23.23 REFUSED: local changes in $f"
    exit 1
  }

  git diff --cached --quiet -- "$f" || {
    echo "V23.23 REFUSED: staged changes in $f"
    exit 1
  }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || {
    echo "V23.23 REFUSED: $f already exists"
    exit 1
  }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/v23-e2e-readiness-freeze-v23-23-$STAMP"

mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.23 FAILED - RESTORING ==="

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

EOF_MODULE

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createV23E2EReadinessFreezeV23_23
} from '../src/shadow-e2e-readiness-freeze-v23_23.mjs';

const tmp=
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'mf-v23-23-'
    )
  );

const manifestPath=
  path.join(
    tmp,
    'v23-freeze-manifest.json'
  );

fs.writeFileSync(
  manifestPath,
  JSON.stringify({
    version:
      'MEMEFLOW_V23_FREEZE_MANIFEST_V23_23',
    frozen:true,
    shadowOnly:true,
    liveAuthority:'V22',
    automaticPromotion:false,
    applicationAllowed:false,
    applyEndpointExists:false,
    nextMajor:
      'V24_CONTROLLED_INTEGRATION'
  }),
  'utf8'
);

const names=[
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
];

const components={};

for(const name of names){
  components[name]={
    status(){
      return {
        version:
          `TEST_${name}`
      };
    }
  };
}

components.shadowPolicyReviewGate={
  status(){
    return {
      version:'TEST_REVIEW',
      last:{
        status:
          'POLICY_CANDIDATE_FOR_MANUAL_REVIEW',
        candidateForManualReview:true,
        drift:{
          status:'STABLE'
        },
        calibration:{
          status:
            'CALIBRATION_HEALTHY'
        }
      }
    };
  }
};

try{
  const freeze=
    createV23E2EReadinessFreezeV23_23({
      components,
      manifestPath
    });

  const result=
    freeze.audit();

  assert.equal(
    result.architecture.structuralReady,
    true
  );

  assert.equal(
    result.architecture.freezeStatus,
    'V23_ARCHITECTURE_FROZEN'
  );

  assert.equal(
    result.architecture.expectedComponents,
    21
  );

  assert.equal(
    result.architecture.presentComponents,
    21
  );

  assert.equal(
    result.architecture.missing.length,
    0
  );

  assert.equal(
    result.evidence.ready,
    true
  );

  assert.equal(
    result.v24.integrationCodeMayBegin,
    true
  );

  assert.equal(
    result.v24.controlledActivationEligible,
    true
  );

  assert.equal(
    result.freeze.frozen,
    true
  );

  assert.equal(
    result.freeze.nextMajor,
    'V24_CONTROLLED_INTEGRATION'
  );

  assert.equal(
    result.controls.v22OnlyTradingAuthority,
    true
  );

  assert.equal(
    result.controls.applicationAllowed,
    false
  );

  assert.equal(
    result.controls.applyEndpointExists,
    false
  );

  const evidenceBuildingComponents={
    ...components,
    shadowPolicyReviewGate:{
      status(){
        return {
          version:'TEST_REVIEW',
          last:{
            status:
              'POLICY_REVIEW_EVIDENCE_BUILDING',
            candidateForManualReview:false,
            drift:{
              status:'STABLE'
            },
            calibration:{
              status:
                'CALIBRATION_HEALTHY'
            }
          }
        };
      }
    }
  };

  const building=
    createV23E2EReadinessFreezeV23_23({
      components:
        evidenceBuildingComponents,
      manifestPath
    }).audit();

  assert.equal(
    building.architecture.structuralReady,
    true
  );

  assert.equal(
    building.evidence.ready,
    false
  );

  assert.equal(
    building.v24.integrationCodeMayBegin,
    true
  );

  assert.equal(
    building.v24.controlledActivationEligible,
    false
  );

  const missingComponents={
    ...components
  };

  delete missingComponents
    .shadowPolicySimulator;

  const blocked=
    createV23E2EReadinessFreezeV23_23({
      components:
        missingComponents,
      manifestPath
    }).audit();

  assert.equal(
    blocked.architecture.structuralReady,
    false
  );

  assert.ok(
    blocked.architecture.missing
      .includes(
        'shadowPolicySimulator'
      )
  );

  const source=
    fs.readFileSync(
      'src/shadow-e2e-readiness-freeze-v23_23.mjs',
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

  const manifest=
    JSON.parse(
      fs.readFileSync(
        'v23-freeze-manifest.json',
        'utf8'
      )
    );

  assert.match(
    shadow,
    /createV23E2EReadinessFreezeV23_23/
  );

  assert.match(
    shadow,
    /v23ReadinessFreezeStatus/
  );

  assert.match(
    shadow,
    /auditV23ReadinessFreeze/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/v23-readiness/
  );

  assert.doesNotMatch(
    app,
    /\/api\/owner\/intelligence\/v23-readiness\/apply/
  );

  assert.match(
    html,
    /id="v23ReadinessStatus"/
  );

  assert.match(
    js,
    /loadV23Readiness/
  );

  assert.equal(
    manifest.frozen,
    true
  );

  assert.equal(
    manifest.liveAuthority,
    'V22'
  );

  assert.equal(
    manifest.nextMajor,
    'V24_CONTROLLED_INTEGRATION'
  );

  console.log(
    'v23 end-to-end readiness freeze v23.23 ok'
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

cat > "$MANIFEST" <<'EOF_MANIFEST'
{
  "version": "MEMEFLOW_V23_FREEZE_MANIFEST_V23_23",
  "frozen": true,
  "frozenRange": "V23.0-V23.23",
  "shadowOnly": true,
  "liveAuthority": "V22",
  "automaticPromotion": false,
  "applicationAllowed": false,
  "applyEndpointExists": false,
  "nextMajor": "V24_CONTROLLED_INTEGRATION",
  "freezeRule": "NO_NEW_V23_INTELLIGENCE_MODULES_AFTER_V23_23; FIXES_ONLY",
  "criticalChain": [
    "V23 token intelligence network",
    "V23.2 wallet reputation",
    "V23.3 learning dataset",
    "V23.4 mathematical brain",
    "V23.5 model arena",
    "V23.6 drift/regime",
    "V23.7 confidence governor",
    "V23.8 token trajectory",
    "V23.9 token pattern memory",
    "V23.10 evidence synthesis",
    "V23.11 outcome calibration",
    "V23.12 champion benchmark",
    "V23.13 promotion readiness gate",
    "V23.14 promotion report",
    "V23.15 token scorecard",
    "V23.16 outcome review",
    "V23.17 error pattern learner",
    "V23.18 error-aware confidence",
    "V23.19 error-aware benchmark",
    "V23.20 policy candidate",
    "V23.21 policy simulator",
    "V23.22 policy review gate",
    "V23.23 end-to-end readiness freeze"
  ],
  "activationRule": "V24 code may be built after structural freeze; controlled activation requires V23.22 manual-review eligibility plus healthy calibration/drift."
}
EOF_MANIFEST

python3 - <<'PY'
from pathlib import Path

sp=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs")
ap=Path("memeflow-app/app-server.mjs")
hp=Path("memeflow-app/owner-intelligence.html")
jp=Path("memeflow-app/owner-intelligence.js")
cp=Path("memeflow-app/owner-intelligence.css")

s=sp.read_text(encoding="utf-8")
a=ap.read_text(encoding="utf-8")
h=hp.read_text(encoding="utf-8")
j=jp.read_text(encoding="utf-8")
c=cp.read_text(encoding="utf-8")

def once(text,old,new,label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(
            f"V23.23 REFUSED: {label}: expected 1 exact match, got {n}"
        )
    return text.replace(old,new,1)

old="""import {
  createShadowPolicyReviewGateV23_22
} from './shadow-policy-review-gate-v23_22.mjs';"""

s=once(
    s,
    old,
    old+"""
import {
  createV23E2EReadinessFreezeV23_23
} from './shadow-e2e-readiness-freeze-v23_23.mjs';""",
    "freeze import"
)

old="""  const shadowPolicyReviewGate=
    createShadowPolicyReviewGateV23_22({
      policyCandidateBuilder:
        shadowPolicyCandidateBuilder,
      policySimulator:
        shadowPolicySimulator,
      errorAwareBenchmark:
        shadowErrorAwareBenchmark,
      outcomeCalibration:
        shadowOutcomeCalibration,
      driftRegime:
        shadowDriftRegime
    });"""

new=old+"""

  const v23ReadinessFreeze=
    createV23E2EReadinessFreezeV23_23({
      manifestPath:
        path.join(
          process.cwd(),
          'v23-freeze-manifest.json'
        ),
      components:{
        walletReputation,
        learningDataset,
        shadowMathBrain,
        shadowModelArena,
        shadowDriftRegime,
        shadowConfidenceGovernor,
        shadowTokenTrajectory,
        shadowTokenPatternMemory,
        shadowEvidenceSynthesis,
        shadowOutcomeCalibration,
        shadowChampionBenchmark,
        shadowPromotionGate,
        shadowPromotionReport,
        tokenIntelligenceScorecard,
        shadowOutcomeReview,
        shadowErrorPatternLearner,
        shadowErrorAwareConfidence,
        shadowErrorAwareBenchmark,
        shadowPolicyCandidateBuilder,
        shadowPolicySimulator,
        shadowPolicyReviewGate
      }
    });"""

s=once(
    s,
    old,
    new,
    "freeze construction"
)

s=once(
    s,
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_22'",
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_23'",
    "network version"
)

old="""      shadowPolicySimulator:shadowPolicySimulator.status(),
      shadowPolicyReviewGate:shadowPolicyReviewGate.status()
"""

s=once(
    s,
    old,
    """      shadowPolicySimulator:shadowPolicySimulator.status(),
      shadowPolicyReviewGate:shadowPolicyReviewGate.status(),
      v23ReadinessFreeze:v23ReadinessFreeze.status()
""",
    "freeze status"
)

old="""    evaluatePolicyReviewGate:
      ()=>shadowPolicyReviewGate.evaluate(),
    status
"""

s=once(
    s,
    old,
    """    evaluatePolicyReviewGate:
      ()=>shadowPolicyReviewGate.evaluate(),
    v23ReadinessFreezeStatus:
      ()=>v23ReadinessFreeze.status(),
    auditV23ReadinessFreeze:
      ()=>v23ReadinessFreeze.audit(),
    status
""",
    "freeze API"
)

sp.write_text(s,encoding="utf-8")

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route=r"""/* MEMEFLOW_V23_E2E_READINESS_FREEZE_MONITOR_V23_23
 * Owner-only read-only V23 closure audit. No apply route exists.
 */
 if(
   url.pathname==='/api/owner/intelligence/v23-readiness' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const result=
     tokenIntelligenceShadowV23
       .auditV23ReadinessFreeze();

   return json(res,200,{
     ok:true,
     owner:true,
     shadowOnly:true,
     readinessAuditOnly:true,
     v22OnlyTradingAuthority:true,
     applicationAllowed:false,
     automaticPromotion:false,
     applyEndpointExists:false,
     result
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

a=once(
    a,
    anchor,
    route,
    "freeze owner route"
)

ap.write_text(a,encoding="utf-8")

html_anchor="""      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

html_block=r"""      <!-- MEMEFLOW_V23_E2E_READINESS_FREEZE_V23_23_UI -->
      <section
        id="v23ReadinessMonitor"
        class="oi-panel oi-v23-readiness"
      >
        <div class="oi-panel-head">
          <div>
            <span class="oi-eyebrow">
              V23 CLOSURE · END-TO-END FREEZE
            </span>
            <h2>V23.23 Readiness & Freeze</h2>
            <p>
              Final architecture audit for the complete V23 shadow chain.
              Architecture freeze and real-evidence activation readiness are
              shown separately. V22 remains the only trading authority.
            </p>
          </div>

          <span
            id="v23ReadinessStatus"
            class="oi-ai-status"
          >
            LOADING
          </span>
        </div>

        <div class="oi-grid oi-grid-4">
          <article class="oi-stat">
            <span>COMPONENTS</span>
            <strong id="v23ReadinessComponents">—</strong>
            <small>present / expected</small>
          </article>

          <article class="oi-stat">
            <span>ARCHITECTURE</span>
            <strong id="v23ReadinessArchitecture">—</strong>
            <small>freeze status</small>
          </article>

          <article class="oi-stat">
            <span>EVIDENCE</span>
            <strong id="v23ReadinessEvidence">—</strong>
            <small>real outcome readiness</small>
          </article>

          <article class="oi-stat">
            <span>NEXT MAJOR</span>
            <strong id="v23ReadinessNext">V24</strong>
            <small>controlled integration</small>
          </article>
        </div>

        <div class="oi-grid oi-grid-2">
          <div>
            <h3>Closure checks</h3>
            <div
              id="v23ReadinessChecks"
              class="oi-promotion-checks"
            ></div>
          </div>

          <div>
            <h3>V24 handoff</h3>
            <div
              id="v23ReadinessHandoff"
              class="oi-list"
            ></div>
          </div>
        </div>

        <div
          id="v23ReadinessVerdict"
          class="oi-promotion-blocker"
          data-state="blocked"
        >
          Auditing V23 architecture.
        </div>
      </section>

      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

h=once(
    h,
    html_anchor,
    html_block,
    "freeze UI"
)

hp.write_text(h,encoding="utf-8")

js_anchor="""/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

js_block=r"""/* MEMEFLOW_V23_E2E_READINESS_FREEZE_V23_23_UI_JS */
function renderV23Readiness(payload={}){
  const result=payload?.result||{};
  const architecture=result?.architecture||{};
  const evidence=result?.evidence||{};
  const v24=result?.v24||{};
  const freeze=result?.freeze||{};

  const badge=$('v23ReadinessStatus');

  if(badge){
    badge.className=
      'oi-ai-status '+
      (
        architecture?.structuralReady===true
          ? 'online'
          : 'offline'
      );

    badge.textContent=
      architecture?.structuralReady===true
        ? 'V23 ARCHITECTURE FROZEN'
        : 'FREEZE BLOCKED';
  }

  $('v23ReadinessComponents').textContent=
    `${num(architecture?.presentComponents,0)} / ${num(architecture?.expectedComponents,0)}`;

  $('v23ReadinessArchitecture').textContent=
    architecture?.structuralReady===true
      ? 'FROZEN'
      : 'BLOCKED';

  $('v23ReadinessEvidence').textContent=
    evidence?.ready===true
      ? 'READY'
      : (
          String(
            evidence?.status||''
          ).includes('BLOCKED')
            ? 'BLOCKED'
            : 'BUILDING'
        );

  $('v23ReadinessNext').textContent='V24';

  const checks=[
    [
      'Freeze manifest',
      architecture?.manifestContractOk===true
    ],
    [
      'All V23 components present',
      Number(architecture?.presentComponents||0)===
        Number(architecture?.expectedComponents||-1)
    ],
    [
      'All component status calls healthy',
      Array.isArray(architecture?.statusErrors) &&
      architecture.statusErrors.length===0
    ],
    [
      'V22 is only trading authority',
      result?.controls?.v22OnlyTradingAuthority===true
    ],
    [
      'No live apply capability',
      result?.controls?.applicationAllowed===false &&
      result?.controls?.applyEndpointExists===false
    ]
  ];

  $('v23ReadinessChecks').innerHTML=
    checks.map(([label,pass])=>`
      <div class="oi-promotion-check ${pass?'pass':'fail'}">
        <span class="oi-promotion-check-dot"></span>
        <div>
          <strong>${esc(label)}</strong>
          <small>${pass?'PASS':'FAIL'}</small>
        </div>
      </div>
    `).join('');

  $('v23ReadinessHandoff').innerHTML=[
    [
      'Frozen range',
      freeze?.frozenRange||'—'
    ],
    [
      'Freeze rule',
      freeze?.rule||'—'
    ],
    [
      'V24 code may begin',
      v24?.integrationCodeMayBegin===true
        ? 'YES'
        : 'NO'
    ],
    [
      'V24 activation eligible',
      v24?.controlledActivationEligible===true
        ? 'YES'
        : 'NO'
    ],
    [
      'Policy review',
      evidence?.policyReviewStatus||'—'
    ],
    [
      'Calibration',
      evidence?.calibrationStatus||'—'
    ],
    [
      'Drift',
      evidence?.driftStatus||'—'
    ]
  ].map(([name,value])=>`
    <div class="oi-row">
      <span>${esc(name)}</span>
      <strong>${esc(String(value).replaceAll('_',' '))}</strong>
    </div>
  `).join('');

  const verdict=$('v23ReadinessVerdict');

  if(verdict){
    verdict.dataset.state=
      architecture?.structuralReady===true
        ? 'ready'
        : 'blocked';

    verdict.textContent=
      architecture?.structuralReady===true
        ? (
            evidence?.ready===true
              ? 'V23 ARCHITECTURE IS FROZEN AND REAL EVIDENCE IS READY FOR V24 CONTROLLED ACTIVATION.'
              : 'V23 ARCHITECTURE IS FROZEN. V24 CODE MAY BEGIN, BUT CONTROLLED ACTIVATION REMAINS LOCKED UNTIL REAL EVIDENCE PASSES V23.22.'
          )
        : 'V23 FREEZE BLOCKED: architecture or contract checks failed.';
  }
}

async function loadV23Readiness(){
  try{
    const payload=await api(
      '/api/owner/intelligence/v23-readiness'
    );

    renderV23Readiness(payload);
  }catch(error){
    const badge=$('v23ReadinessStatus');

    if(badge){
      badge.className='oi-ai-status offline';
      badge.textContent='UNAVAILABLE';
    }

    const verdict=$('v23ReadinessVerdict');

    if(verdict){
      verdict.dataset.state='blocked';
      verdict.textContent=
        `V23 readiness unavailable: ${error.message}`;
    }
  }
}

/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

j=once(
    j,
    js_anchor,
    js_block,
    "freeze UI JS"
)

old="""      loadPolicySimulation(),
      loadPolicyReview()
    ]);
"""

j=once(
    j,
    old,
    """      loadPolicySimulation(),
      loadPolicyReview(),
      loadV23Readiness()
    ]);
""",
    "freeze load"
)

jp.write_text(j,encoding="utf-8")

css_anchor="""/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

css_block=r"""/* ==========================================================
   MEMEFLOW_V23_E2E_READINESS_FREEZE_V23_23
   ========================================================== */

.oi-v23-readiness
.oi-grid-2{
  margin-top:12px;
}

.oi-v23-readiness
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
    "freeze CSS"
)

cp.write_text(c,encoding="utf-8")

print("V23_23_TRANSFORM_OK")

PY

python3 - <<'PY'
import json
from pathlib import Path

p=Path("memeflow-app/package.json")
d=json.loads(p.read_text(encoding="utf-8"))
s=d["scripts"]["test:core"]

needle="node tests/shadow-policy-review-gate-v23_22.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-policy-review-gate-v23_22.mjs && node tests/shadow-e2e-readiness-freeze-v23_23.mjs && node tests/assist-fresh-decision-v22.mjs"

if s.count(needle)!=1:
    raise SystemExit(
        "V23.23 REFUSED: package test anchor changed"
    )

if "shadow-e2e-readiness-freeze-v23_23.mjs" in s:
    raise SystemExit(
        "V23.23 REFUSED: freeze test already installed"
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
 "memeflow-app/src/token-intelligence-shadow-v23.mjs",
 "memeflow-app/package.json",
 "memeflow-app/owner-intelligence.html",
 "memeflow-app/owner-intelligence.js",
 "memeflow-app/owner-intelligence.css",
 "memeflow-app/src/shadow-e2e-readiness-freeze-v23_23.mjs",
 "memeflow-app/tests/shadow-e2e-readiness-freeze-v23_23.mjs",
 "memeflow-app/v23-freeze-manifest.json"
]:
    p=Path(name)
    p.write_text(
        p.read_text(encoding="utf-8").rstrip("\n")+"\n",
        encoding="utf-8"
    )

print("V23_23_EOF_NORMALIZATION_OK")
PY

echo
echo "=== V23.23 SYNTAX ==="

node --check "$APP"
node --check "$SHADOW"
node --check "$MODULE"
node --check "$TEST"
node --check "$JS"

node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); JSON.parse(require('fs').readFileSync('$MANIFEST','utf8')); console.log('JSON_OK')"

echo "SYNTAX_OK"

echo
echo "=== V23.23 TARGETED CHAIN TESTS ==="

(
  cd memeflow-app

  node tests/token-intelligence-shadow-v23.mjs
  node tests/token-intelligence-monitor-v23_1.mjs
  node tests/wallet-reputation-shadow-v23_2.mjs
  node tests/learning-dataset-shadow-v23_3.mjs
  node tests/shadow-math-brain-v23_4.mjs
  node tests/shadow-model-arena-v23_5.mjs
  node tests/shadow-drift-regime-v23_6.mjs
  node tests/shadow-confidence-governor-v23_7.mjs
  node tests/shadow-token-trajectory-v23_8.mjs
  node tests/shadow-token-pattern-memory-v23_9.mjs
  node tests/shadow-evidence-synthesis-v23_10.mjs
  node tests/shadow-outcome-calibration-v23_11.mjs
  node tests/shadow-champion-benchmark-v23_12.mjs
  node tests/shadow-promotion-gate-v23_13.mjs
  node tests/shadow-promotion-report-v23_14.mjs
  node tests/token-intelligence-scorecard-v23_15.mjs
  node tests/shadow-outcome-review-v23_16.mjs
  node tests/shadow-error-pattern-learner-v23_17.mjs
  node tests/shadow-error-aware-confidence-v23_18.mjs
  node tests/shadow-error-aware-benchmark-v23_19.mjs
  node tests/shadow-policy-candidate-builder-v23_20.mjs
  node tests/shadow-policy-simulator-v23_21.mjs
  node tests/shadow-policy-review-gate-v23_22.mjs
  node tests/shadow-e2e-readiness-freeze-v23_23.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)

echo "TARGETED_CHAIN_TESTS_OK"

echo
echo "=== V23.23 FULL PROJECT TEST SUITE ==="

(
  cd memeflow-app
  npm test
)

echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.23 STATIC END-TO-END CONTRACT AUDIT ==="

python3 - <<'PY'
from pathlib import Path
import json

root=Path("memeflow-app")

m=(root/"src/shadow-e2e-readiness-freeze-v23_23.mjs").read_text()
s=(root/"src/token-intelligence-shadow-v23.mjs").read_text()
a=(root/"app-server.mjs").read_text()
h=(root/"owner-intelligence.html").read_text()
j=(root/"owner-intelligence.js").read_text()
c=(root/"owner-intelligence.css").read_text()
p=(root/"package.json").read_text()
manifest=json.loads(
    (root/"v23-freeze-manifest.json").read_text()
)

errors=[]

required_src=[
 "token-intelligence-shadow-v23.mjs",
 "wallet-reputation-shadow-v23_2.mjs",
 "learning-dataset-shadow-v23_3.mjs",
 "shadow-math-brain-v23_4.mjs",
 "shadow-model-arena-v23_5.mjs",
 "shadow-drift-regime-v23_6.mjs",
 "shadow-confidence-governor-v23_7.mjs",
 "shadow-token-trajectory-v23_8.mjs",
 "shadow-token-pattern-memory-v23_9.mjs",
 "shadow-evidence-synthesis-v23_10.mjs",
 "shadow-outcome-calibration-v23_11.mjs",
 "shadow-champion-benchmark-v23_12.mjs",
 "shadow-promotion-gate-v23_13.mjs",
 "shadow-promotion-report-v23_14.mjs",
 "token-intelligence-scorecard-v23_15.mjs",
 "shadow-outcome-review-v23_16.mjs",
 "shadow-error-pattern-learner-v23_17.mjs",
 "shadow-error-aware-confidence-v23_18.mjs",
 "shadow-error-aware-benchmark-v23_19.mjs",
 "shadow-policy-candidate-builder-v23_20.mjs",
 "shadow-policy-simulator-v23_21.mjs",
 "shadow-policy-review-gate-v23_22.mjs",
 "shadow-e2e-readiness-freeze-v23_23.mjs"
]

required_tests=[
 "token-intelligence-shadow-v23.mjs",
 "token-intelligence-monitor-v23_1.mjs",
 "wallet-reputation-shadow-v23_2.mjs",
 "learning-dataset-shadow-v23_3.mjs",
 "shadow-math-brain-v23_4.mjs",
 "shadow-model-arena-v23_5.mjs",
 "shadow-drift-regime-v23_6.mjs",
 "shadow-confidence-governor-v23_7.mjs",
 "shadow-token-trajectory-v23_8.mjs",
 "shadow-token-pattern-memory-v23_9.mjs",
 "shadow-evidence-synthesis-v23_10.mjs",
 "shadow-outcome-calibration-v23_11.mjs",
 "shadow-champion-benchmark-v23_12.mjs",
 "shadow-promotion-gate-v23_13.mjs",
 "shadow-promotion-report-v23_14.mjs",
 "token-intelligence-scorecard-v23_15.mjs",
 "shadow-outcome-review-v23_16.mjs",
 "shadow-error-pattern-learner-v23_17.mjs",
 "shadow-error-aware-confidence-v23_18.mjs",
 "shadow-error-aware-benchmark-v23_19.mjs",
 "shadow-policy-candidate-builder-v23_20.mjs",
 "shadow-policy-simulator-v23_21.mjs",
 "shadow-policy-review-gate-v23_22.mjs",
 "shadow-e2e-readiness-freeze-v23_23.mjs"
]

for name in required_src:
    if not (root/"src"/name).is_file():
        errors.append("missing src: "+name)

for name in required_tests:
    if not (root/"tests"/name).is_file():
        errors.append("missing test: "+name)

for x in [
 "MEMEFLOW_V23_E2E_READINESS_FREEZE_V23_23",
 "V23_ARCHITECTURE_FROZEN",
 "V23_EVIDENCE_BUILDING",
 "V23_EVIDENCE_READY_FOR_V24_CONTROLLED_ACTIVATION",
 "integrationCodeMayBegin",
 "controlledActivationEligible",
 "v22OnlyTradingAuthority:true",
 "applicationAllowed:false",
 "automaticPromotion:false",
 "applyEndpointExists:false",
 "NO_NEW_V23_INTELLIGENCE_MODULES_AFTER_V23_23; FIXES_ONLY"
]:
    if x not in m:
        errors.append("freeze marker missing: "+x)

for x in [
 "from './evaluate.mjs'",
 "openPosition(",
 "closePosition(",
 "setSettings(",
 "tradeEligible",
 "decisionScore"
]:
    if x in m:
        errors.append("forbidden authority in freeze: "+x)

for x in [
 "createV23E2EReadinessFreezeV23_23",
 "v23ReadinessFreeze:v23ReadinessFreeze.status()",
 "v23ReadinessFreezeStatus",
 "auditV23ReadinessFreeze",
 "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_23"
]:
    if x not in s:
        errors.append("wiring missing: "+x)

for x in [
 "/api/owner/intelligence/v23-readiness",
 "readinessAuditOnly:true",
 "v22OnlyTradingAuthority:true",
 "applicationAllowed:false",
 "automaticPromotion:false",
 "applyEndpointExists:false"
]:
    if x not in a:
        errors.append("route missing: "+x)

if "/api/owner/intelligence/v23-readiness/apply" in a:
    errors.append("forbidden readiness apply endpoint exists")

for x in [
 'id="v23ReadinessStatus"',
 'id="v23ReadinessComponents"',
 'id="v23ReadinessArchitecture"',
 'id="v23ReadinessEvidence"',
 'id="v23ReadinessChecks"',
 'id="v23ReadinessHandoff"',
 'id="v23ReadinessVerdict"'
]:
    if x not in h:
        errors.append("UI missing: "+x)

for x in [
 "loadV23Readiness",
 "renderV23Readiness",
 "/api/owner/intelligence/v23-readiness"
]:
    if x not in j:
        errors.append("UI JS missing: "+x)

if ".oi-v23-readiness" not in c:
    errors.append("UI CSS missing")

if "shadow-e2e-readiness-freeze-v23_23.mjs" not in p:
    errors.append("V23.23 test missing from package")

for key,val in {
 "version":"MEMEFLOW_V23_FREEZE_MANIFEST_V23_23",
 "frozen":True,
 "shadowOnly":True,
 "liveAuthority":"V22",
 "automaticPromotion":False,
 "applicationAllowed":False,
 "applyEndpointExists":False,
 "nextMajor":"V24_CONTROLLED_INTEGRATION"
}.items():
    if manifest.get(key)!=val:
        errors.append(
            f"manifest mismatch {key}: {manifest.get(key)!r}"
        )

# Existing V23.22 and V22 authority contract must remain intact.
for x in [
 "shadowPolicyReviewGate.evaluate",
 "shadowPolicySimulator.simulate",
 "shadowPolicyCandidateBuilder.build",
 "shadowErrorAwareBenchmark.recordOutcome",
 "shadowErrorAwareConfidence.predict",
 "shadowErrorPatternLearner.observeReview",
 "shadowOutcomeReview.recordOutcome",
 "shadowChampionBenchmark.recordOutcome"
]:
    if x not in s:
        errors.append("backward compatibility missing: "+x)

if errors:
    raise SystemExit(
        "V23_23_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V23_23_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.23 DIFF ==="
git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|owner-intelligence\.html|owner-intelligence\.js|owner-intelligence\.css|v23-freeze-manifest\.json|src/token-intelligence-shadow-v23\.mjs|src/shadow-e2e-readiness-freeze-v23_23\.mjs|tests/shadow-e2e-readiness-freeze-v23_23\.mjs)$'

BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "V23.23 REFUSED: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.23 STAGED ==="
git diff --cached --stat

git commit -m "feat: freeze v23 end-to-end shadow architecture v23.23"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline --decorate

echo
echo "V23.23 CONTRACT:"
echo "  complete V23.0-V23.23 shadow architecture is now explicitly frozen"
echo "  freeze manifest records V22 as the only live trading authority"
echo "  architecture readiness and real-evidence activation readiness are separate"
echo "  V24 integration code may begin after structural freeze"
echo "  V24 controlled activation remains locked until V23.22 evidence is ready"
echo "  no V23 apply endpoint exists"
echo "  no automatic promotion"
echo "  no Score/State/Settings/BUY/SELL/forecast mutation"
echo "  after V23.23: V23 intelligence is FIXES ONLY; new functionality belongs to V24"
