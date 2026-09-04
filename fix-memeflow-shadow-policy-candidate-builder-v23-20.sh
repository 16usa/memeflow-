#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

[[ -n "$ROOT" ]] || {
  echo "ERROR: run inside MEMEFLOW repo"
  exit 1
}

cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="bb8f8b0eea3951f25931bc3567d784cb644aef69"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
HTML="memeflow-app/owner-intelligence.html"
JS="memeflow-app/owner-intelligence.js"
CSS="memeflow-app/owner-intelligence.css"
MODULE="memeflow-app/src/shadow-policy-candidate-builder-v23_20.mjs"
TEST="memeflow-app/tests/shadow-policy-candidate-builder-v23_20.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG" "$HTML" "$JS" "$CSS")
NEW_FILES=("$MODULE" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW SHADOW POLICY CANDIDATE BUILDER V23.20 ==="

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
      echo "V23.20 REFUSED: active git process"
      echo "$active"
      exit 1
    fi

    rm -f .git/index.lock
  fi
}

clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.20 REFUSED: wrong branch"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.20 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || {
    echo "V23.20 REFUSED: missing $f"
    exit 1
  }

  git diff --quiet -- "$f" || {
    echo "V23.20 REFUSED: local changes in $f"
    exit 1
  }

  git diff --cached --quiet -- "$f" || {
    echo "V23.20 REFUSED: staged changes in $f"
    exit 1
  }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || {
    echo "V23.20 REFUSED: $f already exists"
    exit 1
  }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/shadow-policy-candidate-builder-v23-20-$STAMP"

mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.20 FAILED - RESTORING ==="

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
// MEMEFLOW_SHADOW_POLICY_CANDIDATE_BUILDER_V23_20
//
// SHADOW ONLY.
//
// Converts a VALIDATED V23.19 benchmark win into a concrete,
// reviewable policy candidate for the NEXT simulator stage.
//
// This module does NOT:
// - mutate V22/V23 Score
// - mutate State
// - change BUY/SELL
// - change Settings
// - auto-promote
// - auto-apply
//
// V23.20 only produces a candidate specification plus evidence/gates.

const TARGET_HORIZON_MS=300_000;

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const round=(value,digits=2)=>{
  const n=finite(value);
  if(n===null)return null;
  const p=10**digits;
  return Math.round(n*p)/p;
};

function candidateMode(report={}){
  const brier=
    finite(report?.delta?.brier)??0;

  const logLoss=
    finite(report?.delta?.logLoss)??0;

  const hc=
    finite(
      report?.delta
        ?.highConfidenceMissRatePct
    );

  if(
    brier>=0.01 &&
    logLoss>=0.02 &&
    hc!==null &&
    hc>=5
  ){
    return 'BALANCED';
  }

  return 'CONSERVATIVE';
}

function policyForMode(mode){
  if(mode==='BALANCED'){
    return {
      minPenaltyPct:10,
      maxAdjustedConfidencePct:55,
      requireMaturePattern:true,
      requirePenaltyApplied:true,
      candidateAction:
        'DOWNGRADE_SHADOW_ENTRY_READINESS_TO_WATCH'
    };
  }

  return {
    minPenaltyPct:15,
    maxAdjustedConfidencePct:50,
    requireMaturePattern:true,
    requirePenaltyApplied:true,
    candidateAction:
      'DOWNGRADE_SHADOW_ENTRY_READINESS_TO_WATCH'
  };
}

function gate(
  id,
  label,
  pass,
  actual,
  required
){
  return {
    id,
    label,
    pass:pass===true,
    actual,
    required
  };
}

export function createShadowPolicyCandidateBuilderV23_20({
  errorAwareBenchmark=null,
  errorPatternLearner=null
}={}){
  let builds=0;
  let readyBuilds=0;
  let errors=0;
  let last=null;

  function build(){
    try{
      const benchmark=
        errorAwareBenchmark
          ?.report?.({
            horizonMs:
              TARGET_HORIZON_MS
          })||{};

      const patterns=
        errorPatternLearner
          ?.patternReport?.({
            horizonMs:
              TARGET_HORIZON_MS,
            limit:100,
            includeImmature:false
          })||{};

      const benchmarkVerdict=
        benchmark?.verdict||{};

      const maturePatterns=
        Number(
          patterns?.maturePatterns||0
        );

      const highRiskPatterns=
        Number(
          patterns?.highRiskPatterns||0
        );

      const gates=[
        gate(
          'BENCHMARK_REVIEW_ELIGIBLE',
          'V23.19 benchmark passed review gate',
          benchmarkVerdict
            ?.reviewEligible===true,
          benchmarkVerdict
            ?.status||'UNKNOWN',
          'ERROR_AWARE_CHALLENGER_WINS'
        ),
        gate(
          'PAIRED_SAMPLE',
          'Paired 5m sample',
          Number(
            benchmark?.pairedRows||0
          )>=100,
          Number(
            benchmark?.pairedRows||0
          ),
          '>=100'
        ),
        gate(
          'POSITIVE_SAMPLE',
          'Positive 5m sample',
          Number(
            benchmark?.positive||0
          )>=20,
          Number(
            benchmark?.positive||0
          ),
          '>=20'
        ),
        gate(
          'NEGATIVE_SAMPLE',
          'Negative 5m sample',
          Number(
            benchmark?.negative||0
          )>=20,
          Number(
            benchmark?.negative||0
          ),
          '>=20'
        ),
        gate(
          'BRIER_EDGE',
          'Brier improvement',
          Number(
            benchmark?.delta?.brier||0
          )>=0.0025,
          round(
            benchmark?.delta?.brier,
            6
          ),
          '>=0.0025'
        ),
        gate(
          'LOGLOSS_EDGE',
          'Log-loss improvement',
          Number(
            benchmark?.delta?.logLoss||0
          )>=0.005,
          round(
            benchmark?.delta?.logLoss,
            6
          ),
          '>=0.005'
        ),
        gate(
          'MATURE_ERROR_PATTERN',
          'At least one mature V23.17 pattern',
          maturePatterns>=1,
          maturePatterns,
          '>=1'
        )
      ];

      const blockers=
        gates
          .filter(row=>row.pass!==true)
          .map(row=>row.id);

      const ready=
        blockers.length===0;

      let candidate=null;

      if(ready){
        const mode=
          candidateMode(benchmark);

        const policy=
          policyForMode(mode);

        candidate={
          candidateId:
            `V23_20_ERROR_AWARE_ENTRY_GUARD_${mode}`,
          version:
            'MEMEFLOW_SHADOW_POLICY_CANDIDATE_V23_20',
          shadowOnly:true,
          authority:
            'CANDIDATE_ONLY',
          status:
            'READY_FOR_SHADOW_SIMULATION',
          mode,
          objective:
            'REDUCE_ERROR_AWARE_FALSE_CONFIDENCE_WITHOUT_CHANGING_LIVE_AUTHORITY',
          scope:
            'PRE_OPEN_SHADOW_READINESS_ONLY',
          trigger:{
            requireMatureErrorPattern:
              policy.requireMaturePattern,
            requirePenaltyApplied:
              policy.requirePenaltyApplied,
            minPenaltyPct:
              policy.minPenaltyPct,
            maxAdjustedConfidencePct:
              policy.maxAdjustedConfidencePct
          },
          proposedAction:
            policy.candidateAction,
          benchmarkEvidence:{
            pairedRows:
              Number(
                benchmark?.pairedRows||0
              ),
            positive:
              Number(
                benchmark?.positive||0
              ),
            negative:
              Number(
                benchmark?.negative||0
              ),
            brierDelta:
              round(
                benchmark?.delta?.brier,
                6
              ),
            logLossDelta:
              round(
                benchmark?.delta?.logLoss,
                6
              ),
            accuracyDeltaPct:
              round(
                benchmark?.delta?.accuracyPct,
                2
              ),
            eceDeltaPct:
              round(
                benchmark?.delta?.ecePct,
                2
              ),
            highConfidenceMissRateDeltaPct:
              round(
                benchmark?.delta
                  ?.highConfidenceMissRatePct,
                2
              ),
            pairedWins:
              benchmark?.pairedWins||null
          },
          patternEvidence:{
            maturePatterns,
            highRiskPatterns,
            topPatterns:
              Array.isArray(patterns?.patterns)
                ? patterns.patterns
                    .slice(0,5)
                    .map(row=>({
                      patternId:
                        row?.patternId||null,
                      tags:
                        row?.tags||[],
                      support:
                        row?.support??0,
                      missLift:
                        row?.missLift??null,
                      severity:
                        row?.severity||'WATCH'
                    }))
                : []
          },
          simulatorRequirements:{
            nextStage:
              'V23_21_SHADOW_POLICY_SIMULATOR',
            compareAgainst:
              'CURRENT_V22_LIFECYCLE',
            sameFrozenAnchors:true,
            sameCompletedOutcomes:true,
            reportFPFN:true,
            reportMissedPositiveOpportunity:true,
            reportAffectedRate:true,
            reportBrierAndLogLoss:true
          },
          controls:{
            applicationAllowed:false,
            automaticPromotion:false,
            ownerApprovalRequired:true,
            simulationRequired:true,
            scoreMutation:false,
            stateMutation:false,
            buySellMutation:false,
            settingsMutation:false
          },
          impactClaim:{
            quantitativePolicyImpactKnown:false,
            reason:
              'V23_19_VALIDATES_ERROR_AWARE_FORECASTING_NOT_THIS_POLICY_RULE; V23_21_SIMULATION_REQUIRED'
          }
        };
      }

      const result={
        version:
          'MEMEFLOW_SHADOW_POLICY_CANDIDATE_BUILDER_V23_20',
        shadowOnly:true,
        authority:
          'CANDIDATE_ONLY',
        targetHorizonMs:
          TARGET_HORIZON_MS,
        ready,
        status:
          ready
            ? 'CANDIDATE_READY_FOR_SIMULATION'
            : 'CANDIDATE_BLOCKED',
        blockers,
        gates,
        candidate,
        controls:{
          applicationAllowed:false,
          automaticPromotion:false,
          ownerApprovalRequired:true,
          simulationRequired:true,
          scoreMutation:false,
          stateMutation:false,
          buySellMutation:false,
          settingsMutation:false
        }
      };

      builds++;

      if(ready){
        readyBuilds++;
      }

      last=result;

      return result;
    }catch{
      errors++;

      const result={
        version:
          'MEMEFLOW_SHADOW_POLICY_CANDIDATE_BUILDER_V23_20',
        shadowOnly:true,
        authority:
          'CANDIDATE_ONLY',
        targetHorizonMs:
          TARGET_HORIZON_MS,
        ready:false,
        status:'CANDIDATE_ERROR',
        blockers:['BUILDER_ERROR'],
        gates:[],
        candidate:null,
        controls:{
          applicationAllowed:false,
          automaticPromotion:false,
          ownerApprovalRequired:true,
          simulationRequired:true,
          scoreMutation:false,
          stateMutation:false,
          buySellMutation:false,
          settingsMutation:false
        }
      };

      last=result;
      return result;
    }
  }

  function status(){
    return {
      version:
        'MEMEFLOW_SHADOW_POLICY_CANDIDATE_BUILDER_V23_20',
      shadowOnly:true,
      authority:
        'CANDIDATE_ONLY',
      targetHorizonMs:
        TARGET_HORIZON_MS,
      builds,
      readyBuilds,
      errors,
      last:
        last||build()
    };
  }

  return {
    build,
    status
  };
}

EOF_MODULE

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowPolicyCandidateBuilderV23_20
} from '../src/shadow-policy-candidate-builder-v23_20.mjs';

const benchmarkWin={
  report(){
    return {
      pairedRows:140,
      positive:70,
      negative:70,
      delta:{
        brier:0.012,
        logLoss:0.026,
        accuracyPct:2.5,
        ecePct:4.2,
        highConfidenceMissRatePct:7.1
      },
      pairedWins:{
        raw:40,
        challenger:75,
        ties:25
      },
      verdict:{
        status:
          'ERROR_AWARE_CHALLENGER_WINS',
        challengerWins:true,
        reviewEligible:true
      }
    };
  }
};

const patternsReady={
  patternReport(){
    return {
      maturePatterns:3,
      highRiskPatterns:1,
      patterns:[
        {
          patternId:
            'HIGH_MODEL_DISAGREEMENT + TRAJECTORY_FADING',
          tags:[
            'HIGH_MODEL_DISAGREEMENT',
            'TRAJECTORY_FADING'
          ],
          support:31,
          missLift:1.82,
          severity:'HIGH'
        }
      ]
    };
  }
};

const builder=
  createShadowPolicyCandidateBuilderV23_20({
    errorAwareBenchmark:
      benchmarkWin,
    errorPatternLearner:
      patternsReady
  });

const result=
  builder.build();

assert.equal(
  result.ready,
  true
);

assert.equal(
  result.status,
  'CANDIDATE_READY_FOR_SIMULATION'
);

assert.equal(
  result.blockers.length,
  0
);

assert.ok(
  result.gates.every(
    row=>row.pass===true
  )
);

assert.ok(
  result.candidate
);

assert.equal(
  result.candidate.mode,
  'BALANCED'
);

assert.equal(
  result.candidate.trigger.minPenaltyPct,
  10
);

assert.equal(
  result.candidate.trigger.maxAdjustedConfidencePct,
  55
);

assert.equal(
  result.candidate.proposedAction,
  'DOWNGRADE_SHADOW_ENTRY_READINESS_TO_WATCH'
);

assert.equal(
  result.candidate.controls.applicationAllowed,
  false
);

assert.equal(
  result.candidate.controls.simulationRequired,
  true
);

assert.equal(
  result.candidate.controls.scoreMutation,
  false
);

assert.equal(
  result.candidate.controls.stateMutation,
  false
);

assert.equal(
  result.candidate.controls.buySellMutation,
  false
);

assert.equal(
  result.candidate.controls.settingsMutation,
  false
);

assert.equal(
  result.candidate.impactClaim
    .quantitativePolicyImpactKnown,
  false
);

const blocked=
  createShadowPolicyCandidateBuilderV23_20({
    errorAwareBenchmark:{
      report(){
        return {
          pairedRows:40,
          positive:25,
          negative:15,
          delta:{
            brier:0.001,
            logLoss:0.001
          },
          verdict:{
            status:'BENCHMARK_COLD_START',
            reviewEligible:false
          }
        };
      }
    },
    errorPatternLearner:{
      patternReport(){
        return {
          maturePatterns:0,
          highRiskPatterns:0,
          patterns:[]
        };
      }
    }
  }).build();

assert.equal(
  blocked.ready,
  false
);

assert.equal(
  blocked.candidate,
  null
);

assert.ok(
  blocked.blockers.includes(
    'BENCHMARK_REVIEW_ELIGIBLE'
  )
);

assert.ok(
  blocked.blockers.includes(
    'PAIRED_SAMPLE'
  )
);

assert.ok(
  blocked.blockers.includes(
    'MATURE_ERROR_PATTERN'
  )
);

const source=
  fs.readFileSync(
    'src/shadow-policy-candidate-builder-v23_20.mjs',
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
  /createShadowPolicyCandidateBuilderV23_20/
);

assert.match(
  shadow,
  /policyCandidateBuilderStatus/
);

assert.match(
  shadow,
  /buildPolicyCandidate/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/policy-candidate/
);

assert.match(
  html,
  /id="policyCandidateStatus"/
);

assert.match(
  js,
  /loadPolicyCandidate/
);

console.log(
  'shadow policy candidate builder v23.20 ok'
);

EOF_TEST

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
            f"V23.20 REFUSED: {label}: expected 1 exact match, got {n}"
        )

    return text.replace(old,new,1)

old="""import {
  createShadowErrorAwareBenchmarkV23_19
} from './shadow-error-aware-benchmark-v23_19.mjs';"""

s=once(
    s,
    old,
    old+"""
import {
  createShadowPolicyCandidateBuilderV23_20
} from './shadow-policy-candidate-builder-v23_20.mjs';""",
    "candidate builder import"
)

old="""  const shadowErrorAwareBenchmark=
    createShadowErrorAwareBenchmarkV23_19({
      dataDir
    });"""

s=once(
    s,
    old,
    old+"""

  const shadowPolicyCandidateBuilder=
    createShadowPolicyCandidateBuilderV23_20({
      errorAwareBenchmark:
        shadowErrorAwareBenchmark,
      errorPatternLearner:
        shadowErrorPatternLearner
    });""",
    "candidate builder construction"
)

s=once(
    s,
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_19'",
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_20'",
    "network version"
)

old="""      shadowErrorAwareConfidence:shadowErrorAwareConfidence.status(),
      shadowErrorAwareBenchmark:shadowErrorAwareBenchmark.status()
"""

s=once(
    s,
    old,
    """      shadowErrorAwareConfidence:shadowErrorAwareConfidence.status(),
      shadowErrorAwareBenchmark:shadowErrorAwareBenchmark.status(),
      shadowPolicyCandidateBuilder:shadowPolicyCandidateBuilder.status()
""",
    "candidate builder status"
)

old="""    flushErrorAwareBenchmark:
      ()=>shadowErrorAwareBenchmark.flush(),
    status
"""

s=once(
    s,
    old,
    """    flushErrorAwareBenchmark:
      ()=>shadowErrorAwareBenchmark.flush(),
    policyCandidateBuilderStatus:
      ()=>shadowPolicyCandidateBuilder.status(),
    buildPolicyCandidate:
      ()=>shadowPolicyCandidateBuilder.build(),
    status
""",
    "candidate builder API"
)

sp.write_text(s,encoding="utf-8")

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route=r"""/* MEMEFLOW_SHADOW_POLICY_CANDIDATE_BUILDER_MONITOR_V23_20
 * Owner-only, read-only policy candidate. It cannot apply anything.
 */
 if(
   url.pathname==='/api/owner/intelligence/policy-candidate' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const result=
     tokenIntelligenceShadowV23
       .buildPolicyCandidate();

   return json(res,200,{
     ok:true,
     owner:true,
     shadowOnly:true,
     applicationAllowed:false,
     automaticPromotion:false,
     simulationRequired:true,
     result
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

a=once(
    a,
    anchor,
    route,
    "candidate owner route"
)

ap.write_text(a,encoding="utf-8")

html_anchor="""      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

html_block=r"""      <!-- MEMEFLOW_SHADOW_POLICY_CANDIDATE_BUILDER_V23_20_UI -->
      <section
        id="policyCandidateMonitor"
        class="oi-panel oi-policy-candidate"
      >
        <div class="oi-panel-head">
          <div>
            <span class="oi-eyebrow">
              POLICY CANDIDATE · SHADOW ONLY
            </span>
            <h2>V23.20 Policy Candidate</h2>
            <p>
              Converts a validated V23.19 benchmark win into a concrete
              rule for the next shadow simulator. Nothing is applied to
              V22, Settings, State, Score, BUY or SELL.
            </p>
          </div>

          <span
            id="policyCandidateStatus"
            class="oi-ai-status"
          >
            LOADING
          </span>
        </div>

        <div class="oi-grid oi-grid-4">
          <article class="oi-stat">
            <span>MODE</span>
            <strong id="policyCandidateMode">—</strong>
            <small>conservative / balanced</small>
          </article>

          <article class="oi-stat">
            <span>MIN PENALTY</span>
            <strong id="policyCandidateMinPenalty">—</strong>
            <small>required V23.18 haircut</small>
          </article>

          <article class="oi-stat">
            <span>MAX ADJ CONF</span>
            <strong id="policyCandidateMaxConfidence">—</strong>
            <small>candidate guard threshold</small>
          </article>

          <article class="oi-stat">
            <span>MATURE PATTERNS</span>
            <strong id="policyCandidatePatterns">—</strong>
            <small>V23.17 support</small>
          </article>
        </div>

        <div class="oi-grid oi-grid-2">
          <div>
            <h3>Readiness gates</h3>
            <div
              id="policyCandidateGates"
              class="oi-promotion-checks"
            ></div>
          </div>

          <div>
            <h3>Candidate specification</h3>
            <div
              id="policyCandidateSpec"
              class="oi-list"
            ></div>
          </div>
        </div>

        <div
          id="policyCandidateBlocker"
          class="oi-promotion-blocker"
          data-state="blocked"
        >
          Waiting for V23.19 evidence.
        </div>
      </section>

      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

h=once(
    h,
    html_anchor,
    html_block,
    "candidate UI"
)

hp.write_text(h,encoding="utf-8")

js_anchor="""/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

js_block=r"""/* MEMEFLOW_SHADOW_POLICY_CANDIDATE_BUILDER_V23_20_UI_JS */
function renderPolicyCandidate(payload={}){
  const result=payload?.result||{};
  const candidate=result?.candidate||null;
  const gates=
    Array.isArray(result?.gates)
      ? result.gates
      : [];

  const badge=$('policyCandidateStatus');

  if(badge){
    badge.className=
      'oi-ai-status '+
      (
        result?.ready===true
          ? 'online'
          : ''
      );

    badge.textContent=
      result?.ready===true
        ? 'READY FOR SIMULATION'
        : 'BLOCKED';
  }

  $('policyCandidateMode').textContent=
    candidate?.mode||'—';

  $('policyCandidateMinPenalty').textContent=
    candidate
      ? pct(
          candidate?.trigger
            ?.minPenaltyPct
        )
      : '—';

  $('policyCandidateMaxConfidence').textContent=
    candidate
      ? pct(
          candidate?.trigger
            ?.maxAdjustedConfidencePct
        )
      : '—';

  $('policyCandidatePatterns').textContent=
    candidate
      ? num(
          candidate?.patternEvidence
            ?.maturePatterns,
          0
        )
      : '—';

  $('policyCandidateGates').innerHTML=
    gates.length
      ? gates.map(row=>`
          <div class="oi-promotion-check ${row?.pass===true?'pass':'fail'}">
            <span class="oi-promotion-check-dot"></span>
            <div>
              <strong>${esc(row?.label||row?.id||'Gate')}</strong>
              <small>
                actual ${esc(String(row?.actual??'—'))}
                · required ${esc(String(row?.required??'—'))}
              </small>
            </div>
          </div>
        `).join('')
      : `
          <div class="oi-empty">
            Candidate gates unavailable.
          </div>
        `;

  const spec=$('policyCandidateSpec');

  if(spec){
    if(candidate){
      spec.innerHTML=[
        [
          'Action',
          String(
            candidate?.proposedAction||'—'
          ).replaceAll('_',' ')
        ],
        [
          'Scope',
          String(
            candidate?.scope||'—'
          ).replaceAll('_',' ')
        ],
        [
          'Brier Δ',
          num(
            candidate?.benchmarkEvidence
              ?.brierDelta,
            6
          )
        ],
        [
          'Log-loss Δ',
          num(
            candidate?.benchmarkEvidence
              ?.logLossDelta,
            6
          )
        ],
        [
          'Next stage',
          String(
            candidate?.simulatorRequirements
              ?.nextStage||'—'
          ).replaceAll('_',' ')
        ]
      ].map(([name,value])=>`
        <div class="oi-row">
          <span>${esc(name)}</span>
          <strong>${esc(value)}</strong>
        </div>
      `).join('');
    }else{
      spec.innerHTML=`
        <div class="oi-empty">
          No candidate until every gate passes.
        </div>
      `;
    }
  }

  const blocker=$('policyCandidateBlocker');

  if(blocker){
    blocker.dataset.state=
      result?.ready===true
        ? 'ready'
        : 'blocked';

    blocker.textContent=
      result?.ready===true
        ? 'CANDIDATE READY FOR V23.21 SHADOW SIMULATION. Nothing has been applied to live trading.'
        : (
            Array.isArray(result?.blockers) &&
            result.blockers.length
          )
            ? `Blocked: ${result.blockers.join(', ').replaceAll('_',' ')}`
            : 'Waiting for V23.19 evidence.';
  }
}

async function loadPolicyCandidate(){
  try{
    const payload=await api(
      '/api/owner/intelligence/policy-candidate'
    );

    renderPolicyCandidate(payload);
  }catch(error){
    const badge=$('policyCandidateStatus');

    if(badge){
      badge.className='oi-ai-status offline';
      badge.textContent='UNAVAILABLE';
    }

    const blocker=$('policyCandidateBlocker');

    if(blocker){
      blocker.dataset.state='blocked';
      blocker.textContent=
        `Policy candidate unavailable: ${error.message}`;
    }
  }
}

/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

j=once(
    j,
    js_anchor,
    js_block,
    "candidate UI JS"
)

old="""    await Promise.all([
      loadPromotionReport(),
      loadTokenScorecards(),
      loadOutcomeReviews(),
      loadErrorPatterns(),
      loadErrorAwareConfidence(),
      loadErrorAwareBenchmark()
    ]);
"""

j=once(
    j,
    old,
    """    await Promise.all([
      loadPromotionReport(),
      loadTokenScorecards(),
      loadOutcomeReviews(),
      loadErrorPatterns(),
      loadErrorAwareConfidence(),
      loadErrorAwareBenchmark(),
      loadPolicyCandidate()
    ]);
""",
    "candidate load"
)

jp.write_text(j,encoding="utf-8")

css_anchor="""/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

css_block=r"""/* ==========================================================
   MEMEFLOW_SHADOW_POLICY_CANDIDATE_BUILDER_V23_20
   ========================================================== */

.oi-policy-candidate
.oi-grid-2{
  margin-top:12px;
}

.oi-policy-candidate
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
    "candidate CSS"
)

cp.write_text(c,encoding="utf-8")

print("V23_20_TRANSFORM_OK")

PY

python3 - <<'PY'
import json
from pathlib import Path

p=Path("memeflow-app/package.json")
d=json.loads(p.read_text(encoding="utf-8"))
s=d["scripts"]["test:core"]

needle="node tests/shadow-error-aware-benchmark-v23_19.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-error-aware-benchmark-v23_19.mjs && node tests/shadow-policy-candidate-builder-v23_20.mjs && node tests/assist-fresh-decision-v22.mjs"

if s.count(needle)!=1:
    raise SystemExit(
        "V23.20 REFUSED: package test anchor changed"
    )

if "shadow-policy-candidate-builder-v23_20.mjs" in s:
    raise SystemExit(
        "V23.20 REFUSED: candidate test already installed"
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
 "memeflow-app/src/shadow-policy-candidate-builder-v23_20.mjs",
 "memeflow-app/tests/shadow-policy-candidate-builder-v23_20.mjs"
]:
    p=Path(name)

    p.write_text(
        p.read_text(encoding="utf-8").rstrip("\n")+"\n",
        encoding="utf-8"
    )

print("V23_20_EOF_NORMALIZATION_OK")
PY

echo
echo "=== V23.20 SYNTAX ==="

node --check "$APP"
node --check "$SHADOW"
node --check "$MODULE"
node --check "$TEST"
node --check "$JS"

node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"

echo "SYNTAX_OK"

echo
echo "=== V23.20 TARGETED TESTS ==="

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
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)

echo "TARGETED_TESTS_OK"

echo
echo "=== V23.20 FULL PROJECT TEST SUITE ==="

(
  cd memeflow-app
  npm test
)

echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.20 STATIC CONTRACT AUDIT ==="

python3 - <<'PY'
from pathlib import Path

m=Path(
 "memeflow-app/src/shadow-policy-candidate-builder-v23_20.mjs"
).read_text()

s=Path(
 "memeflow-app/src/token-intelligence-shadow-v23.mjs"
).read_text()

a=Path(
 "memeflow-app/app-server.mjs"
).read_text()

h=Path(
 "memeflow-app/owner-intelligence.html"
).read_text()

j=Path(
 "memeflow-app/owner-intelligence.js"
).read_text()

c=Path(
 "memeflow-app/owner-intelligence.css"
).read_text()

p=Path(
 "memeflow-app/package.json"
).read_text()

errors=[]

for x in [
 "MEMEFLOW_SHADOW_POLICY_CANDIDATE_BUILDER_V23_20",
 "CANDIDATE_READY_FOR_SIMULATION",
 "DOWNGRADE_SHADOW_ENTRY_READINESS_TO_WATCH",
 "applicationAllowed:false",
 "automaticPromotion:false",
 "simulationRequired:true",
 "scoreMutation:false",
 "stateMutation:false",
 "buySellMutation:false",
 "settingsMutation:false",
 "quantitativePolicyImpactKnown:false",
 "V23_21_SHADOW_POLICY_SIMULATOR"
]:
    if x not in m:
        errors.append("builder marker missing: "+x)

for x in [
 "from './evaluate.mjs'",
 "openPosition(",
 "closePosition(",
 "setSettings(",
 "tradeEligible",
 "decisionScore"
]:
    if x in m:
        errors.append("forbidden authority: "+x)

for x in [
 "createShadowPolicyCandidateBuilderV23_20",
 "shadowPolicyCandidateBuilder:shadowPolicyCandidateBuilder.status()",
 "policyCandidateBuilderStatus",
 "buildPolicyCandidate",
 "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_20"
]:
    if x not in s:
        errors.append("wiring missing: "+x)

for x in [
 "/api/owner/intelligence/policy-candidate",
 "applicationAllowed:false",
 "automaticPromotion:false",
 "simulationRequired:true"
]:
    if x not in a:
        errors.append("route missing: "+x)

for x in [
 'id="policyCandidateStatus"',
 'id="policyCandidateMode"',
 'id="policyCandidateMinPenalty"',
 'id="policyCandidateMaxConfidence"',
 'id="policyCandidateGates"'
]:
    if x not in h:
        errors.append("UI missing: "+x)

for x in [
 "loadPolicyCandidate",
 "renderPolicyCandidate",
 "/api/owner/intelligence/policy-candidate"
]:
    if x not in j:
        errors.append("UI JS missing: "+x)

if ".oi-policy-candidate" not in c:
    errors.append("UI CSS missing")

if "shadow-policy-candidate-builder-v23_20.mjs" not in p:
    errors.append("V23.20 test missing from package")

for x in [
 "shadowMathBrain.predict",
 "shadowModelArena.predict",
 "shadowDriftRegime.predict",
 "shadowConfidenceGovernor.predict",
 "shadowTokenTrajectory.observe",
 "shadowTokenPatternMemory.predict",
 "shadowEvidenceSynthesis.predict",
 "shadowOutcomeCalibration.predict",
 "shadowChampionBenchmark.recordOutcome",
 "shadowPromotionGate.status",
 "shadowPromotionReport.status",
 "tokenIntelligenceScorecard.status",
 "shadowOutcomeReview.recordOutcome",
 "shadowErrorPatternLearner.observeReview",
 "shadowErrorAwareConfidence.predict",
 "shadowErrorAwareBenchmark.recordOutcome"
]:
    if x not in s:
        errors.append("backward compatibility missing: "+x)

if errors:
    raise SystemExit(
        "V23_20_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V23_20_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.20 DIFF ==="

git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|owner-intelligence\.html|owner-intelligence\.js|owner-intelligence\.css|src/token-intelligence-shadow-v23\.mjs|src/shadow-policy-candidate-builder-v23_20\.mjs|tests/shadow-policy-candidate-builder-v23_20\.mjs)$'

BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "V23.20 REFUSED: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.20 STAGED ==="

git diff --cached --stat

git commit -m "feat: add shadow policy candidate builder v23.20"

git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="

echo "Backup: $BACKUP"

git log -1 --oneline --decorate

echo
echo "V23.20 CONTRACT:"
echo "  only a V23.19 review-eligible benchmark win can unlock a candidate"
echo "  candidate also requires >=100 paired 5m, >=20 positive, >=20 negative and >=1 mature error pattern"
echo "  candidate proposes a SHADOW entry-readiness guard for V23.21 simulation"
echo "  quantitative policy impact is explicitly unknown until V23.21 simulation"
echo "  applicationAllowed=false"
echo "  automaticPromotion=false"
echo "  V22 remains the only trading authority"
echo "  no Score/State/Settings/BUY/SELL mutation"
