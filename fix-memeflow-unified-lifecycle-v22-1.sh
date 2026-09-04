#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "ERROR: run inside the MEMEFLOW Git repository"; exit 1; }
cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="efad5ea907691a9e3260e264704770335a002f69"

APP="memeflow-app/app-server.mjs"
PAPER="memeflow-app/src/paper-engine.mjs"
PKG="memeflow-app/package.json"
OWNER_TEST="memeflow-app/tests/owner-live.mjs"
LIFECYCLE="memeflow-app/src/position-decision.mjs"
TEST_LIFECYCLE="memeflow-app/tests/lifecycle-decision-v22.mjs"
TEST_ASSIST="memeflow-app/tests/assist-fresh-decision-v22.mjs"

MODIFIED=("$APP" "$PAPER" "$PKG" "$OWNER_TEST")
NEW_FILES=("$LIFECYCLE" "$TEST_LIFECYCLE" "$TEST_ASSIST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW UNIFIED LIFECYCLE DECISION ENGINE V22.1 ==="

# Safe Replit stale git-index-lock recovery.
mf_git_process_in_repo(){
  local root_real
  root_real="$(readlink -f "$ROOT" 2>/dev/null || printf '%s' "$ROOT")"
  local proc pid comm cwd
  for proc in /proc/[0-9]*; do
    [[ -r "$proc/comm" ]] || continue
    pid="${proc##*/}"
    [[ "$pid" == "$$" ]] && continue
    comm="$(cat "$proc/comm" 2>/dev/null || true)"
    case "$comm" in git|git-*) ;; *) continue ;; esac
    cwd="$(readlink -f "$proc/cwd" 2>/dev/null || true)"
    [[ -n "$cwd" ]] || continue
    if [[ "$cwd" == "$root_real" || "$cwd" == "$root_real/"* ]]; then
      printf '%s\n' "$pid:$comm:$cwd"
      return 0
    fi
  done
  return 1
}

mf_clear_stale_index_lock(){
  local lock="$ROOT/.git/index.lock"
  [[ -e "$lock" ]] || return 0
  local active=""
  active="$(mf_git_process_in_repo || true)"
  if [[ -n "$active" ]]; then
    echo "V22 REFUSED: .git/index.lock exists and active git is running:"
    echo "$active"
    echo "Nothing changed."
    return 1
  fi
  echo "V22: removing stale .git/index.lock"
  rm -f -- "$lock"
  [[ ! -e "$lock" ]] || {
    echo "V22 REFUSED: unable to remove stale .git/index.lock"
    return 1
  }
}

mf_clear_stale_index_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V22 REFUSED: expected branch $BRANCH"
  echo "actual: $(git branch --show-current)"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V22 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual:   $(git rev-parse HEAD)"
  echo "Nothing changed."
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || { echo "V22 REFUSED: missing $f"; exit 1; }
  git diff --quiet -- "$f" || { echo "V22 REFUSED: local changes in $f"; exit 1; }
  git diff --cached --quiet -- "$f" || { echo "V22 REFUSED: staged changes in $f"; exit 1; }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || { echo "V22 REFUSED: $f already exists"; exit 1; }
done

python3 - <<'PY'
from pathlib import Path

checks={
"memeflow-app/src/paper-engine.mjs":[
 "import {evaluateSettingsGate} from './settings-gate.mjs';",
 "  approveProposal(userId, proposalId, token) {",
 "  updatePosition(position, token) {",
 "if (!position.tp1Executed && profitPct >= settings.tp1Pct)",
 "if (profitPct <= -settings.hardStopPct)",
 "if (position.trailingStopPriceSol && price <= position.trailingStopPriceSol)",
 "if (heldMinutes >= settings.maxHoldMinutes)",
 "settings.exitOnWeakBuyPressure"
],
"memeflow-app/app-server.mjs":[
 "return paper.approveProposal(",
 "    verified.token",
 "const verified=",
 "await __mfVerifyPreOpenRisk("
],
"memeflow-app/package.json":[
 "\"test:core\":",
 "node tests/paper-engine-auto.mjs",
 "node tests/preopen-common-finalize-v47.mjs"
],
"memeflow-app/tests/owner-live.mjs":[
 "Error('start timeout')",
 "setTimeout(()=>fail(Error('start timeout')),5000)",
 "p.stdout.on('data'",
 "p.on('exit'"
]
}
for file,markers in checks.items():
    text=Path(file).read_text(encoding="utf-8")
    for marker in markers:
        if marker not in text:
            raise SystemExit(f"V22 REFUSED: audited marker missing in {file}: {marker}")

paper=Path("memeflow-app/src/paper-engine.mjs").read_text(encoding="utf-8")
if "position-decision.mjs" in paper or "MEMEFLOW_UNIFIED_POSITION_DECISION_V22" in paper:
    raise SystemExit("V22 REFUSED: lifecycle engine already appears installed")

app=Path("memeflow-app/app-server.mjs").read_text(encoding="utf-8")
if "verified.decision" in app[app.find("async function __mfApprovePaperProposalWithRisk("):]:
    raise SystemExit("V22 REFUSED: fresh ASSIST decision already appears wired")

print("AUDITED_V22_INPUT_OK")
PY

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/unified-lifecycle-v22-1-$STAMP"
mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V22 FAILED — RESTORING ==="
    for f in "${MODIFIED[@]}"; do
      [[ -f "$BACKUP/$f" ]] && cp "$BACKUP/$f" "$f" || true
    done
    for f in "${NEW_FILES[@]}"; do rm -f "$f"; done
    mf_clear_stale_index_lock >/dev/null 2>&1 || true
    git reset -- "${ALL_FILES[@]}" >/dev/null 2>&1 || true
    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi
  exit "$rc"
}
trap rollback EXIT INT TERM

cat > "$LIFECYCLE" <<'EOF_LIFECYCLE'
import {evaluate} from './evaluate.mjs';

// MEMEFLOW_UNIFIED_POSITION_DECISION_V22
// One lifecycle brain for every OPEN position.
// evaluate() remains the ONLY canonical Score/State authority.
// This module converts current facts + canonical assessment into one
// execution-neutral lifecycle decision: HOLD / REDUCE / CLOSE.

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export const POSITION_DECISION_PRIORITY_V22=Object.freeze({
  EMERGENCY:900,
  HARD_STOP:800,
  TRAILING_STOP:700,
  TAKE_PROFIT:600,
  DETERIORATION:500,
  MAX_HOLD:400,
  WEAK_PRESSURE:300,
  HOLD:0
});

export const POSITION_DETERIORATION_POLICY_V22=Object.freeze({
  minimumScoreDrop:25,
  minimumDrawdownFromPeakPct:20
});

function safeAssessment(token,settings,currentDecision){
  if(currentDecision&&typeof currentDecision==='object'){
    return currentDecision;
  }
  try{
    return evaluate(token,settings);
  }catch{
    return {
      state:'WAITING',
      score:null,
      scoreAvailable:false,
      scoreFresh:false,
      scoreSource:'unavailable',
      primaryReason:'Current canonical assessment unavailable'
    };
  }
}

function closeDecision(reason,priority,metrics,assessment,code){
  return {
    version:'MEMEFLOW_POSITION_DECISION_V22',
    action:'CLOSE',
    reason,
    code,
    priority,
    actions:[{type:'CLOSE',reason,code}],
    metrics,
    assessment
  };
}

export function evaluatePositionDecision({
  position={},
  token={},
  settings={},
  currentDecision=null,
  now=Date.now()
}={}){
  const price=finite(token.priceSol);
  const entryPrice=finite(position.entryPriceSol);
  const previousHigh=finite(position.highestPriceSol);
  const highestPrice=
    price!==null
      ? Math.max(previousHigh??price,price)
      : previousHigh;

  const remainingQuantity=Math.max(0,finite(position.remainingTokenQuantity)??0);
  const profitPct=
    price!==null&&entryPrice!==null&&entryPrice>0
      ? ((price/entryPrice)-1)*100
      : null;

  const trailingStopPct=Math.max(0,finite(settings.trailingStopPct)??15);
  let trailingStopPrice=finite(position.trailingStopPriceSol);

  if(
    price!==null &&
    profitPct!==null &&
    profitPct>0 &&
    trailingStopPct>0 &&
    highestPrice!==null
  ){
    trailingStopPrice=
      highestPrice*(1-trailingStopPct/100);
  }

  const assessment=safeAssessment(token,settings,currentDecision);
  const currentScore=finite(assessment?.score);
  const entryScore=finite(position.decisionScore);
  const scoreDelta=
    currentScore!==null&&entryScore!==null
      ? currentScore-entryScore
      : null;

  const openedAt=finite(position.openedAtMs);
  const heldMinutes=
    openedAt!==null&&finite(now)!==null
      ? Math.max(0,(Number(now)-openedAt)/60000)
      : null;

  const buyPressure=finite(token.buyPressure);
  const recentNetFlowSol=finite(token.recentNetFlowSol);
  const drawdownFromPeakPct=finite(token.drawdownFromPeakPct);

  const metrics={
    priceSol:price,
    entryPriceSol:entryPrice,
    profitPct,
    highestPriceSol:highestPrice,
    trailingStopPriceSol:trailingStopPrice,
    heldMinutes,
    remainingTokenQuantity:remainingQuantity,
    entryScore,
    currentScore,
    scoreDeltaFromEntry:scoreDelta,
    currentState:String(assessment?.state||'WAITING'),
    scoreFresh:assessment?.scoreFresh===true,
    scoreSource:assessment?.scoreSource||null,
    buyPressure,
    recentNetFlowSol,
    drawdownFromPeakPct,
    opportunityEvidenceReady:token.opportunityEvidenceReady===true,
    opportunityTrendHealthy:token.opportunityTrendHealthy===true
  };

  const deadReason=String(token.deadReason||'').trim();
  if(token.dead===true||deadReason){
    return closeDecision(
      `EMERGENCY EXIT${deadReason?`: ${deadReason}`:''}`,
      POSITION_DECISION_PRIORITY_V22.EMERGENCY,
      metrics,
      assessment,
      'EMERGENCY_EXIT'
    );
  }

  const hardStopPct=Math.max(0,finite(settings.hardStopPct)??25);
  if(profitPct!==null&&profitPct<=-hardStopPct){
    return closeDecision(
      'HARD STOP',
      POSITION_DECISION_PRIORITY_V22.HARD_STOP,
      metrics,
      assessment,
      'HARD_STOP'
    );
  }

  if(
    price!==null &&
    trailingStopPrice!==null &&
    price<=trailingStopPrice
  ){
    return closeDecision(
      'TRAILING STOP',
      POSITION_DECISION_PRIORITY_V22.TRAILING_STOP,
      metrics,
      assessment,
      'TRAILING_STOP'
    );
  }

  const actions=[];
  const tp1Pct=Math.max(0,finite(settings.tp1Pct)??100);
  const tp2Pct=Math.max(0,finite(settings.tp2Pct)??200);
  const tp1SellPct=clamp(finite(settings.tp1SellPct)??50,0,100);
  const tp2SellPct=clamp(finite(settings.tp2SellPct)??25,0,100);

  if(
    profitPct!==null &&
    position.tp1Executed!==true &&
    profitPct>=tp1Pct &&
    tp1SellPct>0
  ){
    actions.push({
      type:'PARTIAL_EXIT',
      reason:'TP1',
      code:'TP1',
      percentOfInitial:tp1SellPct
    });
  }

  if(
    profitPct!==null &&
    position.tp2Executed!==true &&
    profitPct>=tp2Pct &&
    tp2SellPct>0
  ){
    actions.push({
      type:'PARTIAL_EXIT',
      reason:'TP2',
      code:'TP2',
      percentOfInitial:tp2SellPct
    });
  }

  if(actions.length){
    return {
      version:'MEMEFLOW_POSITION_DECISION_V22',
      action:'REDUCE',
      reason:actions.map(x=>x.reason).join(' + '),
      code:'TAKE_PROFIT',
      priority:POSITION_DECISION_PRIORITY_V22.TAKE_PROFIT,
      actions,
      metrics,
      assessment
    };
  }

  // Conservative deterioration exit: do not sell merely because an entry gate
  // changed. Require a large canonical Score deterioration PLUS unhealthy live
  // opportunity, negative recent flow and meaningful peak drawdown.
  const deterioration=
    token.opportunityEvidenceReady===true &&
    token.opportunityTrendHealthy===false &&
    scoreDelta!==null &&
    scoreDelta<=-POSITION_DETERIORATION_POLICY_V22.minimumScoreDrop &&
    recentNetFlowSol!==null &&
    recentNetFlowSol<0 &&
    drawdownFromPeakPct!==null &&
    drawdownFromPeakPct>=POSITION_DETERIORATION_POLICY_V22.minimumDrawdownFromPeakPct;

  if(deterioration){
    return closeDecision(
      'DETERIORATION EXIT',
      POSITION_DECISION_PRIORITY_V22.DETERIORATION,
      metrics,
      assessment,
      'DETERIORATION_EXIT'
    );
  }

  const maxHoldMinutes=Math.max(1,finite(settings.maxHoldMinutes)??1440);
  if(heldMinutes!==null&&heldMinutes>=maxHoldMinutes){
    return closeDecision(
      'MAX HOLD TIME',
      POSITION_DECISION_PRIORITY_V22.MAX_HOLD,
      metrics,
      assessment,
      'MAX_HOLD_TIME'
    );
  }

  const exitOnWeakBuyPressure=settings.exitOnWeakBuyPressure!==false;
  const exitBuyPressure=Math.max(0,finite(settings.exitBuyPressure)??1);

  if(
    exitOnWeakBuyPressure &&
    buyPressure!==null &&
    buyPressure<exitBuyPressure
  ){
    return closeDecision(
      'BUY PRESSURE EXIT',
      POSITION_DECISION_PRIORITY_V22.WEAK_PRESSURE,
      metrics,
      assessment,
      'BUY_PRESSURE_EXIT'
    );
  }

  return {
    version:'MEMEFLOW_POSITION_DECISION_V22',
    action:'HOLD',
    reason:'HOLD',
    code:'HOLD',
    priority:POSITION_DECISION_PRIORITY_V22.HOLD,
    actions:[],
    metrics,
    assessment
  };
}
EOF_LIFECYCLE

cat > "$TEST_LIFECYCLE" <<'EOF_TEST_LIFECYCLE'
import assert from 'node:assert/strict';
import {
  evaluatePositionDecision,
  POSITION_DECISION_PRIORITY_V22
} from '../src/position-decision.mjs';

const now=1_800_000_000_000;
const settings={
  hardStopPct:25,
  trailingStopPct:15,
  tp1Pct:100,
  tp1SellPct:50,
  tp2Pct:200,
  tp2SellPct:25,
  maxHoldMinutes:60,
  exitOnWeakBuyPressure:true,
  exitBuyPressure:1
};

const position=(overrides={})=>({
  entryPriceSol:0.001,
  currentPriceSol:0.001,
  highestPriceSol:0.001,
  trailingStopPriceSol:null,
  initialTokenQuantity:1000,
  remainingTokenQuantity:1000,
  openedAtMs:now-10*60_000,
  decisionScore:90,
  tp1Executed:false,
  tp2Executed:false,
  ...overrides
});

const token=(price,overrides={})=>({
  priceSol:price,
  buyPressure:2,
  opportunityEvidenceReady:true,
  opportunityTrendHealthy:true,
  recentNetFlowSol:0.2,
  drawdownFromPeakPct:0,
  ...overrides
});

const decision=(score=90,state='BUY READY')=>({
  state,
  score,
  scoreAvailable:true,
  scoreFresh:true,
  scoreSource:'evaluate-live'
});

// Emergency outranks every price rule.
{
  const d=evaluatePositionDecision({
    position:position(),
    token:token(0.0005,{dead:true,deadReason:'CREATOR_EXIT'}),
    settings,
    currentDecision:decision(20,'BLOCKED'),
    now
  });
  assert.equal(d.action,'CLOSE');
  assert.equal(d.code,'EMERGENCY_EXIT');
  assert.equal(d.priority,POSITION_DECISION_PRIORITY_V22.EMERGENCY);
  assert.match(d.reason,/CREATOR_EXIT/);
}

// Hard stop.
{
  const d=evaluatePositionDecision({
    position:position(),
    token:token(0.00074),
    settings,
    currentDecision:decision(60,'WATCH'),
    now
  });
  assert.equal(d.action,'CLOSE');
  assert.equal(d.reason,'HARD STOP');
}

// Trailing stop.
{
  const d=evaluatePositionDecision({
    position:position({highestPriceSol:0.002}),
    token:token(0.00169),
    settings,
    currentDecision:decision(80,'WATCH'),
    now
  });
  assert.equal(d.action,'CLOSE');
  assert.equal(d.reason,'TRAILING STOP');
}

// A jump through TP2 yields one lifecycle decision with both partial exits.
{
  const d=evaluatePositionDecision({
    position:position(),
    token:token(0.0031),
    settings,
    currentDecision:decision(96,'BUY READY'),
    now
  });
  assert.equal(d.action,'REDUCE');
  assert.deepEqual(d.actions.map(x=>x.reason),['TP1','TP2']);
  assert.deepEqual(d.actions.map(x=>x.percentOfInitial),[50,25]);
}

// Conservative deterioration requires all four signals, not just WATCH/BLOCKED.
{
  const d=evaluatePositionDecision({
    position:position(),
    token:token(0.0011,{
      opportunityTrendHealthy:false,
      recentNetFlowSol:-0.25,
      drawdownFromPeakPct:25
    }),
    settings,
    currentDecision:decision(60,'WATCH'),
    now
  });
  assert.equal(d.action,'CLOSE');
  assert.equal(d.reason,'DETERIORATION EXIT');
  assert.equal(d.metrics.scoreDeltaFromEntry,-30);
}

// A low Score alone does NOT force an exit.
{
  const d=evaluatePositionDecision({
    position:position(),
    token:token(0.0011,{
      opportunityTrendHealthy:true,
      recentNetFlowSol:0.1,
      drawdownFromPeakPct:5
    }),
    settings,
    currentDecision:decision(40,'WATCH'),
    now
  });
  assert.equal(d.action,'HOLD');
}

// Max hold.
{
  const d=evaluatePositionDecision({
    position:position({openedAtMs:now-61*60_000}),
    token:token(0.0011),
    settings,
    currentDecision:decision(85,'WATCH'),
    now
  });
  assert.equal(d.action,'CLOSE');
  assert.equal(d.reason,'MAX HOLD TIME');
}

// Weak pressure.
{
  const d=evaluatePositionDecision({
    position:position(),
    token:token(0.0011,{buyPressure:0.5}),
    settings,
    currentDecision:decision(85,'WATCH'),
    now
  });
  assert.equal(d.action,'CLOSE');
  assert.equal(d.reason,'BUY PRESSURE EXIT');
}

// Healthy position holds and exposes canonical assessment telemetry.
{
  const d=evaluatePositionDecision({
    position:position(),
    token:token(0.0012),
    settings,
    currentDecision:decision(88,'WATCH'),
    now
  });
  assert.equal(d.action,'HOLD');
  assert.equal(d.metrics.entryScore,90);
  assert.equal(d.metrics.currentScore,88);
  assert.equal(d.metrics.scoreDeltaFromEntry,-2);
  assert.equal(d.metrics.currentState,'WATCH');
}

console.log('unified lifecycle decision v22 ok');
EOF_TEST_LIFECYCLE

cat > "$TEST_ASSIST" <<'EOF_TEST_ASSIST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PaperEngine} from '../src/paper-engine.mjs';

const now=1_800_100_000_000;
const uid='assist-v22-user';
const mint='AssistFreshV2211111111111111111111111111111';

const settings={
  operatingMode:'assist',
  tradingEnvironment:'paper',
  positionSize:1,
  maxPositionSize:1,
  maxOpenPositions:4,
  maxDailyEntries:10,
  dailySpendLimit:0,
  tradingCapital:0,
  dailyLossLimit:0,
  feeReserve:0,
  decisionFreshnessSec:60,
  minScore:0,
  minConfidence:0,
  minHolders:0,
  maxTop10Pct:null,
  maxDeveloperPct:null,
  minBuyPressure:0,
  minLiquidityUsd:0,
  requireFreshHolderSnapshot:true,
  hardStopPct:25,
  trailingStopPct:15,
  tp1Pct:100,
  tp1SellPct:50,
  tp2Pct:200,
  tp2SellPct:25,
  runnerPct:25,
  maxHoldMinutes:1440,
  exitBuyPressure:1,
  exitOnWeakBuyPressure:true
};

const token={
  mint,
  name:'Assist Fresh V22',
  symbol:'AF22',
  priceSol:0.001,
  holderFresh:true,
  holderCount:100,
  top10Pct:10,
  developerPct:2,
  buyPressure:2,
  updatedAt:now,
  lastPriceAt:now
};

const proposal={
  id:'proposal-v22',
  idempotencyKey:'proposal-v22-key',
  userId:uid,
  mint,
  status:'PENDING',
  mode:'paper',
  createdAt:new Date(now).toISOString(),
  createdAtMs:now,
  decisionScore:74,
  decisionConfidence:70,
  primaryReason:'old proposal snapshot'
};

const store={
  state:{
    users:{
      [uid]:{
        id:uid,
        killSwitch:false,
        settings:{...settings}
      }
    },
    tokens:{[mint]:token},
    paperPositions:{},
    paperTrades:{},
    paperProposals:{[proposal.id]:proposal},
    paperProcessed:{},
    paperMetrics:{entries:0,exits:0,errors:0}
  },
  save(){}
};

const paper=new PaperEngine(store,{clock:()=>now});

const freshDecision={
  state:'BUY READY',
  score:94,
  confidence:100,
  dataCompleteness:100,
  scoreAuthority:'evaluate',
  scoreFresh:true,
  scoreSource:'evaluate-live',
  primaryReason:'fresh final pre-open decision',
  updatedAt:now
};

const result=paper.approveProposal(
  uid,
  proposal.id,
  token,
  freshDecision
);

assert.equal(result.ok,true);
assert.equal(result.position.decisionScore,94);
assert.equal(result.position.decisionConfidence,100);
assert.equal(result.position.primaryReason,'fresh final pre-open decision');
assert.equal(result.position.positionSizing.canonicalScore,94);
assert.equal(proposal.status,'APPROVED');
assert.equal(proposal.approvedDecisionScore,94);
assert.equal(proposal.proposedDecisionScore,74);

// Production ASSIST path must pass the verified fresh decision, not only token.
const app=fs.readFileSync('app-server.mjs','utf8');
const start=app.indexOf('async function __mfApprovePaperProposalWithRisk(');
const end=app.indexOf('// MEMEFLOW_CHART_LEVELS_LIVE_V7_2_1_DIRTY_SAFE',start);
assert.ok(start>=0&&end>start);
const block=app.slice(start,end);
assert.match(
  block,
  /paper\.approveProposal\(\s*uid,\s*proposalId,\s*verified\.token,\s*verified\.decision\s*\)/
);

console.log('assist fresh decision v22 ok');
EOF_TEST_ASSIST

python3 - <<'PY'
from pathlib import Path

paper_path=Path("memeflow-app/src/paper-engine.mjs")
app_path=Path("memeflow-app/app-server.mjs")
pkg_path=Path("memeflow-app/package.json")
owner_test_path=Path("memeflow-app/tests/owner-live.mjs")

paper=paper_path.read_text(encoding="utf-8")
app=app_path.read_text(encoding="utf-8")
pkg=pkg_path.read_text(encoding="utf-8")
owner_test=owner_test_path.read_text(encoding="utf-8")

def once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"V22 REFUSED: {label}: expected 1 exact match, got {count}")
    return text.replace(old,new,1)

# 1) PaperEngine imports lifecycle brain.
paper=once(
    paper,
    "import {evaluateSettingsGate} from './settings-gate.mjs';",
    "import {evaluateSettingsGate} from './settings-gate.mjs';\nimport {evaluatePositionDecision} from './position-decision.mjs';",
    "paper lifecycle import"
)

# 2) Initialize lifecycle telemetry on every new position.
paper=once(
    paper,
    """      primaryReason: decision?.primaryReason || null,
      strategySource: decision?.strategySource || null,
""",
    """      primaryReason: decision?.primaryReason || null,
      currentDecisionScore: decision?.score ?? null,
      currentDecisionState: decision?.state || null,
      scoreDeltaFromEntry: 0,
      lifecycleDecision: null,
      strategySource: decision?.strategySource || null,
""",
    "position lifecycle fields"
)

# 3) ASSIST approval consumes the final verified decision.
start=paper.find("  approveProposal(userId, proposalId, token) {")
end=paper.find("\n  rejectProposal(userId, proposalId) {",start)
if start<0 or end<=start:
    raise SystemExit("V22 REFUSED: approveProposal method boundary missing")

old_approve=paper[start:end]
if "proposal.decisionScore" not in old_approve or "this.openPosition" not in old_approve:
    raise SystemExit("V22 REFUSED: approveProposal audited body changed")

new_approve="""  approveProposal(userId, proposalId, token, verifiedDecision = null) {
    const proposal = this.store.state.paperProposals[proposalId];
    if (!proposal || proposal.userId !== userId) return { ok: false, code: 'NOT_FOUND' };
    if (proposal.status !== 'PENDING') return { ok: false, code: 'PROPOSAL_NOT_PENDING' };

    const user = this.store.state.users[userId];
    const settings = this.settings(user?.settings || {});

    if (
      settings.decisionFreshnessSec > 0 &&
      this.clock() - Number(proposal.createdAtMs || 0) > settings.decisionFreshnessSec * 1000
    ) {
      proposal.status = 'EXPIRED';
      proposal.resolvedAt = nowIso();
      this.save();
      return { ok: false, code: 'STALE_PROPOSAL' };
    }

    const liveToken = token || this.store.state.tokens[proposal.mint];

    // MEMEFLOW_ASSIST_FRESH_DECISION_V22
    // app-server performs the final admission/RPC/evaluate() pass immediately
    // before approval. If that decision is supplied, it is the execution
    // authority. Never size/open from the stale proposal-time Score.
    if (
      verifiedDecision &&
      String(verifiedDecision?.state || '').toUpperCase() !== 'BUY READY'
    ) {
      return {
        ok: false,
        code: 'DECISION_NOT_BUY_READY',
        decision: verifiedDecision
      };
    }

    const executionDecision =
      verifiedDecision && typeof verifiedDecision === 'object'
        ? verifiedDecision
        : {
            state: 'BUY READY',
            score: proposal.decisionScore,
            confidence: proposal.decisionConfidence,
            primaryReason: proposal.primaryReason
          };

    const result = this.openPosition(
      userId,
      liveToken,
      executionDecision,
      settings,
      proposal.idempotencyKey
    );

    if (!result.ok) return result;

    proposal.status = 'APPROVED';
    proposal.resolvedAt = nowIso();
    proposal.positionId = result.position.id;
    proposal.proposedDecisionScore = proposal.decisionScore ?? null;
    proposal.approvedDecisionScore = executionDecision?.score ?? null;
    proposal.approvedDecisionConfidence = executionDecision?.confidence ?? null;
    proposal.approvedDecisionState = executionDecision?.state || null;
    proposal.approvedDecisionSource =
      verifiedDecision ? 'preopen-fresh-evaluate' : 'proposal-compatibility';

    this.save();
    return result;
  }
"""
paper=paper[:start]+new_approve+paper[end:]

# 4) Replace independent exit-if chain with one lifecycle decision -> execution.
start=paper.find("  updatePosition(position, token) {")
end=paper.find("\n  partialExit(position, quantity, price, reason) {",start)
if start<0 or end<=start:
    raise SystemExit("V22 REFUSED: updatePosition method boundary missing")

old_update=paper[start:end]
required=[
 "if (!position.tp1Executed && profitPct >= settings.tp1Pct)",
 "if (profitPct <= -settings.hardStopPct)",
 "if (position.trailingStopPriceSol && price <= position.trailingStopPriceSol)",
 "if (heldMinutes >= settings.maxHoldMinutes)",
 "settings.exitOnWeakBuyPressure"
]
for marker in required:
    if marker not in old_update:
        raise SystemExit(f"V22 REFUSED: legacy updatePosition marker missing: {marker}")

new_update="""  updatePosition(position, token) {
    const price = num(token.priceSol);
    const settings = this.settings(position.settingsSnapshot || {});
    let durableMutation = false;

    // MEMEFLOW_UNIFIED_POSITION_EXECUTION_V22
    // Decision logic lives in position-decision.mjs. PaperEngine only executes
    // the returned lifecycle command(s).
    const lifecycle = evaluatePositionDecision({
      position,
      token,
      settings,
      now: this.clock()
    });

    const metrics = lifecycle?.metrics || {};

    position.currentPriceSol = price;
    position.highestPriceSol =
      num(metrics.highestPriceSol, Math.max(num(position.highestPriceSol, price), price));

    position.trailingStopPriceSol =
      metrics.trailingStopPriceSol === null ||
      metrics.trailingStopPriceSol === undefined
        ? null
        : num(metrics.trailingStopPriceSol, null);

    position.unrealizedPnlSol =
      position.remainingTokenQuantity * (price - position.entryPriceSol);

    position.unrealizedPnlPct =
      position.entryPriceSol > 0
        ? ((price / position.entryPriceSol) - 1) * 100
        : 0;

    position.currentDecisionScore =
      metrics.currentScore ?? null;

    position.currentDecisionState =
      metrics.currentState || null;

    position.scoreDeltaFromEntry =
      metrics.scoreDeltaFromEntry ?? null;

    position.lifecycleDecision = {
      version: lifecycle?.version || 'MEMEFLOW_POSITION_DECISION_V22',
      action: lifecycle?.action || 'HOLD',
      reason: lifecycle?.reason || 'HOLD',
      code: lifecycle?.code || 'HOLD',
      priority: Number(lifecycle?.priority) || 0,
      atMs: this.clock(),
      metrics: {
        profitPct: metrics.profitPct ?? null,
        heldMinutes: metrics.heldMinutes ?? null,
        entryScore: metrics.entryScore ?? null,
        currentScore: metrics.currentScore ?? null,
        scoreDeltaFromEntry: metrics.scoreDeltaFromEntry ?? null,
        currentState: metrics.currentState || null,
        scoreFresh: metrics.scoreFresh === true,
        scoreSource: metrics.scoreSource || null,
        buyPressure: metrics.buyPressure ?? null,
        recentNetFlowSol: metrics.recentNetFlowSol ?? null,
        drawdownFromPeakPct: metrics.drawdownFromPeakPct ?? null
      }
    };

    for (const command of Array.isArray(lifecycle?.actions) ? lifecycle.actions : []) {
      if (position.status !== 'OPEN') break;

      if (command?.type === 'PARTIAL_EXIT') {
        const pct = Math.max(0, Math.min(100, num(command.percentOfInitial)));
        const qty = Math.min(
          position.remainingTokenQuantity,
          position.initialTokenQuantity * pct / 100
        );

        if (qty > 0 && this.partialExit(position, qty, price, command.reason || 'PARTIAL EXIT')) {
          if (command.code === 'TP1') position.tp1Executed = true;
          if (command.code === 'TP2') position.tp2Executed = true;
          durableMutation = true;
        }

        continue;
      }

      if (command?.type === 'CLOSE') {
        durableMutation =
          this.closePositionInternal(
            position,
            price,
            command.reason || lifecycle?.reason || 'LIFECYCLE EXIT'
          ) || durableMutation;
        break;
      }
    }

    return { durable: durableMutation, lifecycle };
  }
"""
paper=paper[:start]+new_update+paper[end:]

paper_path.write_text(paper,encoding="utf-8")

# 5) ASSIST app-server passes verified.decision all the way into execution.
old_call="""  return paper.approveProposal(
    uid,
    proposalId,
    verified.token
  );
"""
new_call="""  // MEMEFLOW_ASSIST_FRESH_DECISION_V22
  return paper.approveProposal(
    uid,
    proposalId,
    verified.token,
    verified.decision
  );
"""
app=once(app,old_call,new_call,"assist verified decision wiring")
app_path.write_text(app,encoding="utf-8")

# 6) Keep new regressions in the normal full suite.
needle="node tests/paper-engine-auto.mjs && "
if pkg.count(needle)!=1:
    raise SystemExit(f"V22 REFUSED: package test insertion anchor count={pkg.count(needle)}")
pkg=pkg.replace(
    needle,
    "node tests/paper-engine-auto.mjs && node tests/lifecycle-decision-v22.mjs && node tests/assist-fresh-decision-v22.mjs && ",
    1
)
# 7) Harden owner-live startup test without weakening any entitlement assertion.
# The previous harness allowed only 5s and leaked the child process if startup
# timed out before entering the try/finally block. On loaded Replit runners this
# can fail despite a healthy server and can poison following tests.
old_start="""await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('start timeout')),5000);p.stdout.on('data',d=>{if(String(d).includes('listening')){clearTimeout(t);ok()}});p.on('exit',c=>fail(Error('server exited '+c)))});"""
new_start="""await new Promise((ok,fail)=>{
  let settled=false;
  let stderr='';
  const finish=(fn,value)=>{
    if(settled)return;
    settled=true;
    clearTimeout(timer);
    fn(value);
  };
  const timer=setTimeout(()=>{
    try{p.kill('SIGTERM')}catch{}
    finish(
      fail,
      Error(
        'start timeout after 15000ms'+
        (stderr?`\\nstderr:\\n${stderr.slice(-2000)}`:'')
      )
    );
  },15000);

  p.stderr.on('data',d=>{
    stderr=(stderr+String(d)).slice(-4000);
  });

  p.stdout.on('data',d=>{
    if(String(d).includes('listening')){
      finish(ok);
    }
  });

  p.on('exit',c=>{
    finish(
      fail,
      Error(
        'server exited '+c+
        (stderr?`\\nstderr:\\n${stderr.slice(-2000)}`:'')
      )
    );
  });
});"""
if owner_test.count(old_start)!=1:
    raise SystemExit(
        "V22.1 REFUSED: owner-live audited startup harness changed"
    )
owner_test=owner_test.replace(old_start,new_start,1)
owner_test_path.write_text(owner_test,encoding="utf-8")

pkg_path.write_text(pkg,encoding="utf-8")

print("V22_1_TRANSFORM_OK")
PY

echo
echo "=== V22.1 PRECHECK ==="
grep -q "MEMEFLOW_UNIFIED_POSITION_DECISION_V22" "$LIFECYCLE"
grep -q "MEMEFLOW_UNIFIED_POSITION_EXECUTION_V22" "$PAPER"
grep -q "MEMEFLOW_ASSIST_FRESH_DECISION_V22" "$PAPER"
grep -q "verified.decision" "$APP"
grep -q "lifecycle-decision-v22.mjs" "$PKG"
grep -q "assist-fresh-decision-v22.mjs" "$PKG"
echo "PRECHECK_OK"

echo
echo "=== V22.1 SYNTAX ==="
for f in "$APP" "$PAPER" "$OWNER_TEST" "$LIFECYCLE" "$TEST_LIFECYCLE" "$TEST_ASSIST"; do
  node --check "$f"
done
node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"
echo "SYNTAX_OK"

echo
echo "=== V22.1 TARGETED TESTS ==="
(
  cd memeflow-app
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
  node tests/paper-engine-auto.mjs
  node tests/paper-position-checkpoint-v55.mjs
  node tests/adaptive-position-sizing.mjs
  node tests/preopen-common-finalize-v47.mjs
  node tests/owner-live.mjs
  node tests/opportunity-engine.mjs
  node tests/canonical-live-score-pipeline-v20_8_8.mjs
  node tests/copy-trading-runtime-v2.mjs
  node tests/copy-trading-multi-wallet-v3.mjs
)
echo "TARGETED_TESTS_OK"

echo
echo "=== V22.1 FULL PROJECT TEST SUITE ==="
(
  cd memeflow-app
  npm test
)
echo "FULL_TEST_SUITE_OK"

echo
echo "=== V22.1 CONTRACT CHECK ==="
python3 - <<'PY'
from pathlib import Path

paper=Path("memeflow-app/src/paper-engine.mjs").read_text()
app=Path("memeflow-app/app-server.mjs").read_text()
life=Path("memeflow-app/src/position-decision.mjs").read_text()
pkg=Path("memeflow-app/package.json").read_text()
owner=Path("memeflow-app/tests/owner-live.mjs").read_text()

errors=[]

for marker in [
 "MEMEFLOW_UNIFIED_POSITION_DECISION_V22",
 "POSITION_DECISION_PRIORITY_V22",
 "DETERIORATION EXIT",
 "action:'HOLD'",
 "action:'REDUCE'",
 "action:'CLOSE'"
]:
    if marker not in life:
        errors.append(f"lifecycle marker missing: {marker}")

if "MEMEFLOW_UNIFIED_POSITION_EXECUTION_V22" not in paper:
    errors.append("PaperEngine lifecycle execution marker missing")
if "evaluatePositionDecision({" not in paper:
    errors.append("PaperEngine is not delegating lifecycle decision")
if "verifiedDecision = null" not in paper:
    errors.append("fresh decision approval parameter missing")
if "approvedDecisionScore" not in paper:
    errors.append("approved fresh score audit field missing")
if "verified.decision" not in app:
    errors.append("app-server does not pass final verified decision")
if "lifecycle-decision-v22.mjs" not in pkg or "assist-fresh-decision-v22.mjs" not in pkg:
    errors.append("V22 tests not in full suite")
if "start timeout after 15000ms" not in owner:
    errors.append("owner-live robust startup deadline missing")
if "try{p.kill('SIGTERM')}catch{}" not in owner:
    errors.append("owner-live timeout child cleanup missing")
if "stderr.slice(-2000)" not in owner:
    errors.append("owner-live startup diagnostics missing")

# Old independent exit-if chain must no longer live inside updatePosition().
start=paper.find("  updatePosition(position, token) {")
end=paper.find("\n  partialExit(position, quantity, price, reason) {",start)
block=paper[start:end]
for old in [
 "if (!position.tp1Executed && profitPct >= settings.tp1Pct)",
 "if (profitPct <= -settings.hardStopPct)",
 "if (position.trailingStopPriceSol && price <= position.trailingStopPriceSol)",
 "if (heldMinutes >= settings.maxHoldMinutes)"
]:
    if old in block:
        errors.append(f"legacy independent exit branch remains: {old}")

if errors:
    raise SystemExit("V22_CONTRACT_FAILED:\n- "+"\n- ".join(errors))

print("V22_CONTRACT_OK")
PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V22.1 DIFF ==="
git diff --stat -- "${ALL_FILES[@]}"

mf_clear_stale_index_lock
git reset >/dev/null
mf_clear_stale_index_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/paper-engine\.mjs|src/position-decision\.mjs|tests/lifecycle-decision-v22\.mjs|tests/assist-fresh-decision-v22\.mjs|tests/owner-live\.mjs)$'
BAD="$(git diff --cached --name-only | grep -Ev "$ALLOWED_RE" || true)"
if [[ -n "$BAD" ]]; then
  echo "ERROR: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V22.1 STAGED ==="
git diff --cached --stat

git commit -m "refactor: unify MEMEFLOW lifecycle decisions v22.1"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
echo
echo "V22.1 CONTRACT:"
echo "  evaluate() remains the only canonical Score/State authority"
echo "  ASSIST approval executes the final fresh pre-open decision"
echo "  OPEN positions use one lifecycle brain: HOLD / REDUCE / CLOSE"
echo "  exit priority: emergency > hard stop > trailing > TP > deterioration > max hold > weak pressure > hold"
echo "  PaperEngine executes decisions; it no longer owns independent exit rules"
echo "  lifecycle decision records current Score/State and score delta from entry"
echo "  owner-live startup harness allows 15s, kills timed-out child, and reports stderr"
