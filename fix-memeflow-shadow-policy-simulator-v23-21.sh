#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

[[ -n "$ROOT" ]] || {
  echo "ERROR: run inside MEMEFLOW repo"
  exit 1
}

cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="398f8b26c0f4e08c405e3a5569f79c4d4866cf1b"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
BENCH="memeflow-app/src/shadow-error-aware-benchmark-v23_19.mjs"
PKG="memeflow-app/package.json"
HTML="memeflow-app/owner-intelligence.html"
JS="memeflow-app/owner-intelligence.js"
CSS="memeflow-app/owner-intelligence.css"
MODULE="memeflow-app/src/shadow-policy-simulator-v23_21.mjs"
TEST="memeflow-app/tests/shadow-policy-simulator-v23_21.mjs"

MODIFIED=("$APP" "$SHADOW" "$BENCH" "$PKG" "$HTML" "$JS" "$CSS")
NEW_FILES=("$MODULE" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW SHADOW POLICY SIMULATOR V23.21 ==="

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
      echo "V23.21 REFUSED: active git process"
      echo "$active"
      exit 1
    fi

    rm -f .git/index.lock
  fi
}

clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.21 REFUSED: wrong branch"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.21 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || {
    echo "V23.21 REFUSED: missing $f"
    exit 1
  }

  git diff --quiet -- "$f" || {
    echo "V23.21 REFUSED: local changes in $f"
    exit 1
  }

  git diff --cached --quiet -- "$f" || {
    echo "V23.21 REFUSED: staged changes in $f"
    exit 1
  }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || {
    echo "V23.21 REFUSED: $f already exists"
    exit 1
  }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/shadow-policy-simulator-v23-21-$STAMP"

mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.21 FAILED - RESTORING ==="

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
// MEMEFLOW_SHADOW_POLICY_SIMULATOR_V23_21
//
// SHADOW ONLY.
//
// Simulates the V23.20 candidate against completed 5m outcomes already
// stored by V23.19. This is an action-policy simulation, not a forecast
// mutation and not live trading.
//
// Baseline in this simulator:
//   CURRENT_POLICY = do not apply the V23.20 error-aware WATCH guard.
//
// Candidate:
//   if V23.20 trigger matches a completed frozen row,
//   simulate DOWNGRADE_SHADOW_ENTRY_READINESS_TO_WATCH.
//
// IMPORTANT:
// - does not mutate V22 Score/State/Settings/BUY/SELL
// - does not change V23 probability/confidence
// - does not auto-promote or auto-apply
// - quantitative impact is derived only from frozen completed outcomes

const TARGET_HORIZON_MS=300_000;
const MIN_EVALUABLE=100;
const MIN_AFFECTED=10;
const MIN_NEGATIVE_PRECISION_PCT=60;
const MAX_POSITIVE_OPPORTUNITY_COST_PCT=12;
const MIN_NEGATIVE_BLOCK_RATE_PCT=15;

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

function safePct(num,den){
  if(!(den>0))return null;
  return round(num/den*100,2);
}

function candidateTriggerMatches(row={},candidate={}){
  const trigger=candidate?.trigger||{};

  if(
    trigger?.requirePenaltyApplied===true &&
    String(row?.errorAwareStatus||'')
      .toUpperCase()!=='PENALTY_APPLIED'
  ){
    return false;
  }

  if(
    trigger?.requireMatureErrorPattern===true &&
    String(row?.errorAwareStatus||'')
      .toUpperCase()!=='PENALTY_APPLIED'
  ){
    // V23.18 can only emit PENALTY_APPLIED from mature V23.17 matches.
    return false;
  }

  const penalty=
    finite(row?.penaltyPct);

  const adjusted=
    finite(row?.adjustedConfidencePct);

  if(
    penalty===null ||
    adjusted===null
  ){
    return false;
  }

  if(
    penalty<
    Number(trigger?.minPenaltyPct||0)
  ){
    return false;
  }

  if(
    adjusted>
    Number(
      trigger?.maxAdjustedConfidencePct??100
    )
  ){
    return false;
  }

  return true;
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

export function createShadowPolicySimulatorV23_21({
  policyCandidateBuilder=null,
  errorAwareBenchmark=null
}={}){
  let runs=0;
  let passRuns=0;
  let errors=0;
  let last=null;

  function simulate(){
    try{
      const built=
        policyCandidateBuilder
          ?.build?.()||{};

      const candidate=
        built?.candidate||null;

      if(
        built?.ready!==true ||
        !candidate
      ){
        const result={
          version:
            'MEMEFLOW_SHADOW_POLICY_SIMULATOR_V23_21',
          shadowOnly:true,
          authority:'SIMULATION_ONLY',
          ready:false,
          status:'SIMULATION_BLOCKED',
          blockers:[
            'V23_20_CANDIDATE_NOT_READY'
          ],
          candidateId:null,
          metrics:null,
          gates:[],
          verdict:{
            pass:false,
            reviewEligible:false,
            reason:
              'V23_20_CANDIDATE_NOT_READY'
          },
          controls:{
            applicationAllowed:false,
            automaticPromotion:false,
            scoreMutation:false,
            stateMutation:false,
            settingsMutation:false,
            buySellMutation:false,
            forecastMutation:false
          }
        };

        runs++;
        last=result;
        return result;
      }

      const rows=
        errorAwareBenchmark
          ?.listRows?.({
            horizonMs:
              TARGET_HORIZON_MS,
            limit:5000
          })||[];

      const evaluable=
        rows.filter(
          row=>
            row?.scored===true &&
            ['POSITIVE','NEGATIVE']
              .includes(
                String(
                  row?.classification||''
                ).toUpperCase()
              )
        );

      const positive=
        evaluable.filter(
          row=>
            String(
              row.classification
            ).toUpperCase()==='POSITIVE'
        ).length;

      const negative=
        evaluable.length-positive;

      const affected=
        evaluable.filter(
          row=>
            candidateTriggerMatches(
              row,
              candidate
            )
        );

      const preventedNegative=
        affected.filter(
          row=>
            String(
              row.classification
            ).toUpperCase()==='NEGATIVE'
        ).length;

      const missedPositiveOpportunity=
        affected.length-
        preventedNegative;

      const preservedPositive=
        Math.max(
          0,
          positive-
          missedPositiveOpportunity
        );

      const unblockedNegative=
        Math.max(
          0,
          negative-
          preventedNegative
        );

      const metrics={
        evaluableRows:
          evaluable.length,
        positiveRows:
          positive,
        negativeRows:
          negative,
        affectedRows:
          affected.length,
        affectedRatePct:
          safePct(
            affected.length,
            evaluable.length
          ),
        preventedNegative:
          preventedNegative,
        missedPositiveOpportunity:
          missedPositiveOpportunity,
        negativePrecisionPct:
          safePct(
            preventedNegative,
            affected.length
          ),
        negativeBlockRatePct:
          safePct(
            preventedNegative,
            negative
          ),
        positiveOpportunityCostPct:
          safePct(
            missedPositiveOpportunity,
            positive
          ),
        positivePreservationPct:
          safePct(
            preservedPositive,
            positive
          ),
        preservedPositive,
        unblockedNegative,
        netProtectedMinusMissed:
          preventedNegative-
          missedPositiveOpportunity
      };

      const benchmark=
        errorAwareBenchmark
          ?.report?.({
            horizonMs:
              TARGET_HORIZON_MS
          })||{};

      const gates=[
        gate(
          'EVALUABLE_SAMPLE',
          'Policy-evaluable 5m rows',
          evaluable.length>=
            MIN_EVALUABLE,
          evaluable.length,
          `>=${MIN_EVALUABLE}`
        ),
        gate(
          'AFFECTED_SAMPLE',
          'Candidate affects enough rows',
          affected.length>=
            MIN_AFFECTED,
          affected.length,
          `>=${MIN_AFFECTED}`
        ),
        gate(
          'NEGATIVE_PRECISION',
          'Blocked-row negative precision',
          Number(
            metrics
              .negativePrecisionPct||0
          )>=
            MIN_NEGATIVE_PRECISION_PCT,
          metrics
            .negativePrecisionPct,
          `>=${MIN_NEGATIVE_PRECISION_PCT}%`
        ),
        gate(
          'POSITIVE_OPPORTUNITY_COST',
          'Missed positive opportunity cost',
          metrics
            .positiveOpportunityCostPct!==null &&
          Number(
            metrics
              .positiveOpportunityCostPct
          )<=
            MAX_POSITIVE_OPPORTUNITY_COST_PCT,
          metrics
            .positiveOpportunityCostPct,
          `<=${MAX_POSITIVE_OPPORTUNITY_COST_PCT}%`
        ),
        gate(
          'NEGATIVE_BLOCK_RATE',
          'Negative outcomes intercepted',
          Number(
            metrics
              .negativeBlockRatePct||0
          )>=
            MIN_NEGATIVE_BLOCK_RATE_PCT,
          metrics
            .negativeBlockRatePct,
          `>=${MIN_NEGATIVE_BLOCK_RATE_PCT}%`
        ),
        gate(
          'NET_PROTECTION',
          'Prevented negatives exceed missed positives',
          metrics
            .netProtectedMinusMissed>0,
          metrics
            .netProtectedMinusMissed,
          '>0'
        )
      ];

      const blockers=
        gates
          .filter(row=>row.pass!==true)
          .map(row=>row.id);

      const pass=
        blockers.length===0;

      const result={
        version:
          'MEMEFLOW_SHADOW_POLICY_SIMULATOR_V23_21',
        shadowOnly:true,
        authority:'SIMULATION_ONLY',
        ready:true,
        status:
          pass
            ? 'SIMULATION_PASSES_REVIEW_GATE'
            : 'SIMULATION_DOES_NOT_PASS',
        candidateId:
          candidate.candidateId||null,
        candidateMode:
          candidate.mode||null,
        proposedAction:
          candidate.proposedAction||null,
        trigger:
          candidate.trigger||null,
        metrics,
        gates,
        blockers,
        forecastReference:{
          note:
            'POLICY_ACTION_METRICS_ARE_SEPARATE_FROM_FORECAST_METRICS',
          rawBrier:
            benchmark?.raw?.meanBrier??null,
          challengerBrier:
            benchmark?.challenger?.meanBrier??null,
          brierDelta:
            benchmark?.delta?.brier??null,
          rawLogLoss:
            benchmark?.raw?.meanLogLoss??null,
          challengerLogLoss:
            benchmark?.challenger?.meanLogLoss??null,
          logLossDelta:
            benchmark?.delta?.logLoss??null
        },
        verdict:{
          pass,
          reviewEligible:pass,
          reason:
            pass
              ? 'POLICY_GUARD_SHOWS_POSITIVE_SHADOW_ACTION_IMPACT'
              : (
                  blockers[0]||
                  'POLICY_SIMULATION_INCONCLUSIVE'
                )
        },
        controls:{
          applicationAllowed:false,
          automaticPromotion:false,
          ownerApprovalRequired:true,
          scoreMutation:false,
          stateMutation:false,
          settingsMutation:false,
          buySellMutation:false,
          forecastMutation:false
        }
      };

      runs++;

      if(pass){
        passRuns++;
      }

      last=result;
      return result;
    }catch{
      errors++;

      const result={
        version:
          'MEMEFLOW_SHADOW_POLICY_SIMULATOR_V23_21',
        shadowOnly:true,
        authority:'SIMULATION_ONLY',
        ready:false,
        status:'SIMULATION_ERROR',
        blockers:['SIMULATOR_ERROR'],
        candidateId:null,
        metrics:null,
        gates:[],
        verdict:{
          pass:false,
          reviewEligible:false,
          reason:'SIMULATOR_ERROR'
        },
        controls:{
          applicationAllowed:false,
          automaticPromotion:false,
          ownerApprovalRequired:true,
          scoreMutation:false,
          stateMutation:false,
          settingsMutation:false,
          buySellMutation:false,
          forecastMutation:false
        }
      };

      last=result;
      return result;
    }
  }

  function status(){
    return {
      version:
        'MEMEFLOW_SHADOW_POLICY_SIMULATOR_V23_21',
      shadowOnly:true,
      authority:'SIMULATION_ONLY',
      targetHorizonMs:
        TARGET_HORIZON_MS,
      runs,
      passRuns,
      errors,
      requirements:{
        minEvaluable:
          MIN_EVALUABLE,
        minAffected:
          MIN_AFFECTED,
        minNegativePrecisionPct:
          MIN_NEGATIVE_PRECISION_PCT,
        maxPositiveOpportunityCostPct:
          MAX_POSITIVE_OPPORTUNITY_COST_PCT,
        minNegativeBlockRatePct:
          MIN_NEGATIVE_BLOCK_RATE_PCT
      },
      last:
        last||simulate()
    };
  }

  return {
    simulate,
    status
  };
}

EOF_MODULE

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createShadowPolicySimulatorV23_21
} from '../src/shadow-policy-simulator-v23_21.mjs';

const candidate={
  candidateId:
    'V23_20_ERROR_AWARE_ENTRY_GUARD_BALANCED',
  mode:'BALANCED',
  proposedAction:
    'DOWNGRADE_SHADOW_ENTRY_READINESS_TO_WATCH',
  trigger:{
    requireMatureErrorPattern:true,
    requirePenaltyApplied:true,
    minPenaltyPct:10,
    maxAdjustedConfidencePct:55
  }
};

const rows=[];

// 120 rows: 60 positive, 60 negative.
// Affect 24 negatives + 4 positives => strong protective precision.
for(let i=0;i<120;i++){
  const positive=i<60;

  const affected=
    positive
      ? i<4
      : i<84;

  rows.push({
    key:`ROW_${i}`,
    scored:true,
    horizonMs:300_000,
    classification:
      positive
        ? 'POSITIVE'
        : 'NEGATIVE',
    errorAwareStatus:
      affected
        ? 'PENALTY_APPLIED'
        : 'NO_PATTERN_MATCH',
    penaltyPct:
      affected
        ? 20
        : 0,
    adjustedConfidencePct:
      affected
        ? 45
        : 80,
    rawConfidencePct:80,
    rawProbabilityPct:
      positive
        ? 80
        : 20,
    challengerProbabilityPct:
      positive
        ? 70
        : 30
  });
}

const simulator=
  createShadowPolicySimulatorV23_21({
    policyCandidateBuilder:{
      build(){
        return {
          ready:true,
          candidate
        };
      }
    },
    errorAwareBenchmark:{
      listRows(){
        return rows;
      },
      report(){
        return {
          raw:{
            meanBrier:0.20,
            meanLogLoss:0.60
          },
          challenger:{
            meanBrier:0.17,
            meanLogLoss:0.52
          },
          delta:{
            brier:0.03,
            logLoss:0.08
          }
        };
      }
    }
  });

const result=
  simulator.simulate();

assert.equal(
  result.ready,
  true
);

assert.equal(
  result.status,
  'SIMULATION_PASSES_REVIEW_GATE'
);

assert.equal(
  result.metrics.evaluableRows,
  120
);

assert.equal(
  result.metrics.affectedRows,
  28
);

assert.equal(
  result.metrics.preventedNegative,
  24
);

assert.equal(
  result.metrics.missedPositiveOpportunity,
  4
);

assert.ok(
  result.metrics.negativePrecisionPct>=60
);

assert.ok(
  result.metrics.positiveOpportunityCostPct<=12
);

assert.ok(
  result.metrics.negativeBlockRatePct>=15
);

assert.ok(
  result.metrics.netProtectedMinusMissed>0
);

assert.ok(
  result.gates.every(
    row=>row.pass===true
  )
);

assert.equal(
  result.verdict.reviewEligible,
  true
);

assert.equal(
  result.controls.applicationAllowed,
  false
);

assert.equal(
  result.controls.automaticPromotion,
  false
);

assert.equal(
  result.controls.stateMutation,
  false
);

assert.equal(
  result.controls.buySellMutation,
  false
);

assert.equal(
  result.controls.forecastMutation,
  false
);

const blocked=
  createShadowPolicySimulatorV23_21({
    policyCandidateBuilder:{
      build(){
        return {
          ready:false,
          candidate:null
        };
      }
    },
    errorAwareBenchmark:{
      listRows(){
        return rows;
      }
    }
  }).simulate();

assert.equal(
  blocked.status,
  'SIMULATION_BLOCKED'
);

assert.equal(
  blocked.verdict.reviewEligible,
  false
);

const source=
  fs.readFileSync(
    'src/shadow-policy-simulator-v23_21.mjs',
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

const benchmark=
  fs.readFileSync(
    'src/shadow-error-aware-benchmark-v23_19.mjs',
    'utf8'
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
  benchmark,
  /function listRows/
);

assert.match(
  shadow,
  /createShadowPolicySimulatorV23_21/
);

assert.match(
  shadow,
  /policySimulatorStatus/
);

assert.match(
  shadow,
  /runPolicySimulation/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/policy-simulation/
);

assert.match(
  html,
  /id="policySimulationStatus"/
);

assert.match(
  js,
  /loadPolicySimulation/
);

console.log(
  'shadow policy simulator v23.21 ok'
);

EOF_TEST

python3 - <<'PY'
from pathlib import Path

sp=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs")
bp=Path("memeflow-app/src/shadow-error-aware-benchmark-v23_19.mjs")
ap=Path("memeflow-app/app-server.mjs")
hp=Path("memeflow-app/owner-intelligence.html")
jp=Path("memeflow-app/owner-intelligence.js")
cp=Path("memeflow-app/owner-intelligence.css")

s=sp.read_text(encoding="utf-8")
b=bp.read_text(encoding="utf-8")
a=ap.read_text(encoding="utf-8")
h=hp.read_text(encoding="utf-8")
j=jp.read_text(encoding="utf-8")
c=cp.read_text(encoding="utf-8")

def once(text,old,new,label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(
            f"V23.21 REFUSED: {label}: expected 1 exact match, got {n}"
        )
    return text.replace(old,new,1)

# V23.19: expose full horizon-filtered rows for policy simulation.
old="""  function status(){
    const target=
      report({
        horizonMs:
          TARGET_HORIZON_MS
      });
"""

new="""  function listRows({
    limit=5000,
    horizonMs=null,
    penalizedOnly=false
  }={}){
    const safe=
      Math.max(
        1,
        Math.min(
          10_000,
          Number(limit)||5000
        )
      );

    const horizon=
      horizonMs===null
        ? null
        : Number(horizonMs);

    return rows
      .filter(
        row=>
          (
            horizon===null ||
            row.horizonMs===horizon
          ) &&
          (
            penalizedOnly!==true ||
            Number(row?.penaltyPct||0)>0
          )
      )
      .slice(-safe)
      .reverse();
  }

  function status(){
    const target=
      report({
        horizonMs:
          TARGET_HORIZON_MS
      });
"""

b=once(
    b,
    old,
    new,
    "benchmark listRows insertion"
)

old="""  return {
    recordOutcome,
    report,
    horizonReport,
    listRecent,
    status,
    flush
  };
}
"""

new="""  return {
    recordOutcome,
    report,
    horizonReport,
    listRecent,
    listRows,
    status,
    flush
  };
}
"""

b=once(
    b,
    old,
    new,
    "benchmark listRows export"
)

bp.write_text(b,encoding="utf-8")

old="""import {
  createShadowPolicyCandidateBuilderV23_20
} from './shadow-policy-candidate-builder-v23_20.mjs';"""

s=once(
    s,
    old,
    old+"""
import {
  createShadowPolicySimulatorV23_21
} from './shadow-policy-simulator-v23_21.mjs';""",
    "simulator import"
)

old="""  const shadowPolicyCandidateBuilder=
    createShadowPolicyCandidateBuilderV23_20({
      errorAwareBenchmark:
        shadowErrorAwareBenchmark,
      errorPatternLearner:
        shadowErrorPatternLearner
    });"""

s=once(
    s,
    old,
    old+"""

  const shadowPolicySimulator=
    createShadowPolicySimulatorV23_21({
      policyCandidateBuilder:
        shadowPolicyCandidateBuilder,
      errorAwareBenchmark:
        shadowErrorAwareBenchmark
    });""",
    "simulator construction"
)

s=once(
    s,
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_20'",
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_21'",
    "network version"
)

old="""      shadowErrorAwareBenchmark:shadowErrorAwareBenchmark.status(),
      shadowPolicyCandidateBuilder:shadowPolicyCandidateBuilder.status()
"""

s=once(
    s,
    old,
    """      shadowErrorAwareBenchmark:shadowErrorAwareBenchmark.status(),
      shadowPolicyCandidateBuilder:shadowPolicyCandidateBuilder.status(),
      shadowPolicySimulator:shadowPolicySimulator.status()
""",
    "simulator status"
)

old="""    buildPolicyCandidate:
      ()=>shadowPolicyCandidateBuilder.build(),
    status
"""

s=once(
    s,
    old,
    """    buildPolicyCandidate:
      ()=>shadowPolicyCandidateBuilder.build(),
    policySimulatorStatus:
      ()=>shadowPolicySimulator.status(),
    runPolicySimulation:
      ()=>shadowPolicySimulator.simulate(),
    status
""",
    "simulator API"
)

sp.write_text(s,encoding="utf-8")

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route=r"""/* MEMEFLOW_SHADOW_POLICY_SIMULATOR_MONITOR_V23_21
 * Owner-only, read-only simulation. Never applies candidate policy.
 */
 if(
   url.pathname==='/api/owner/intelligence/policy-simulation' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const result=
     tokenIntelligenceShadowV23
       .runPolicySimulation();

   return json(res,200,{
     ok:true,
     owner:true,
     shadowOnly:true,
     applicationAllowed:false,
     automaticPromotion:false,
     result
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

a=once(
    a,
    anchor,
    route,
    "simulator owner route"
)

ap.write_text(a,encoding="utf-8")

html_anchor="""      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

html_block=r"""      <!-- MEMEFLOW_SHADOW_POLICY_SIMULATOR_V23_21_UI -->
      <section
        id="policySimulationMonitor"
        class="oi-panel oi-policy-simulation"
      >
        <div class="oi-panel-head">
          <div>
            <span class="oi-eyebrow">
              POLICY IMPACT · SHADOW SIMULATION
            </span>
            <h2>V23.21 Policy Simulator</h2>
            <p>
              Replays the V23.20 candidate against completed frozen 5m
              outcomes. Measures protection versus opportunity cost.
              Nothing is applied to live trading.
            </p>
          </div>

          <span
            id="policySimulationStatus"
            class="oi-ai-status"
          >
            LOADING
          </span>
        </div>

        <div class="oi-grid oi-grid-4">
          <article class="oi-stat">
            <span>EVALUABLE</span>
            <strong id="policySimulationEvaluable">—</strong>
            <small>completed directional 5m rows</small>
          </article>

          <article class="oi-stat">
            <span>AFFECTED</span>
            <strong id="policySimulationAffected">—</strong>
            <small>rows candidate would downgrade</small>
          </article>

          <article class="oi-stat">
            <span>NEGATIVE BLOCKED</span>
            <strong id="policySimulationNegativeBlocked">—</strong>
            <small>bad outcomes intercepted</small>
          </article>

          <article class="oi-stat">
            <span>POSITIVE MISSED</span>
            <strong id="policySimulationPositiveMissed">—</strong>
            <small>opportunity cost</small>
          </article>
        </div>

        <div class="oi-grid oi-grid-2">
          <div>
            <h3>Impact</h3>
            <div
              id="policySimulationImpact"
              class="oi-list"
            ></div>
          </div>

          <div>
            <h3>Review gates</h3>
            <div
              id="policySimulationGates"
              class="oi-promotion-checks"
            ></div>
          </div>
        </div>

        <div
          id="policySimulationVerdict"
          class="oi-promotion-blocker"
          data-state="blocked"
        >
          Waiting for a V23.20 candidate and completed outcomes.
        </div>
      </section>

      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

h=once(
    h,
    html_anchor,
    html_block,
    "simulator UI"
)

hp.write_text(h,encoding="utf-8")

js_anchor="""/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

js_block=r"""/* MEMEFLOW_SHADOW_POLICY_SIMULATOR_V23_21_UI_JS */
function renderPolicySimulation(payload={}){
  const result=payload?.result||{};
  const metrics=result?.metrics||{};
  const gates=
    Array.isArray(result?.gates)
      ? result.gates
      : [];

  const badge=$('policySimulationStatus');

  if(badge){
    badge.className=
      'oi-ai-status '+
      (
        result?.verdict?.pass===true
          ? 'online'
          : (
              result?.status==='SIMULATION_DOES_NOT_PASS'
                ? 'offline'
                : ''
            )
      );

    badge.textContent=
      String(
        result?.status||'UNKNOWN'
      ).replaceAll('_',' ');
  }

  $('policySimulationEvaluable').textContent=
    num(metrics?.evaluableRows,0);

  $('policySimulationAffected').textContent=
    num(metrics?.affectedRows,0);

  $('policySimulationNegativeBlocked').textContent=
    num(metrics?.preventedNegative,0);

  $('policySimulationPositiveMissed').textContent=
    num(metrics?.missedPositiveOpportunity,0);

  $('policySimulationImpact').innerHTML=[
    [
      'Affected rate',
      pct(metrics?.affectedRatePct)
    ],
    [
      'Negative precision',
      pct(metrics?.negativePrecisionPct)
    ],
    [
      'Negative block rate',
      pct(metrics?.negativeBlockRatePct)
    ],
    [
      'Positive opportunity cost',
      pct(metrics?.positiveOpportunityCostPct)
    ],
    [
      'Positive preservation',
      pct(metrics?.positivePreservationPct)
    ],
    [
      'Net protected - missed',
      num(metrics?.netProtectedMinusMissed,0)
    ]
  ].map(([name,value])=>`
    <div class="oi-row">
      <span>${esc(name)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join('');

  $('policySimulationGates').innerHTML=
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
            Simulation gates unavailable.
          </div>
        `;

  const verdict=$('policySimulationVerdict');

  if(verdict){
    verdict.dataset.state=
      result?.verdict?.reviewEligible===true
        ? 'ready'
        : 'blocked';

    verdict.textContent=
      result?.verdict?.reviewEligible===true
        ? 'V23.21 SHADOW SIMULATION PASSED THE REVIEW GATE. Candidate remains unapplied; manual review is still required.'
        : String(
            result?.verdict?.reason||
            'Waiting for enough simulation evidence.'
          ).replaceAll('_',' ');
  }
}

async function loadPolicySimulation(){
  try{
    const payload=await api(
      '/api/owner/intelligence/policy-simulation'
    );

    renderPolicySimulation(payload);
  }catch(error){
    const badge=$('policySimulationStatus');

    if(badge){
      badge.className='oi-ai-status offline';
      badge.textContent='UNAVAILABLE';
    }

    const verdict=$('policySimulationVerdict');

    if(verdict){
      verdict.dataset.state='blocked';
      verdict.textContent=
        `Policy simulation unavailable: ${error.message}`;
    }
  }
}

/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

j=once(
    j,
    js_anchor,
    js_block,
    "simulator UI JS"
)

old="""      loadErrorAwareBenchmark(),
      loadPolicyCandidate()
    ]);
"""

j=once(
    j,
    old,
    """      loadErrorAwareBenchmark(),
      loadPolicyCandidate(),
      loadPolicySimulation()
    ]);
""",
    "simulator load"
)

jp.write_text(j,encoding="utf-8")

css_anchor="""/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

css_block=r"""/* ==========================================================
   MEMEFLOW_SHADOW_POLICY_SIMULATOR_V23_21
   ========================================================== */

.oi-policy-simulation
.oi-grid-2{
  margin-top:12px;
}

.oi-policy-simulation
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
    "simulator CSS"
)

cp.write_text(c,encoding="utf-8")

print("V23_21_TRANSFORM_OK")

PY

python3 - <<'PY'
import json
from pathlib import Path

p=Path("memeflow-app/package.json")
d=json.loads(p.read_text(encoding="utf-8"))
s=d["scripts"]["test:core"]

needle="node tests/shadow-policy-candidate-builder-v23_20.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-policy-candidate-builder-v23_20.mjs && node tests/shadow-policy-simulator-v23_21.mjs && node tests/assist-fresh-decision-v22.mjs"

if s.count(needle)!=1:
    raise SystemExit(
        "V23.21 REFUSED: package test anchor changed"
    )

if "shadow-policy-simulator-v23_21.mjs" in s:
    raise SystemExit(
        "V23.21 REFUSED: simulator test already installed"
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
 "memeflow-app/src/shadow-error-aware-benchmark-v23_19.mjs",
 "memeflow-app/package.json",
 "memeflow-app/owner-intelligence.html",
 "memeflow-app/owner-intelligence.js",
 "memeflow-app/owner-intelligence.css",
 "memeflow-app/src/shadow-policy-simulator-v23_21.mjs",
 "memeflow-app/tests/shadow-policy-simulator-v23_21.mjs"
]:
    p=Path(name)

    p.write_text(
        p.read_text(encoding="utf-8").rstrip("\n")+"\n",
        encoding="utf-8"
    )

print("V23_21_EOF_NORMALIZATION_OK")
PY

echo
echo "=== V23.21 SYNTAX ==="

node --check "$APP"
node --check "$SHADOW"
node --check "$BENCH"
node --check "$MODULE"
node --check "$TEST"
node --check "$JS"

node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"

echo "SYNTAX_OK"

echo
echo "=== V23.21 TARGETED TESTS ==="

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
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)

echo "TARGETED_TESTS_OK"

echo
echo "=== V23.21 FULL PROJECT TEST SUITE ==="

(
  cd memeflow-app
  npm test
)

echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.21 STATIC CONTRACT AUDIT ==="

python3 - <<'PY'
from pathlib import Path

m=Path(
 "memeflow-app/src/shadow-policy-simulator-v23_21.mjs"
).read_text()

b=Path(
 "memeflow-app/src/shadow-error-aware-benchmark-v23_19.mjs"
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
 "MEMEFLOW_SHADOW_POLICY_SIMULATOR_V23_21",
 "SIMULATION_PASSES_REVIEW_GATE",
 "SIMULATION_DOES_NOT_PASS",
 "MIN_EVALUABLE=100",
 "MIN_AFFECTED=10",
 "MIN_NEGATIVE_PRECISION_PCT=60",
 "MAX_POSITIVE_OPPORTUNITY_COST_PCT=12",
 "MIN_NEGATIVE_BLOCK_RATE_PCT=15",
 "applicationAllowed:false",
 "automaticPromotion:false",
 "forecastMutation:false"
]:
    if x not in m:
        errors.append("simulator marker missing: "+x)

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
 "function listRows",
 "listRows,"
]:
    if x not in b:
        errors.append("benchmark row access missing: "+x)

for x in [
 "createShadowPolicySimulatorV23_21",
 "shadowPolicySimulator:shadowPolicySimulator.status()",
 "policySimulatorStatus",
 "runPolicySimulation",
 "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_21"
]:
    if x not in s:
        errors.append("wiring missing: "+x)

for x in [
 "/api/owner/intelligence/policy-simulation",
 "applicationAllowed:false",
 "automaticPromotion:false"
]:
    if x not in a:
        errors.append("route missing: "+x)

for x in [
 'id="policySimulationStatus"',
 'id="policySimulationEvaluable"',
 'id="policySimulationAffected"',
 'id="policySimulationNegativeBlocked"',
 'id="policySimulationPositiveMissed"'
]:
    if x not in h:
        errors.append("UI missing: "+x)

for x in [
 "loadPolicySimulation",
 "renderPolicySimulation",
 "/api/owner/intelligence/policy-simulation"
]:
    if x not in j:
        errors.append("UI JS missing: "+x)

if ".oi-policy-simulation" not in c:
    errors.append("UI CSS missing")

if "shadow-policy-simulator-v23_21.mjs" not in p:
    errors.append("V23.21 test missing from package")

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
 "shadowErrorAwareBenchmark.recordOutcome",
 "shadowPolicyCandidateBuilder.build"
]:
    if x not in s:
        errors.append("backward compatibility missing: "+x)

if errors:
    raise SystemExit(
        "V23_21_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V23_21_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.21 DIFF ==="

git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|owner-intelligence\.html|owner-intelligence\.js|owner-intelligence\.css|src/token-intelligence-shadow-v23\.mjs|src/shadow-error-aware-benchmark-v23_19\.mjs|src/shadow-policy-simulator-v23_21\.mjs|tests/shadow-policy-simulator-v23_21\.mjs)$'

BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "V23.21 REFUSED: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.21 STAGED ==="

git diff --cached --stat

git commit -m "feat: add shadow policy simulator v23.21"

git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="

echo "Backup: $BACKUP"

git log -1 --oneline --decorate

echo
echo "V23.21 CONTRACT:"
echo "  V23.20 candidate is replayed on completed frozen 5m V23.19 rows"
echo "  simulation reports affected rate / prevented negatives / missed positives"
echo "  review gate requires >=100 evaluable and >=10 affected rows"
echo "  blocked-row negative precision must be >=60%"
echo "  positive opportunity cost must be <=12%"
echo "  negative block rate must be >=15%"
echo "  prevented negatives must exceed missed positives"
echo "  forecast Brier/log-loss are reference metrics only; policy action does not mutate forecasts"
echo "  applicationAllowed=false; automaticPromotion=false"
echo "  V22 remains the only trading authority"
echo "  no Score/State/Settings/BUY/SELL mutation"
