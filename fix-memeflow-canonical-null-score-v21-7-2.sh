#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "ERROR: run inside the MEMEFLOW Git repository"; exit 1; }
cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="a54658a6053e0e8469df3cfbf738e997d0986929"

EVAL="memeflow-app/src/evaluate.mjs"
APP="memeflow-app/app-server.mjs"
TOKENS="memeflow-app/system-tokens.js"
UNIFIED="memeflow-app/tests/unified-analysis-engine-v21.mjs"
STATE_TEST="memeflow-app/tests/canonical-score-state-v20_7.mjs"
LIVE_TRUTH_TEST="memeflow-app/tests/live-truth-no-dynamic-cache-v20_3.mjs"
NEW_TEST="memeflow-app/tests/canonical-null-score-v21_7.mjs"

FILES=("$EVAL" "$APP" "$TOKENS" "$UNIFIED" "$STATE_TEST" "$LIVE_TRUTH_TEST")

echo "=== MEMEFLOW CANONICAL NULL SCORE V21.7.2 ==="

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V21.7.2 REFUSED: expected branch $BRANCH"
  echo "actual: $(git branch --show-current)"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V21.7.2 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual:   $(git rev-parse HEAD)"
  echo "Nothing changed."
  exit 1
}

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || { echo "V21.7.2 REFUSED: missing $f"; exit 1; }
  git diff --quiet -- "$f" || { echo "V21.7.2 REFUSED: local changes in $f"; exit 1; }
  git diff --cached --quiet -- "$f" || { echo "V21.7.2 REFUSED: staged changes in $f"; exit 1; }
done

[[ ! -e "$NEW_TEST" ]] || {
  echo "V21.7.2 REFUSED: $NEW_TEST already exists"
  exit 1
}

python3 - <<'PY'
from pathlib import Path

checks={
"memeflow-app/src/evaluate.mjs":[
 "const opportunitySignal=finite(token.opportunityScore)",
 "const score=clampScore(qualitySignal*0.60+opportunitySignal*0.40);",
 "const scorePass=minimumScore===null?true:score>=minimumScore;",
 "else if(policy.waiting||priceWaiting||!opportunityReady){"
],
"memeflow-app/app-server.mjs":[
 "// MEMEFLOW_CANONICAL_LIVE_DECISION_V20_8_8",
 "const persisted=store.state.decisions?.[uid+':'+mint]||null;",
 "try{fresh=evaluate(token,settings)}catch{}",
 "score:finite(decision?.score),"
],
"memeflow-app/system-tokens.js":[
 "function __mfInvalidateDynamicRowV20_2(previous){",
 "function tokenScore(row) {",
 "qualityScore:null,",
 "opportunityScore:null,"
],
"memeflow-app/tests/unified-analysis-engine-v21.mjs":[
 "assert.equal(d.score,76);",
 "assert.equal('opportunityScore' in d,false);"
],
"memeflow-app/tests/canonical-score-state-v20_7.mjs":[
 "The live safety gate may force WAITING but must not zero the evaluator score."
],
"memeflow-app/tests/live-truth-no-dynamic-cache-v20_3.mjs":[
 "assert.match(app,/tradeEligible:isOpen\\?true:eligible&&liveTruth\\.pass===true/);"
]
}

for file,markers in checks.items():
    text=Path(file).read_text(encoding="utf-8")
    for marker in markers:
        if marker not in text:
            raise SystemExit(f"V21.7.2 REFUSED: audited marker missing in {file}: {marker}")

print("AUDITED_V21_7_INPUT_OK")
PY

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/canonical-null-score-v21-7-2-$STAMP"
mkdir -p "$BACKUP"

for f in "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V21.7.2 FAILED — RESTORING ==="
    for f in "${FILES[@]}"; do
      [[ -f "$BACKUP/$f" ]] && cp "$BACKUP/$f" "$f" || true
    done
    rm -f "$NEW_TEST"
    git reset -- "${FILES[@]}" "$NEW_TEST" >/dev/null 2>&1 || true
    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi
  exit "$rc"
}
trap rollback EXIT INT TERM

python3 - <<'PY'
from pathlib import Path

EVAL=Path("memeflow-app/src/evaluate.mjs")
APP=Path("memeflow-app/app-server.mjs")
TOKENS=Path("memeflow-app/system-tokens.js")
UNIFIED=Path("memeflow-app/tests/unified-analysis-engine-v21.mjs")
STATE_TEST=Path("memeflow-app/tests/canonical-score-state-v20_7.mjs")
LIVE_TRUTH_TEST=Path("memeflow-app/tests/live-truth-no-dynamic-cache-v20_3.mjs")

def once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"V21.7.2 REFUSED: {label}: expected 1 exact match, got {count}")
    return text.replace(old,new,1)

# ------------------------------------------------------------------
# evaluate(): no opportunity evidence => Score is unknown, NOT zero.
# ------------------------------------------------------------------
t=EVAL.read_text(encoding="utf-8")

t=once(
 t,
 """  const opportunitySignal=finite(token.opportunityScore)
    ?clampScore(token.opportunityScore)
    :0;

  // THE ONE SCORE.
  const score=clampScore(qualitySignal*0.60+opportunitySignal*0.40);
""",
 """  const opportunitySignal=finite(token.opportunityScore)
    ?clampScore(token.opportunityScore)
    :null;

  // MEMEFLOW_CANONICAL_NULL_SCORE_V21_7
  // A numerical Score exists only after the opportunity engine has enough
  // event evidence AND produced its signal. Missing evidence is UNKNOWN,
  // never synthetic zero.
  const scoreAvailable=
    token.opportunityEvidenceReady===true &&
    opportunitySignal!==null;

  // THE ONE SCORE.
  const score=
    scoreAvailable
      ? clampScore(qualitySignal*0.60+opportunitySignal*0.40)
      : null;
""",
 "evaluate score availability"
)

t=once(
 t,
 """  const scorePass=minimumScore===null?true:score>=minimumScore;
  const dataPass=minimumDataCompleteness===null?true:dataCompleteness>=minimumDataCompleteness;

  if(minimumScore!==null&&!scorePass){
    reasons.push(`Score ${score} below configured minimum ${minimumScore}`);
  }
""",
 """  const scorePass=
    scoreAvailable &&
    (minimumScore===null||score>=minimumScore);

  const dataPass=
    minimumDataCompleteness===null
      ? true
      : dataCompleteness>=minimumDataCompleteness;

  if(!scoreAvailable){
    reasons.push('waiting for canonical Score evidence');
  }else if(minimumScore!==null&&!scorePass){
    reasons.push(`Score ${score} below configured minimum ${minimumScore}`);
  }
""",
 "evaluate score gate"
)

t=once(
 t,
 """  }else if(policy.waiting||priceWaiting||!opportunityReady){
    state='WAITING';
""",
 """  }else if(policy.waiting||priceWaiting||!opportunityReady||!scoreAvailable){
    state='WAITING';
""",
 "evaluate waiting state"
)

t=once(
 t,
 """    {
      name:'Minimum Score',key:'minScore',
      status:scorePass?'PASS':'FAIL',pass:scorePass,
      value:score,threshold:minimumScore,operator:'>=',
      retryable:true,source:'evaluate'
    },
""",
 """    {
      name:'Minimum Score',key:'minScore',
      status:scoreAvailable?(scorePass?'PASS':'FAIL'):'WAITING',
      pass:scorePass,
      value:score,threshold:minimumScore,operator:'>=',
      retryable:true,source:'evaluate'
    },
""",
 "evaluate minimum score gate status"
)

t=once(
 t,
 """    state,
    score,

    // MEMEFLOW_CANONICAL_SCORE_COMPAT_ALIASES_V21_4
""",
 """    state,
    score,
    scoreAvailable,
    scoreFresh:scoreAvailable,
    scoreSource:scoreAvailable?'evaluate-live':'unavailable',

    // MEMEFLOW_CANONICAL_SCORE_COMPAT_ALIASES_V21_4
""",
 "evaluate score metadata"
)

EVAL.write_text(t,encoding="utf-8")

# ------------------------------------------------------------------
# Live decision wrapper:
# if a fresh evaluation is WAITING only because Score evidence is temporarily
# missing, retain the last confirmed canonical Score for DISPLAY/RANKING only.
# State remains fresh WAITING, therefore it cannot trade.
# ------------------------------------------------------------------
t=APP.read_text(encoding="utf-8")

anchor="""  let decision=fresh&&typeof fresh==='object'
    ? {...fresh,...operational}
    : {...operational,state:'WAITING',score:null,confidence:null,primaryReason:'Fresh evaluator data is unavailable',reasons:['Fresh evaluator data is unavailable'],terminal:false};

  if(isOpen){
"""

replacement="""  let decision=fresh&&typeof fresh==='object'
    ? {...fresh,...operational}
    : {...operational,state:'WAITING',score:null,confidence:null,primaryReason:'Fresh evaluator data is unavailable',reasons:['Fresh evaluator data is unavailable'],terminal:false};

  // MEMEFLOW_LAST_CONFIRMED_SCORE_V21_7
  // Never turn "unknown right now" into Score 0. If evaluate() has no fresh
  // numerical Score, a previously confirmed canonical Score may remain visible
  // while the CURRENT state stays WAITING. It is display/ranking continuity
  // only and cannot make tradeEligible true.
  const freshState=String(decision?.state||'').toUpperCase();
  const freshScoreKnown=
    decision?.score!==null &&
    decision?.score!==undefined &&
    decision?.score!=='' &&
    Number.isFinite(Number(decision.score));

  const persistedScoreKnown=
    persisted?.score!==null &&
    persisted?.score!==undefined &&
    persisted?.score!=='' &&
    Number.isFinite(Number(persisted.score));

  if(
    !isOpen &&
    freshState==='WAITING' &&
    !freshScoreKnown &&
    persistedScoreKnown &&
    String(persisted?.scoreAuthority||'evaluate')==='evaluate'
  ){
    const lastScore=Math.max(
      0,
      Math.min(100,Math.round(Number(persisted.score)))
    );

    decision={
      ...decision,
      score:lastScore,
      scoreAvailable:false,
      scoreFresh:false,
      scoreSource:'persisted-last-confirmed',
      scoreAuthority:'evaluate',
      scoreBeforeWalletRisk:lastScore,
      aiQuality:{
        ...(decision?.aiQuality&&typeof decision.aiQuality==='object'
          ? decision.aiQuality
          : {}),
        score:lastScore
      }
    };
  }else if(freshScoreKnown){
    decision={
      ...decision,
      scoreFresh:true,
      scoreSource:'evaluate-live'
    };
  }

  if(isOpen){
"""

t=once(t,anchor,replacement,"live persisted score continuity")

t=once(
 t,
 """    state:String(decision?.state||'WAITING'),
    score:finite(decision?.score),
    confidence:finite(decision?.confidence),
""",
 """    state:String(decision?.state||'WAITING'),
    score:finite(decision?.score),
    scoreAvailable:decision?.scoreAvailable===true,
    scoreFresh:decision?.scoreFresh===true,
    scoreSource:
      typeof decision?.scoreSource==='string'
        ? decision.scoreSource
        : null,
    confidence:finite(decision?.confidence),
""",
 "live card score metadata"
)

# Remove an obsolete comment that still describes deleted independent rank scores.
t=t.replace(
 """  // relevanceScore/feedScore remain ranking/sorting signals only.
  // The visible state must be the canonical decision state.
""",
 """  // Canonical Score is the only numerical ranking signal.
  // The visible state must be the canonical decision state.
""",
 1
)

APP.write_text(t,encoding="utf-8")

# ------------------------------------------------------------------
# Frontend invalidation: do not carry obsolete private score-shaped fields.
# ------------------------------------------------------------------
t=TOKENS.read_text(encoding="utf-8")
t=once(
 t,
 """      buyPressure:null,
      momentum:null,
      qualityScore:null,
      opportunityScore:null,
      opportunityEvidenceReady:false,
""",
 """      buyPressure:null,
      momentum:null,
      opportunityEvidenceReady:false,
""",
 "frontend obsolete score fields"
)
TOKENS.write_text(t,encoding="utf-8")

# ------------------------------------------------------------------
# Existing unified test: explicitly protect null-score semantics.
# ------------------------------------------------------------------
t=UNIFIED.read_text(encoding="utf-8")
anchor="""assert.equal(d.settingsEvaluation.gates.some(g=>g.name==='Opportunity safety floor'),false);

const ranked=rankCandidateViews([
"""
replacement="""assert.equal(d.settingsEvaluation.gates.some(g=>g.name==='Opportunity safety floor'),false);

const noEvidence=evaluate(
  {
    ...base,
    opportunityScore:null,
    opportunityEvidenceReady:false,
    opportunityTrendHealthy:false,
    opportunityEventCount:0
  },
  settings
);

assert.equal(noEvidence.state,'WAITING');
assert.equal(noEvidence.score,null);
assert.equal(noEvidence.scoreAvailable,false);
assert.equal(noEvidence.scoreFresh,false);
assert.equal(noEvidence.scoreSource,'unavailable');
assert.equal(noEvidence.scoreBeforeWalletRisk,null);
assert.equal(noEvidence.aiQuality.score,null);
assert.match(noEvidence.reasons.join(' · '),/waiting for canonical Score evidence/);

const ranked=rankCandidateViews([
"""
t=once(t,anchor,replacement,"unified null score regression")
UNIFIED.write_text(t,encoding="utf-8")

# ------------------------------------------------------------------
# Existing canonical state test: protect last-confirmed-score behavior.
# ------------------------------------------------------------------
t=STATE_TEST.read_text(encoding="utf-8")
anchor="""assert.doesNotMatch(decisionBlock,/confidence:0/);

// V28 must no longer convert canonical WAITING into a display-only WATCH.
"""
replacement="""assert.doesNotMatch(decisionBlock,/confidence:0/);

assert.match(decisionBlock,/MEMEFLOW_LAST_CONFIRMED_SCORE_V21_7/);
assert.match(decisionBlock,/scoreSource:'persisted-last-confirmed'/);
assert.match(decisionBlock,/freshState==='WAITING'/);
assert.match(decisionBlock,/!freshScoreKnown/);
assert.match(decisionBlock,/persistedScoreKnown/);

// V28 must no longer convert canonical WAITING into a display-only WATCH.
"""
t=once(t,anchor,replacement,"canonical state continuity regression")
STATE_TEST.write_text(t,encoding="utf-8")

# ------------------------------------------------------------------
# Old V20.3 regression still expected the pre-V21 tradeEligible expression.
# V21 requires canonical BUY READY in addition to admission + live truth.
# Update the TEST contract; production logic is already correct.
# ------------------------------------------------------------------
t=LIVE_TRUTH_TEST.read_text(encoding="utf-8")
t=once(
 t,
 r"""assert.match(app,/tradeEligible:isOpen\?true:eligible&&liveTruth\.pass===true/);""",
 r"""assert.match(app,/MEMEFLOW_TRADE_ELIGIBLE_CANONICAL_STATE_V21/);
assert.match(
  app,
  /eligible &&\s*liveTruth\.pass===true &&\s*String\(decision\?\.state\|\|''\)\.toUpperCase\(\)==='BUY READY'/
);
assert.doesNotMatch(
  app,
  /tradeEligible:isOpen\?true:eligible&&liveTruth\.pass===true/
);""",
 "live-truth stale tradeEligible regression"
)
LIVE_TRUTH_TEST.write_text(t,encoding="utf-8")

print("V21_7_TRANSFORM_OK")
PY

cat > "$NEW_TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluate} from '../src/evaluate.mjs';
import {rankCandidateViews} from '../src/feed-ranking.mjs';

// MEMEFLOW_CANONICAL_NULL_SCORE_REGRESSION_V21_7

const settings={
  minScore:82,
  minConfidence:0,
  minBuyPressure:0,
  minHolders:0,
  maxTop10Pct:100,
  maxDeveloperPct:100
};

const base={
  mint:'NullScore1111111111111111111111111111111',
  launchPlatform:'pump',
  priceSol:0.00001,
  holderCount:100,
  top10Pct:15,
  developerPct:3,
  buyPressure:2,
  holderFresh:true
};

// 1. No event-driven opportunity evidence = unknown Score, never synthetic 0.
const unknown=evaluate(
  {
    ...base,
    qualityScore:90,
    opportunityScore:null,
    opportunityEvidenceReady:false,
    opportunityTrendHealthy:false,
    opportunityEventCount:0
  },
  settings
);

assert.equal(unknown.state,'WAITING');
assert.equal(unknown.score,null);
assert.equal(unknown.scoreAvailable,false);
assert.equal(unknown.scoreFresh,false);
assert.equal(unknown.scoreSource,'unavailable');
assert.equal(unknown.scoreBeforeWalletRisk,null);
assert.equal(unknown.aiQuality.score,null);
assert.equal(
  unknown.settingsEvaluation.gates
    .find(g=>g.key==='minScore')?.status,
  'WAITING'
);

// 2. Real evidence produces the one real numerical Score.
const live=evaluate(
  {
    ...base,
    qualityScore:90,
    opportunityScore:85,
    opportunityEvidenceReady:true,
    opportunityTrendHealthy:true,
    opportunityEventCount:12
  },
  settings
);

assert.equal(live.score,88);
assert.equal(live.scoreAvailable,true);
assert.equal(live.scoreFresh,true);
assert.equal(live.scoreSource,'evaluate-live');
assert.equal(live.state,'BUY READY');

// 3. Ranking treats null as unknown, not zero.
const ranked=rankCandidateViews([
  {mint:'UNKNOWN',state:'WAITING',score:null,transactions5m:9999},
  {mint:'KNOWN',state:'WAITING',score:1,transactions5m:0}
]);
assert.equal(ranked[0].mint,'KNOWN');
assert.equal(ranked[0].score,1);
assert.equal(ranked[1].score,null);

// 4. Card/Details/Terminal must all consume the same canonical score property.
const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const terminal=fs.readFileSync(new URL('../trading.js',import.meta.url),'utf8');

assert.match(app,/MEMEFLOW_LAST_CONFIRMED_SCORE_V21_7/);
assert.match(app,/scoreSource:'persisted-last-confirmed'/);

const liveViewStart=app.indexOf('function __mfLiveCardViewV14(');
assert.ok(liveViewStart>=0);
const liveView=app.slice(liveViewStart,liveViewStart+9000);
assert.match(liveView,/score:finite\(decision\?\.score\)/);
assert.match(liveView,/scoreFresh:decision\?\.scoreFresh===true/);

assert.match(ui,/function tokenScore\(row\)/);
assert.doesNotMatch(ui,/a\?\.feedScore\?\?a\?\.relevanceScore/);

const loadStart=terminal.indexOf(
  'async function loadCandidates({ redrawChart = true } = {}) {'
);
const loadEnd=terminal.indexOf('function selectCandidate(mint) {',loadStart);
const load=terminal.slice(loadStart,loadEnd);
assert.match(load,/\/api\/system\/live-token-states\?limit=200/);
assert.doesNotMatch(load,/\/api\/ai\/decisions/);

console.log('CANONICAL_NULL_SCORE_V21_7_OK');
EOF_TEST

echo
echo "=== V21.7.2 PRECHECK ==="
grep -q "MEMEFLOW_CANONICAL_NULL_SCORE_V21_7" "$EVAL"
grep -q "MEMEFLOW_LAST_CONFIRMED_SCORE_V21_7" "$APP"
grep -q "CANONICAL_NULL_SCORE_V21_7_OK" "$NEW_TEST"
grep -q "function tokenScore(row) {" "$TOKENS"

if grep -n "qualityScore:null" "$TOKENS"; then
  echo "ERROR: obsolete frontend qualityScore invalidation remains"
  exit 1
fi
if grep -n "opportunityScore:null" "$TOKENS"; then
  echo "ERROR: obsolete frontend opportunityScore invalidation remains"
  exit 1
fi

echo "PRECHECK_OK"

echo
echo "=== V21.7.2 SYNTAX ==="
for f in "$EVAL" "$APP" "$TOKENS" "$UNIFIED" "$STATE_TEST" "$LIVE_TRUTH_TEST" "$NEW_TEST"; do
  node --check "$f"
done
echo "SYNTAX_OK"

echo
echo "=== V21.7.2 TARGETED TESTS ==="
(
  cd memeflow-app
  node tests/canonical-null-score-v21_7.mjs
  node tests/unified-analysis-engine-v21.mjs
  node tests/canonical-score-state-v20_7.mjs
  node tests/canonical-live-score-pipeline-v20_8_8.mjs
  node tests/card-details-live-authority-v20_5.mjs
  node tests/feed-ranking.mjs
  node tests/live-ranking-reorder-v23.mjs
  node tests/per-mint-card-refresh-v18.mjs
  node tests/live-truth-no-dynamic-cache-v20_3.mjs
  node tests/ai-decisions-inventory-hotpath-v60.mjs
  node tests/live-states-prefix-hotpath-v61.mjs
)
echo "TARGETED_TESTS_OK"

echo
echo "=== V21.7.2 FULL PROJECT TEST SUITE ==="
(
  cd memeflow-app
  npm test
)
echo "FULL_TEST_SUITE_OK"

echo
echo "=== V21.7.2 STATIC CONTRACT AUDIT ==="
python3 - <<'PY'
from pathlib import Path

e=Path("memeflow-app/src/evaluate.mjs").read_text()
a=Path("memeflow-app/app-server.mjs").read_text()
u=Path("memeflow-app/system-tokens.js").read_text()
tr=Path("memeflow-app/trading.js").read_text()

errors=[]

if "MEMEFLOW_CANONICAL_NULL_SCORE_V21_7" not in e:
    errors.append("canonical null-score marker missing")
if "const scoreAvailable=" not in e:
    errors.append("score availability guard missing")
if "scoreAvailable?'PASS':'FAIL'" in e:
    errors.append("Minimum Score gate cannot expose FAIL while Score is unknown")
if "status:scoreAvailable?(scorePass?'PASS':'FAIL'):'WAITING'" not in e:
    errors.append("Minimum Score WAITING semantics missing")
if "MEMEFLOW_LAST_CONFIRMED_SCORE_V21_7" not in a:
    errors.append("last confirmed score continuity missing")
if "freshState==='WAITING'" not in a:
    errors.append("persisted score is not restricted to WAITING")
if "scoreSource:'persisted-last-confirmed'" not in a:
    errors.append("persisted score provenance missing")
if "String(decision?.state||'').toUpperCase()==='BUY READY'" not in a:
    errors.append("trade eligibility no longer protected by canonical BUY READY")
if "qualityScore:null" in u or "opportunityScore:null" in u:
    errors.append("obsolete frontend private score fields remain")
if "/api/ai/decisions?scope=all&limit=100" in tr:
    errors.append("Terminal second decision feed returned")

lt=Path("memeflow-app/tests/live-truth-no-dynamic-cache-v20_3.mjs").read_text()
if "MEMEFLOW_TRADE_ELIGIBLE_CANONICAL_STATE_V21" not in lt:
    errors.append("live-truth regression does not protect canonical trade eligibility")
if "tradeEligible:isOpen\\?true:eligible&&liveTruth\\.pass===true" in lt:
    errors.append("stale pre-V21 tradeEligible regression remains")

if errors:
    raise SystemExit("STATIC_CONTRACT_AUDIT_FAILED:\n- "+"\n- ".join(errors))

print("STATIC_CONTRACT_AUDIT_OK")
PY

git diff --check -- "${FILES[@]}" "$NEW_TEST"

echo
echo "=== V21.7.2 DIFF ==="
git diff --stat -- "${FILES[@]}" "$NEW_TEST"

git reset >/dev/null
git add "${FILES[@]}" "$NEW_TEST"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|system-tokens\.js|src/evaluate\.mjs|tests/unified-analysis-engine-v21\.mjs|tests/canonical-score-state-v20_7\.mjs|tests/live-truth-no-dynamic-cache-v20_3\.mjs|tests/canonical-null-score-v21_7\.mjs)$'
BAD="$(git diff --cached --name-only | grep -Ev "$ALLOWED_RE" || true)"
if [[ -n "$BAD" ]]; then
  echo "ERROR: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V21.7.2 STAGED ==="
git diff --cached --stat

git commit -m "fix: keep unknown MEMEFLOW score null until evidence is ready"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
echo
echo "V21.7.2 CONTRACT:"
echo "  no opportunity evidence -> Score null / UI —"
echo "  fresh confirmed evidence -> one canonical numeric Score"
echo "  temporary WAITING -> last confirmed Score may remain visible"
echo "  persisted Score never changes current State or tradeEligible"
echo "  Card / Details / Terminal consume the same canonical score"
