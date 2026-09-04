#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "ERROR: run inside the MEMEFLOW Git repository"; exit 1; }
cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="b66b98c492bf522f19a839257092a11846b754e3"

EVAL="memeflow-app/src/evaluate.mjs"
RANK="memeflow-app/src/feed-ranking.mjs"
LEGACY="memeflow-app/src/evaluator.mjs"
SIZE="memeflow-app/src/adaptive-position-sizing.mjs"
OPENAI="memeflow-app/src/openai-intelligence.mjs"
GAME="memeflow-app/src/game-engine.mjs"
SETTINGS="memeflow-app/src/settings.mjs"
APP="memeflow-app/app-server.mjs"
TOKENS="memeflow-app/system-tokens.js"
TRADING="memeflow-app/trading.js"
SYSTEM="memeflow-app/system.js"
SETTINGSPAGE="memeflow-app/settings-page.js"
INDEX="memeflow-app/index.html"

TOKENSHTML="memeflow-app/system-tokens.html"
TRADINGHTML="memeflow-app/trading.html"
SYSTEMHTML="memeflow-app/system.html"
SETTINGSHTML="memeflow-app/settings.html"

FEEDTEST="memeflow-app/tests/feed-ranking.mjs"
OPPTEST="memeflow-app/tests/opportunity-engine.mjs"
ADAPTTEST="memeflow-app/tests/adaptive-position-sizing.mjs"
TERMINALTEST="memeflow-app/tests/terminal-watch-merge-v37.mjs"
OLDTEST="memeflow-app/tests/canonical-live-score-pipeline-v20_8_8.mjs"
NEWTEST="memeflow-app/tests/unified-analysis-engine-v21.mjs"

FILES=(
  "$EVAL" "$RANK" "$LEGACY" "$SIZE" "$OPENAI" "$GAME" "$SETTINGS"
  "$APP" "$TOKENS" "$TRADING" "$SYSTEM" "$SETTINGSPAGE" "$INDEX"
  "$TOKENSHTML" "$TRADINGHTML" "$SYSTEMHTML" "$SETTINGSHTML"
  "$FEEDTEST" "$OPPTEST" "$ADAPTTEST" "$TERMINALTEST" "$OLDTEST"
)

echo "=== MEMEFLOW UNIFIED ANALYSIS ENGINE V21.1 ==="

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V21.1 REFUSED: expected branch $BRANCH"
  echo "actual: $(git branch --show-current)"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V21.1 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual:   $(git rev-parse HEAD)"
  echo "Nothing changed."
  exit 1
}

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || { echo "V21.1 REFUSED: missing $f"; exit 1; }
  git diff --quiet -- "$f" || { echo "V21.1 REFUSED: local changes in $f"; exit 1; }
  git diff --cached --quiet -- "$f" || { echo "V21.1 REFUSED: staged changes in $f"; exit 1; }
done

python3 - <<'PY'
from pathlib import Path
checks={
"memeflow-app/src/evaluate.mjs":[
 "const score=clampScore(qualityScore*0.60+opportunityScore*0.40);",
 "const opportunityFloor=45;",
 "name:'Opportunity safety floor'"
],
"memeflow-app/src/feed-ranking.mjs":[
 "MEMEFLOW_FEED_RELEVANCE_RANKING_V2",
 "export function candidateRelevanceScore",
 "feedScore: relevanceScore"
],
"memeflow-app/app-server.mjs":[
 "MEMEFLOW_CANONICAL_LIVE_DECISION_V20_8_8",
 "MEMEFLOW_UNIFIED_FULL_LIVE_VIEW_V20_8_8",
 "Number(token?.opportunityScore||0)",
 "qualityScore:finite(t?.qualityScore)"
],
"memeflow-app/trading.js":[
 "MEMEFLOW_TERMINAL_WATCH_DUPLICATE_MERGE_V37",
 "api('/api/ai/decisions?scope=all&limit=100')",
 "api('/api/system/live-token-states?limit=200')"
],
"memeflow-app/system-tokens.js":[
 "MEMEFLOW_SMART_HIDDEN_FEED_RANK_V20_8_8",
 "a?.feedScore??a?.relevanceScore",
 "Conf <b>"
],
"memeflow-app/src/adaptive-position-sizing.mjs":[
 "const quality = 0.60 * (score / 100) + 0.40 * (confidence / 100);"
],
"memeflow-app/src/evaluator.mjs":[
 "export function evaluateToken(token, rawConfig)",
 "if (passed===Object.keys(pass).length)"
],
"memeflow-app/src/game-engine.mjs":[
 "decision?.score ?? decision?.aiScore",
 "decision?.score ?? decision?.aiScore ?? decision?.priority"
],
"memeflow-app/src/openai-intelligence.mjs":[
 "out.aiScore=clamp(out.aiScore,0,100)",
 "qualityScore:t.qualityScore??null,opportunityScore:t.opportunityScore??null"
],
}
for file,markers in checks.items():
    text=Path(file).read_text(encoding="utf-8")
    for marker in markers:
        if marker not in text:
            raise SystemExit(f"V21.1 REFUSED: audited marker missing in {file}: {marker}")
print("AUDITED_V21_INPUT_OK")
PY

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/unified-analysis-engine-v21-1-$STAMP"
mkdir -p "$BACKUP"

for f in "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V21.1 FAILED — RESTORING ==="
    for f in "${FILES[@]}"; do
      [[ -f "$BACKUP/$f" ]] && cp "$BACKUP/$f" "$f" || true
    done
    rm -f "$NEWTEST"
    git reset -- "${FILES[@]}" "$NEWTEST" >/dev/null 2>&1 || true
    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi
  exit "$rc"
}
trap rollback EXIT INT TERM

cat > "$EVAL" <<'EOF_EVAL'
import {evaluateSettingsGate,tokenAgeMinutes} from './settings-gate.mjs';
import {qualityScoreFromToken} from './opportunity-engine.mjs';

// MEMEFLOW_UNIFIED_ANALYSIS_ENGINE_V21
// Scanner = facts. Opportunity engine = private signal extraction.
// evaluate() = the ONLY decision brain and public Score / State authority.

const clampScore=value=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));

function evidenceCompleteness(token={}){
  const components=[
    {key:'holders',available:finite(token.holderCount),points:20},
    {key:'top10',available:finite(token.top10Pct),points:20},
    {key:'developer',available:finite(token.developerPct),points:20},
    {key:'buyPressure',available:finite(token.buyPressure),points:20},
    {key:'verifiedPrice',available:finite(token.priceSol)&&Number(token.priceSol)>0,points:10},
    {key:'freshHolders',available:token.holderFresh===true,points:10}
  ];
  const value=components.reduce((sum,row)=>sum+(row.available?row.points:0),0);
  return {
    value:clampScore(value),
    components:components.map(row=>({...row,points:row.available?row.points:0,maxPoints:row.points}))
  };
}

export function evaluate(token,s={},options={}){
  const includePreOpenRisk=options?.includePreOpenRisk===true;
  const policy=evaluateSettingsGate(token,s,{includePreOpenRisk});
  const reasons=[...policy.reasons];

  // Private implementation signals. V21 deliberately preserves the calibrated
  // 60/40 formula so architecture changes do not silently move minScore.
  const qualitySignal=finite(token.qualityScore)
    ?clampScore(token.qualityScore)
    :qualityScoreFromToken(token).score;
  const opportunitySignal=finite(token.opportunityScore)
    ?clampScore(token.opportunityScore)
    :0;

  // THE ONE SCORE.
  const score=clampScore(qualitySignal*0.60+opportunitySignal*0.40);

  const evidence=evidenceCompleteness(token);
  const dataCompleteness=evidence.value;
  const confidence=dataCompleteness; // compatibility alias, not another score

  let priceWaiting=false,priceBlocked=false,priceStatus='PASS';
  if(token.priceSol==null){
    priceWaiting=true;priceStatus='WAITING';reasons.push('price unavailable');
  }else if(!finite(token.priceSol)||Number(token.priceSol)<=0){
    priceBlocked=true;priceStatus='FAIL';reasons.push('price unavailable');
  }

  const minimumScore=finite(s.minScore)?Number(s.minScore):null;
  const minimumDataCompleteness=finite(s.minConfidence)?Number(s.minConfidence):null;
  const scorePass=minimumScore===null?true:score>=minimumScore;
  const dataPass=minimumDataCompleteness===null?true:dataCompleteness>=minimumDataCompleteness;

  if(minimumScore!==null&&!scorePass){
    reasons.push(`Score ${score} below configured minimum ${minimumScore}`);
  }
  if(minimumDataCompleteness!==null&&!dataPass){
    reasons.push(`data completeness ${dataCompleteness}% below configured minimum ${minimumDataCompleteness}%`);
  }

  const walletRiskPending=
    includePreOpenRisk && (
      (finite(s.maxSuspectedRiskyWalletsPct)&&!finite(token.suspectedRiskyWalletsPct))||
      (finite(s.maxInsidersPct)&&!finite(token.insidersPct))
    );

  const dead=token.dead===true||Boolean(token.deadReason);
  const opportunityReady=token.opportunityEvidenceReady===true;
  const trendHealthy=token.opportunityTrendHealthy===true;

  if(dead)reasons.unshift(`token lifecycle dead: ${token.deadReason||'DEAD'}`);
  if(!opportunityReady)reasons.push('waiting for event-driven opportunity evidence');
  else if(!trendHealthy)reasons.push('live opportunity trend is not healthy');

  const stablePolicyFail=policy.failedGates.some(g=>g.retryable!==true);
  const retryablePolicyFail=policy.failedGates.some(g=>g.retryable===true);

  let state;
  if(dead||stablePolicyFail||priceBlocked){
    state='BLOCKED';
  }else if(policy.waiting||priceWaiting||!opportunityReady){
    state='WAITING';
  }else if(retryablePolicyFail||!trendHealthy){
    state='WATCH';
  }else if(scorePass&&dataPass){
    state='BUY READY';
  }else{
    state='WATCH';
  }

  const gates=[
    ...policy.gates,
    {
      name:'Verified price',key:'verifiedPrice',status:priceStatus,
      pass:priceStatus==='PASS',value:token.priceSol??null,threshold:'> 0',
      operator:'>',retryable:true,reason:'price unavailable',source:'priceSol'
    },
    {
      name:'Opportunity evidence',key:'opportunityEvidenceReady',
      status:opportunityReady?'PASS':'WAITING',pass:opportunityReady,
      value:token.opportunityEventCount??0,threshold:'event evidence',
      operator:'ready',retryable:true,source:'opportunityEngine'
    },
    {
      name:'Opportunity trend',key:'opportunityTrendHealthy',
      status:opportunityReady?(trendHealthy?'PASS':'FAIL'):'WAITING',
      pass:trendHealthy,value:trendHealthy,threshold:true,operator:'===',
      retryable:true,source:'opportunityEngine'
    },
    {
      name:'Minimum Score',key:'minScore',
      status:scorePass?'PASS':'FAIL',pass:scorePass,
      value:score,threshold:minimumScore,operator:'>=',
      retryable:true,source:'evaluate'
    },
    {
      name:'Minimum data completeness',key:'minConfidence',
      status:dataPass?'PASS':'FAIL',pass:dataPass,
      value:dataCompleteness,threshold:minimumDataCompleteness,operator:'>=',
      retryable:true,source:'evaluate'
    }
  ];

  return {
    analysisVersion:'MEMEFLOW_UNIFIED_ANALYSIS_V21',
    scoreAuthority:'evaluate',
    state,
    score,
    confidence,
    dataCompleteness,
    opportunityEvidenceReady:opportunityReady,
    opportunityTrendHealthy:trendHealthy,
    walletRiskPending,
    walletRisk:{
      suspectedRiskyWalletsPct:finite(token.suspectedRiskyWalletsPct)?Number(token.suspectedRiskyWalletsPct):null,
      insidersPct:finite(token.insidersPct)?Number(token.insidersPct):null,
      scannedAt:token.walletClusterRiskScannedAt??null,
      version:token.walletClusterRiskVersion??null
    },
    reasons,
    primaryReason:reasons[0]||'All configured safety gates passed and live opportunity is healthy',
    settingsEvaluation:{
      state:policy.state,
      minScore:minimumScore,
      minConfidence:minimumDataCompleteness,
      gates,
      failedGates:policy.failedGates,
      waitingGates:policy.waitingGates,
      hasRetryableFailure:policy.hasRetryableFailure,
      hasStableFailure:policy.hasStableFailure
    }
  };
}

export {tokenAgeMinutes};
EOF_EVAL

cat > "$RANK" <<'EOF_RANK'
// MEMEFLOW_UNIFIED_SCORE_RANKING_V21
// One ranking number: view.score from evaluate().
// Order: state lane -> canonical Score -> factual live tie-breakers.

const STATE_PRIORITY=Object.freeze({
  'OPEN POSITION':500,'OPEN_POSITION':500,'OPEN':500,'POSITION':500,
  'BUY READY':400,'BUY_READY':400,'WATCH':300,'WAITING':300,
  'BLOCKED':100,'REJECTED':50,'EXPIRED':25
});

const number=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

function normalizedState(state){
  return String(state||'WAITING').trim().toUpperCase();
}
function statePriority(state){
  return STATE_PRIORITY[normalizedState(state)]??0;
}

// Compatibility export: no second formula anymore.
export function candidateRelevanceScore(view={}){
  return number(view?.score);
}

export function compareCandidateViews(a={},b={}){
  const stateDelta=statePriority(b.state)-statePriority(a.state);
  if(stateDelta)return stateDelta;

  const as=number(a.score),bs=number(b.score);
  if(as!==null||bs!==null){
    const ar=as??Number.NEGATIVE_INFINITY;
    const br=bs??Number.NEGATIVE_INFINITY;
    if(br!==ar)return br-ar;
  }

  const at=number(a.transactions5m)??0,bt=number(b.transactions5m)??0;
  if(bt!==at)return bt-at;

  const av=number(a.volume5mUsd)??number(a.volume5mSol)??0;
  const bv=number(b.volume5mUsd)??number(b.volume5mSol)??0;
  if(bv!==av)return bv-av;

  const amc=number(a.marketCapUsd)??number(a.marketCapSol??a.marketCap)??0;
  const bmc=number(b.marketCapUsd)??number(b.marketCapSol??b.marketCap)??0;
  if(bmc!==amc)return bmc-amc;

  const ah=number(a.holderCount??a.holders??a.observedHolderCount)??0;
  const bh=number(b.holderCount??b.holders??b.observedHolderCount)??0;
  if(bh!==ah)return bh-ah;

  const aq=number(a.quoteAgeMs)??Number.MAX_SAFE_INTEGER;
  const bq=number(b.quoteAgeMs)??Number.MAX_SAFE_INTEGER;
  if(aq!==bq)return aq-bq;

  return String(a.mint||a.id||'').localeCompare(String(b.mint||b.id||''));
}

export function rankCandidateViews(views=[]){
  return (Array.isArray(views)?views:[])
    .filter(Boolean)
    .map(view=>{
      const score=number(view.score);
      const base={...view};
      // Rolling-deploy cleanup: old rows may still carry these legacy fields.
      // Delete them without creating another score/ranking path.
      delete base.feedScore;
      delete base.relevanceScore;
      return {
        ...base,
        score,
        decisionScore:score,
        scoreAuthority:'evaluate',
        statePriority:statePriority(view.state)
      };
    })
    .sort(compareCandidateViews);
}

export {statePriority as candidateStatePriority};
EOF_RANK

cat > "$LEGACY" <<'EOF_LEGACY'
import {createHash} from 'node:crypto';
import {evaluate} from './evaluate.mjs';

// MEMEFLOW_LEGACY_EVALUATOR_ADAPTER_V21
// Historical API surface only. No independent evaluator remains.
export const DECISIONS=Object.freeze({
  BUY_READY:'BUY_READY',WATCH:'WATCH',WAITING:'WAITING',BLOCKED:'BLOCKED'
});

export function normalizeConfig(input={}){
  const n=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
  const b=(v,d)=>typeof v==='boolean'?v:d;
  return Object.freeze({
    minScore:n(input.minScore,72),
    minConfidence:n(input.minConfidence,80),
    minLiquidityUsd:n(input.minLiquidityUsd,12000),
    minMarketCapUsd:n(input.minMarketCapUsd,10000),
    minHolders:n(input.minHolders,30),
    maxTop10Pct:n(input.maxTop10Pct??input.maxTop10,25),
    maxDeveloperPct:n(input.maxDeveloperPct??input.maxDeveloper,20),
    minBuyPressure:n(input.minBuyPressure,2),
    minTokenAgeMinutes:n(input.minTokenAgeMinutes??input.minAgeMin,1),
    maxTokenAgeMinutes:n(input.maxTokenAgeMinutes??input.maxAgeMin,150),
    requireFreshHolderSnapshot:b(input.requireFreshHolderSnapshot??input.requireFreshHolders,true),
    requireWebsiteOrX:b(input.requireWebsiteOrX??input.requireIdentity,false)
  });
}

export function configHash(config){
  return createHash('sha256').update(JSON.stringify(normalizeConfig(config))).digest('hex').slice(0,16);
}

function canonicalToken(token={}){
  const createdAt=
    Number.isFinite(Number(token?.createdAt))
      ?Number(token.createdAt)
      :Number.isFinite(Number(token?.ageMin))
        ?Date.now()-Number(token.ageMin)*60000
        :null;

  return {
    ...token,
    mint:token?.mint,
    priceSol:token?.priceSol??token?.price,
    liquidityUsd:token?.liquidityUsd,
    marketCapUsd:token?.marketCapUsd,
    holderCount:token?.holderCount??token?.holders,
    top10Pct:token?.top10Pct??token?.top10,
    developerPct:token?.developerPct??token?.developer,
    buyPressure:token?.buyPressure,
    holderFresh:token?.holderFresh??token?.holdersFresh,
    holderScannedAt:Number.isFinite(Number(token?.holderAgeSec))
      ?Date.now()-Number(token.holderAgeSec)*1000
      :token?.holderScannedAt,
    createdAt,
    opportunityEvidenceReady:token?.opportunityEvidenceReady===undefined
      ?true:token.opportunityEvidenceReady===true,
    opportunityTrendHealthy:token?.opportunityTrendHealthy===undefined
      ?true:token.opportunityTrendHealthy===true
  };
}

function legacyDecisionState(state){
  return String(state||'WAITING').trim().toUpperCase().replace(/\s+/g,'_');
}

export function evaluateToken(token,rawConfig){
  if(!token||!token.mint){
    return {
      decision:DECISIONS.BLOCKED,state:'BLOCKED',score:null,
      reasons:['INVALID_TOKEN'],scoreAuthority:'evaluate'
    };
  }
  const result=evaluate(canonicalToken(token),normalizeConfig(rawConfig));
  return {...result,decision:legacyDecisionState(result.state),scoreAuthority:'evaluate'};
}
EOF_LEGACY

python3 - <<'PY'
from pathlib import Path
import re

APP=Path("memeflow-app/app-server.mjs")
TOKENS=Path("memeflow-app/system-tokens.js")
TRADING=Path("memeflow-app/trading.js")
SIZE=Path("memeflow-app/src/adaptive-position-sizing.mjs")
OPENAI=Path("memeflow-app/src/openai-intelligence.mjs")
GAME=Path("memeflow-app/src/game-engine.mjs")
SETTINGS=Path("memeflow-app/src/settings.mjs")
SYSTEM=Path("memeflow-app/system.js")
SETTINGSPAGE=Path("memeflow-app/settings-page.js")
INDEX=Path("memeflow-app/index.html")

def once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"V21.1 REFUSED: {label}: expected 1 match, got {count}")
    return text.replace(old,new,1)

app=APP.read_text(encoding="utf-8")

app=once(
 app,
 """  let lane=3;
  let score=Math.max(
    0,
    Number(token?.opportunityScore||0),
    Number(token?.qualityScore||0),
    Number(token?.score||0)
  );

  try{
""",
 """  let lane=3;

  // MEMEFLOW_HOLDER_CANONICAL_SCORE_PRIORITY_V21
  // Scheduler priority uses only canonical stored decision Score.
  let score=0;

  try{
""",
 "holder scheduler alternative scores"
)

app=once(
 app,
 "if(!isOpen&&liveTruth.pass!==true){",
 """if(
    !isOpen &&
    String(decision?.state||'').toUpperCase()!=='BLOCKED' &&
    liveTruth.pass!==true
  ){""",
 "live truth BLOCKED guard"
)

app=once(
 app,
 "return {...decision,mint,tradeEligible:isOpen?true:eligible&&liveTruth.pass===true,displayOnly:!eligible&&!isOpen,openPositionOverride:isOpen&&!eligible,entryAdmissionState:admissionState,entryAdmissionReasons:admissionReasons.slice(0,20)};",
 """return {
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
    displayOnly:!eligible&&!isOpen,
    openPositionOverride:isOpen&&!eligible,
    entryAdmissionState:admissionState,
    entryAdmissionReasons:admissionReasons.slice(0,20)
  };""",
 "tradeEligible canonical state"
)

app=once(
 app,
 """    qualityScore:finite(t?.qualityScore),
    opportunityScore:finite(t?.opportunityScore),
    opportunityEvidenceReady:t?.opportunityEvidenceReady===true,
""",
 """    // MEMEFLOW_ONE_PUBLIC_SCORE_V21
    scoreAuthority:decision?.scoreAuthority||'evaluate',
    analysisVersion:decision?.analysisVersion||'MEMEFLOW_UNIFIED_ANALYSIS_V21',
    dataCompleteness:finite(decision?.dataCompleteness??decision?.confidence),
    opportunityEvidenceReady:t?.opportunityEvidenceReady===true,
""",
 "public card alternative score fields"
)
APP.write_text(app,encoding="utf-8")

ui=TOKENS.read_text(encoding="utf-8")
pattern=re.compile(
 r"""        // MEMEFLOW_SMART_HIDDEN_FEED_RANK_V20_8_8\n.*?        // MEMEFLOW_SCORE_FIRST_TIEBREAK_V22""",
 re.S
)
ui,n=pattern.subn(
 """        // MEMEFLOW_SMART_CANONICAL_SCORE_RANK_V21
        // Canonical Score is the only numeric ranking authority.
        const scoreA = Number(tokenScore(a) ?? -1);
        const scoreB = Number(tokenScore(b) ?? -1);
        if (scoreA !== scoreB) return scoreB - scoreA;

        // MEMEFLOW_SCORE_FIRST_TIEBREAK_V22""",
 ui,
 count=1
)
if n!=1: raise SystemExit(f"V21.1 REFUSED: smart rank block count={n}")

ui=once(
 ui,
 """        <span>Score <b>${escapeHtml(scoreLabel)}</b></span>
        <span>Conf <b>${escapeHtml(confidenceLabel)}</b></span>
""",
 """        <span>Score <b>${escapeHtml(scoreLabel)}</b></span>
""",
 "Details visible confidence"
)
TOKENS.write_text(ui,encoding="utf-8")

tr=TRADING.read_text(encoding="utf-8")
mstart=tr.find("function mergedCandidates() {")
mend=tr.find("function displayStateForCandidate(candidate) {",mstart)
if mstart<0 or mend<=mstart: raise SystemExit("V21.1 REFUSED: mergedCandidates boundaries")
old_merge=tr[mstart:mend]
for marker in ("MEMEFLOW_TERMINAL_WATCH_DUPLICATE_MERGE_V37","liveWatchCandidates","__pipelineWatch"):
    if marker not in old_merge: raise SystemExit("V21.1 REFUSED: old Terminal merge shape: "+marker)

new_merge=r"""// MEMEFLOW_TERMINAL_CANONICAL_CANDIDATE_FEED_V21
// One candidate authority. No client-side WAITING -> WATCH mutation.
function mergedCandidates() {
  const byMint=new Map(
    (Array.isArray(state.candidates)?state.candidates:[])
      .filter(candidate=>candidate?.mint)
      .map(candidate=>[String(candidate.mint),candidate])
  );

  const pinned=[];
  for(const position of state.positions||[]){
    if(!position?.mint||String(position.status||'').toUpperCase()!=='OPEN')continue;
    const mint=String(position.mint);
    const existing=byMint.get(mint);
    if(existing){
      pinned.push({
        ...existing,
        strategySource:position.strategySource||existing.strategySource||null,
        copyTradingWallet:position.copyTradingWallet||existing.copyTradingWallet||null,
        __openPosition:position
      });
      byMint.delete(mint);
    }else{
      pinned.push(positionAsCandidate(position));
    }
  }
  return [...pinned,...byMint.values()];
}

"""
tr=tr[:mstart]+new_merge+tr[mend:]

lstart=tr.find("async function loadCandidates({ redrawChart = true } = {}) {")
lend=tr.find("function selectCandidate(mint) {",lstart)
if lstart<0 or lend<=lstart: raise SystemExit("V21.1 REFUSED: loadCandidates boundaries")
old_load=tr[lstart:lend]
for marker in (
 "api('/api/ai/decisions?scope=all&limit=100')",
 "api('/api/system/live-token-states?limit=200')",
 "MEMEFLOW_TERMINAL_WATCH_RESILIENT_V30"
):
    if marker not in old_load: raise SystemExit("V21.1 REFUSED: old Terminal load shape: "+marker)

new_load=r"""async function loadCandidates({ redrawChart = true } = {}) {
  // MEMEFLOW_TERMINAL_ONE_MECHANISM_V21
  const payload=await api('/api/system/live-token-states?limit=200');
  const allowedStates=new Set(['BUY READY','WATCH','WAITING']);

  state.candidates=
    (Array.isArray(payload?.decisions)?payload.decisions:[])
      .filter(item=>{
        if(!item?.mint)return false;
        return allowedStates.has(String(item?.state||'').trim().toUpperCase());
      });

  state.liveWatchCandidates=[];

  const rows=mergedCandidates();
  $('candidateCount').textContent=`${rows.length} candidates`;

  if(!state.selectedMint&&rows.length){
    const ready=rows.find(item=>String(item?.state||'').toUpperCase()==='BUY READY');
    const watch=rows.find(item=>String(item?.state||'').toUpperCase()==='WATCH');
    state.selectedMint=(ready||watch||rows[0]).mint;
  }

  if(state.selectedMint){
    const current=rows.find(item=>item.mint===state.selectedMint);
    if(current)state.selected=current;
  }

  syncSelectedCandidate();
  updateCandidateCount();
  renderCandidates();
  renderSelected({redrawChart});
}

"""
tr=tr[:lstart]+new_load+tr[lend:]

tr=tr.replace(
 "    const confidence = finite(proposal.decisionConfidence) ? `${fmt(proposal.decisionConfidence, 0)}%` : '—';\n",
 "",
 1
)
tr=tr.replace(
 """          <span><b>SCORE</b><strong>${score}</strong></span>
          <span><b>CONF</b><strong>${confidence}</strong></span>
""",
 """          <span><b>SCORE</b><strong>${score}</strong></span>
""",
 1
)
TRADING.write_text(tr,encoding="utf-8")

sz=SIZE.read_text(encoding="utf-8")
sz=once(
 sz,
 """  const score = clamp(finite(decision.score) ?? 0, 0, 100);
  const confidence = clamp(finite(decision.confidence) ?? finite(decision.dataConfidence) ?? 0, 0, 100);

  // Quality is deterministic: 60% MEMEFLOW score, 40% data confidence.
  const quality = 0.60 * (score / 100) + 0.40 * (confidence / 100);

  let qualityMultiplier;
  let qualityTier;
  if (quality >= 0.90) {
""",
 """  const score = clamp(finite(decision.score) ?? 0, 0, 100);
  const dataCompleteness = clamp(
    finite(decision.dataCompleteness) ??
    finite(decision.confidence) ??
    finite(decision.dataConfidence) ??
    0,
    0,
    100
  );

  // MEMEFLOW_ADAPTIVE_CANONICAL_SCORE_V21
  // Canonical Score selects the tier. Evidence can only reduce exposure.
  const quality = score / 100;

  let qualityMultiplier;
  let qualityTier;
  if (quality >= 0.90) {
""",
 "adaptive blended score"
)

sz=once(
 sz,
 """  const reasons = [
    `${qualityTier} deterministic quality (${Math.round(quality * 100)}/100)`
  ];

  let riskMultiplier = 1;
""",
 """  const reasons = [
    `${qualityTier} canonical Score (${Math.round(score)}/100)`
  ];

  const evidenceMultiplier=
    dataCompleteness>=90 ? 1 :
    dataCompleteness>=80 ? 0.90 :
    dataCompleteness>=70 ? 0.75 : 0.60;

  if(evidenceMultiplier<1){
    reasons.push(`Data completeness ${Math.round(dataCompleteness)}% reduces position size`);
  }

  let riskMultiplier = evidenceMultiplier;
""",
 "adaptive evidence cap"
)

sz=once(
 sz,
 "qualityScore: Math.round(quality * 100),",
 """// Compatibility alias: exactly canonical Score.
    qualityScore: Math.round(score),
    canonicalScore: Math.round(score),""",
 "adaptive returned score alias"
)
sz=once(
 sz,
 """      score,
      confidence,
""",
 """      score,
      dataCompleteness,
""",
 "adaptive components"
)
SIZE.write_text(sz,encoding="utf-8")

oa=OPENAI.read_text(encoding="utf-8")
oa=once(
 oa,
 """    out.aiScore=clamp(out.aiScore,0,100);out.confidence=clamp(out.confidence,0,100);
    out.suggestedPositionSol=Math.max(0,Number(out.suggestedPositionSol)||0);
    out.model=body.model;out.responseId=data?.id||null;out.generatedAt=now();return out;
""",
 """    // MEMEFLOW_OPENAI_CANONICAL_SCORE_V21
    const canonicalScore=Number(snapshot?.ruleDecision?.score);
    out.aiScore=Number.isFinite(canonicalScore)
      ?Math.max(0,Math.min(100,Math.round(canonicalScore)))
      :null;
    out.scoreAuthority='evaluate';
    out.confidence=clamp(out.confidence,0,100);
    out.suggestedPositionSol=Math.max(0,Number(out.suggestedPositionSol)||0);
    out.model=body.model;out.responseId=data?.id||null;out.generatedAt=now();return out;
""",
 "OpenAI canonical score"
)
oa=oa.replace(
 "        'Missing evidence must reduce confidence.'",
 """        'Missing evidence must reduce confidence.',
        'Never recalculate MEMEFLOW Score. ruleDecision.score is the only Score authority.'""",
 1
)
oa=once(
 oa,
 "        qualityScore:t.qualityScore??null,opportunityScore:t.opportunityScore??null,uniqueBuyers:t.uniqueBuyers??null,netFlowSol:t.netFlowSol??null,recentNetFlowSol:t.recentNetFlowSol??null,\n",
 "        uniqueBuyers:t.uniqueBuyers??null,netFlowSol:t.netFlowSol??null,recentNetFlowSol:t.recentNetFlowSol??null,\n",
 "OpenAI private score context"
)
OPENAI.write_text(oa,encoding="utf-8")

game=GAME.read_text(encoding="utf-8")
game=once(game,"score: finite(decision?.score ?? decision?.aiScore),","score: finite(decision?.score),","Game view score")
game=once(
 game,
 "      const score = finite(decision?.score ?? decision?.aiScore ?? decision?.priority) ?? 0;",
 """      const score=finite(decision?.score);
      if(score===null)continue;""",
 "Game selector score"
)
GAME.write_text(game,encoding="utf-8")

settings=SETTINGS.read_text(encoding="utf-8")
settings=settings.replace("Minimum AI score must be between 0 and 100.","Minimum Score must be between 0 and 100.")
settings=settings.replace("Minimum confidence must be between 0 and 100.","Minimum data completeness must be between 0 and 100.")
SETTINGS.write_text(settings,encoding="utf-8")

sys=SYSTEM.read_text(encoding="utf-8")
sys=sys.replace("['AI score', d.score ?? '—']","['Score', d.score ?? '—']",1)
sys=sys.replace("['minScore', 'Minimum AI score'","['minScore', 'Minimum Score'",1)
sys=sys.replace("['minConfidence', 'Minimum confidence %'","['minConfidence', 'Minimum data completeness %'",1)
SYSTEM.write_text(sys,encoding="utf-8")

sp=SETTINGSPAGE.read_text(encoding="utf-8")
sp=sp.replace("['minScore', 'Minimum AI score'","['minScore', 'Minimum Score'",1)
sp=sp.replace("['minConfidence', 'Minimum confidence %'","['minConfidence', 'Minimum data completeness %'",1)
SETTINGSPAGE.write_text(sp,encoding="utf-8")

idx=INDEX.read_text(encoding="utf-8")
idx=idx.replace(">AI SCORE<",">SCORE<")
idx=idx.replace("Minimum AI score","Minimum Score")
idx=idx.replace("AI score/confidence","Score/data completeness")
idx=idx.replace("Minimum confidence","Minimum data completeness")
idx=idx.replace(
 '<small>Confidence</small><b id="primaryConfidence">—</b>',
 '<small>Data completeness</small><b id="primaryConfidence">—</b>',
 1
)
idx=idx.replace(
 "minConfidence:'Minimum 0–100 evidence confidence required for BUY READY. Missing evidence can keep a token in WAITING.'",
 "minConfidence:'Minimum 0–100 data completeness required for BUY READY. Missing evidence can keep a token in WAITING.'",
 1
)
INDEX.write_text(idx,encoding="utf-8")

print("V21_TRANSFORM_OK")
PY

cat > "$FEEDTEST" <<'EOF_FEEDTEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  candidateRelevanceScore,
  rankCandidateViews,
  candidateStatePriority
} from '../src/feed-ranking.mjs';

const high={mint:'High',state:'WAITING',score:82,transactions5m:2,volume5mUsd:50,marketCapUsd:4000,holderCount:10,quoteAgeMs:1000};
const lowButMoving={mint:'LowMoving',state:'WATCH',score:61,transactions5m:200,volume5mUsd:50000,marketCapUsd:50000,holderCount:300,quoteAgeMs:100};

const rankedSameLane=rankCandidateViews([lowButMoving,high]);
assert.equal(rankedSameLane[0].mint,'High');
assert.equal(rankedSameLane[0].score,82);
assert.equal(rankedSameLane[0].decisionScore,82);
assert.equal(candidateRelevanceScore(high),82);
assert.equal('feedScore' in rankedSameLane[0],false);
assert.equal('relevanceScore' in rankedSameLane[0],false);

const unknown=rankCandidateViews([{mint:'Unknown',state:'WAITING',score:null}])[0];
assert.equal(unknown.score,null);
assert.equal(unknown.decisionScore,null);

const ready={...lowButMoving,mint:'Ready',state:'BUY READY',score:55};
const blocked={...high,mint:'Blocked',state:'BLOCKED',score:99};
const order=rankCandidateViews([blocked,high,ready]);
assert.equal(order[0].mint,'Ready');
assert.equal(order.at(-1).mint,'Blocked');

assert.ok(candidateStatePriority('OPEN POSITION')>candidateStatePriority('BUY READY'));
assert.ok(candidateStatePriority('BUY READY')>candidateStatePriority('WATCH'));
assert.equal(candidateStatePriority('WATCH'),candidateStatePriority('WAITING'));
assert.ok(candidateStatePriority('WAITING')>candidateStatePriority('BLOCKED'));

const src=fs.readFileSync(new URL('../src/feed-ranking.mjs',import.meta.url),'utf8');
assert.match(src,/MEMEFLOW_UNIFIED_SCORE_RANKING_V21/);
assert.doesNotMatch(src,/feedScore:/);
assert.doesNotMatch(src,/relevanceScore:/);
assert.doesNotMatch(src,/opportunityScore/);
assert.doesNotMatch(src,/qualityScore/);

console.log('unified canonical score ranking v21 ok');
EOF_FEEDTEST

cat > "$TERMINALTEST" <<'EOF_TERMINAL'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.resolve(here,'../trading.js'),'utf8');

assert.match(source,/MEMEFLOW_TERMINAL_CANONICAL_CANDIDATE_FEED_V21/);
assert.match(source,/MEMEFLOW_TERMINAL_ONE_MECHANISM_V21/);
assert.doesNotMatch(source,/MEMEFLOW_TERMINAL_WATCH_DUPLICATE_MERGE_V37/);

const loadStart=source.indexOf('async function loadCandidates({ redrawChart = true } = {}) {');
const selectStart=source.indexOf('function selectCandidate(mint) {',loadStart);
const loadBlock=source.slice(loadStart,selectStart);

assert.match(loadBlock,/api\('\/api\/system\/live-token-states\?limit=200'\)/);
assert.doesNotMatch(loadBlock,/\/api\/ai\/decisions/);
assert.doesNotMatch(loadBlock,/__pipelineWatch/);

const mergedStart=source.indexOf('function mergedCandidates() {');
const displayStart=source.indexOf('function displayStateForCandidate(candidate) {',mergedStart);
const code=source.slice(mergedStart,displayStart);

const context={
  state:{
    candidates:[
      {mint:'Waiting',state:'WAITING',score:91,tradeEligible:false},
      {mint:'Watch',state:'WATCH',score:72,tradeEligible:false},
      {mint:'Ready',state:'BUY READY',score:88,tradeEligible:true}
    ],
    positions:[]
  },
  positionAsCandidate(position){return {...position,state:'OPEN POSITION'};},
  result:null
};

vm.createContext(context);
vm.runInContext(`${code}\nresult=mergedCandidates();`,context);

assert.equal(context.result.length,3);
assert.equal(context.result.find(x=>x.mint==='Waiting').state,'WAITING');
assert.equal(context.result.find(x=>x.mint==='Waiting').score,91);

console.log('terminal canonical candidate feed v21 ok');
EOF_TERMINAL

python3 - <<'PY'
from pathlib import Path
p=Path("memeflow-app/tests/opportunity-engine.mjs")
t=p.read_text(encoding="utf-8")
old="""const decision=evaluate(liveToken,allSettings);
assert.equal(decision.state,'BUY READY');
assert.ok(decision.qualityScore>=70);
assert.ok(decision.opportunityScore>=60);
"""
new="""const decision=evaluate(liveToken,allSettings);
assert.equal(decision.state,'BUY READY');
assert.ok(Number.isFinite(decision.score));
assert.equal(decision.scoreAuthority,'evaluate');
assert.equal('qualityScore' in decision,false);
assert.equal('opportunityScore' in decision,false);
"""
if old not in t: raise SystemExit("V21.1 REFUSED: opportunity-engine assertion anchor missing")
p.write_text(t.replace(old,new,1),encoding="utf-8")

p=Path("memeflow-app/tests/adaptive-position-sizing.mjs")
t=p.read_text(encoding="utf-8")
old="""assert.equal(qualified.ok, true);
assert(qualified.amountSol > 0);
"""
new="""assert.equal(qualified.ok, true);
assert.equal(qualified.qualityScore,76);
assert.equal(qualified.canonicalScore,76);
assert.equal(qualified.components.score,76);
assert.equal(qualified.components.dataCompleteness,80);
assert(qualified.amountSol > 0);
"""
if old not in t: raise SystemExit("V21.1 REFUSED: adaptive assertion anchor missing")
p.write_text(t.replace(old,new,1),encoding="utf-8")
PY

cat > "$OLDTEST" <<'EOF_OLDTEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rankCandidateViews} from '../src/feed-ranking.mjs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const rankSource=fs.readFileSync(new URL('../src/feed-ranking.mjs',import.meta.url),'utf8');

const row=rankCandidateViews([{mint:'Canonical71',state:'WAITING',score:71,transactions5m:100}])[0];
assert.equal(row.score,71);
assert.equal(row.decisionScore,71);
assert.equal('feedScore' in row,false);
assert.equal('relevanceScore' in row,false);
assert.match(rankSource,/MEMEFLOW_UNIFIED_SCORE_RANKING_V21/);

const ds=app.indexOf('// MEMEFLOW_CANONICAL_LIVE_DECISION_V20_8_8');
const de=app.indexOf('function __mfLiveCardViewV14(',ds);
const decision=app.slice(ds,de);
assert.ok(ds>=0&&de>ds);
assert.match(decision,/fresh=evaluate\(token,settings\)/);
assert.match(decision,/MEMEFLOW_TRADE_ELIGIBLE_CANONICAL_STATE_V21/);
assert.doesNotMatch(decision,/previewScore/);
assert.doesNotMatch(decision,/score:0/);

const is=ui.indexOf('function __mfInvalidateDynamicRowV20_2(');
const ie=ui.indexOf('function __mfMergeMutableRowV18(',is);
const inv=ui.slice(is,ie);
assert.match(inv,/score:null/);
assert.doesNotMatch(inv,/score:0/);
assert.match(ui,/MEMEFLOW_SMART_CANONICAL_SCORE_RANK_V21/);
assert.doesNotMatch(ui,/a\?\.feedScore\?\?a\?\.relevanceScore/);

console.log('CANONICAL_LIVE_SCORE_PIPELINE_V21_OK');
EOF_OLDTEST

cat > "$NEWTEST" <<'EOF_NEWTEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluate} from '../src/evaluate.mjs';
import {evaluateToken} from '../src/evaluator.mjs';
import {rankCandidateViews} from '../src/feed-ranking.mjs';
import {calculateAdaptivePositionSize} from '../src/adaptive-position-sizing.mjs';

const base={
  mint:'Unified11111111111111111111111111111111',
  launchPlatform:'pump',
  priceSol:0.00001,
  holderCount:120,
  top10Pct:15,
  developerPct:3,
  buyPressure:2,
  holderFresh:true,
  qualityScore:80,
  opportunityScore:70,
  opportunityEvidenceReady:true,
  opportunityTrendHealthy:true,
  opportunityEventCount:12
};
const settings={minScore:0,minConfidence:0,minBuyPressure:0,minHolders:0,maxTop10Pct:100,maxDeveloperPct:100};

const d=evaluate(base,settings);
assert.equal(d.analysisVersion,'MEMEFLOW_UNIFIED_ANALYSIS_V21');
assert.equal(d.scoreAuthority,'evaluate');
assert.equal(d.score,76);
assert.equal(d.dataCompleteness,d.confidence);
assert.equal('qualityScore' in d,false);
assert.equal('opportunityScore' in d,false);
assert.equal('opportunityFloor' in d,false);
assert.equal(d.settingsEvaluation.gates.some(g=>g.name==='Opportunity safety floor'),false);

const ranked=rankCandidateViews([
  {mint:'A',state:'WAITING',score:null,transactions5m:999},
  {mint:'B',state:'WATCH',score:76,transactions5m:1}
]);
assert.equal(ranked[0].mint,'B');
assert.equal(ranked[0].score,76);
assert.equal('feedScore' in ranked[0],false);
assert.equal(ranked[1].score,null);

const legacy=evaluateToken({...base,holders:120,top10:15,developer:3,holdersFresh:true},settings);
assert.equal(legacy.scoreAuthority,'evaluate');
assert.equal(legacy.score,d.score);

const sized=calculateAdaptivePositionSize({
  token:{...base,liquidityUsd:5000},
  decision:{score:76,confidence:80,dataCompleteness:80},
  settings:{positionSize:1,maxPositionSize:1,maxTop10Pct:25,maxDeveloperPct:20,minBuyPressure:1.2,minLiquidityUsd:1000,minHolders:30}
});
assert.equal(sized.qualityScore,76);
assert.equal(sized.canonicalScore,76);

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const tokenUi=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const trading=fs.readFileSync(new URL('../trading.js',import.meta.url),'utf8');
const game=fs.readFileSync(new URL('../src/game-engine.mjs',import.meta.url),'utf8');
const openai=fs.readFileSync(new URL('../src/openai-intelligence.mjs',import.meta.url),'utf8');

assert.match(app,/MEMEFLOW_TRADE_ELIGIBLE_CANONICAL_STATE_V21/);
assert.match(app,/String\(decision\?\.state\|\|''\)\.toUpperCase\(\)==='BUY READY'/);

const liveDecisionStart=app.indexOf('function __mfLiveDecisionForUserV14(');
const liveViewStart=app.indexOf('function __mfLiveCardViewV14(',liveDecisionStart);
const liveDecision=app.slice(liveDecisionStart,liveViewStart);
assert.match(liveDecision,/toUpperCase\(\)!=='BLOCKED'/);

assert.match(tokenUi,/MEMEFLOW_SMART_CANONICAL_SCORE_RANK_V21/);
assert.doesNotMatch(tokenUi,/a\?\.feedScore\?\?a\?\.relevanceScore/);

const loadStart=trading.indexOf('async function loadCandidates({ redrawChart = true } = {}) {');
const selectStart=trading.indexOf('function selectCandidate(mint) {',loadStart);
const load=trading.slice(loadStart,selectStart);
assert.match(load,/\/api\/system\/live-token-states\?limit=200/);
assert.doesNotMatch(load,/\/api\/ai\/decisions/);
assert.doesNotMatch(trading,/MEMEFLOW_TERMINAL_WATCH_DUPLICATE_MERGE_V37/);

assert.doesNotMatch(game,/decision\?\.aiScore/);
assert.doesNotMatch(game,/decision\?\.priority/);
assert.match(openai,/MEMEFLOW_OPENAI_CANONICAL_SCORE_V21/);
assert.match(openai,/out\.scoreAuthority='evaluate'/);

console.log('UNIFIED_ANALYSIS_ENGINE_V21_OK');
EOF_NEWTEST

python3 - <<'PY'
from pathlib import Path
import re
updates={
 "memeflow-app/system-tokens.html":(r'/system-tokens\.js\?v=[^"]+','/system-tokens.js?v=unified-analysis-v21-20260903'),
 "memeflow-app/trading.html":(r'/trading\.js\?v=[^"]+','/trading.js?v=unified-analysis-v21-20260903'),
 "memeflow-app/system.html":(r'/system\.js\?v=[^"]+','/system.js?v=unified-analysis-v21-20260903'),
 "memeflow-app/settings.html":(r'/settings-page\.js\?v=[^"]+','/settings-page.js?v=unified-analysis-v21-20260903')
}
for file,(pattern,replacement) in updates.items():
    p=Path(file)
    t=p.read_text(encoding="utf-8")
    t,n=re.subn(pattern,replacement,t,count=1)
    if n!=1: raise SystemExit(f"V21.1 REFUSED: asset update {file}: {n}")
    p.write_text(t,encoding="utf-8")
print("ASSET_VERSIONS_OK")
PY

echo
echo "=== V21.1 REGRESSION CONTRACT PRECHECK ==="
if grep -n "feedScore: relevanceScore" "$RANK"; then echo "ERROR: feed score remains"; exit 1; fi
if grep -n "score: liveCandidate" "$RANK"; then echo "ERROR: ranking overwrites Score"; exit 1; fi
if grep -n "a?.feedScore??a?.relevanceScore" "$TOKENS"; then echo "ERROR: frontend feed rank remains"; exit 1; fi
if grep -n "/api/ai/decisions?scope=all&limit=100" "$TRADING"; then echo "ERROR: Terminal second feed remains"; exit 1; fi
if grep -n "MEMEFLOW_TERMINAL_WATCH_DUPLICATE_MERGE_V37" "$TRADING"; then echo "ERROR: Terminal state override remains"; exit 1; fi
if grep -n "decision?.score ?? decision?.aiScore" "$GAME"; then echo "ERROR: Game alternate score remains"; exit 1; fi
if grep -n "Opportunity safety floor" "$EVAL"; then echo "ERROR: opportunity score gate remains"; exit 1; fi
echo "REGRESSION_CONTRACTS_OK"

echo
echo "=== V21.1 SYNTAX ==="
for f in \
 "$EVAL" "$RANK" "$LEGACY" "$SIZE" "$OPENAI" "$GAME" "$APP" \
 "$TOKENS" "$TRADING" "$SYSTEM" "$SETTINGSPAGE" \
 "$FEEDTEST" "$OPPTEST" "$ADAPTTEST" "$TERMINALTEST" "$OLDTEST" "$NEWTEST"
do
  node --check "$f"
done
echo "SYNTAX_OK"

echo
echo "=== V21.1 TARGETED TESTS ==="
(
 cd memeflow-app
 node tests/unified-analysis-engine-v21.mjs
 node tests/feed-ranking.mjs
 node tests/opportunity-engine.mjs
 node tests/adaptive-position-sizing.mjs
 node tests/terminal-watch-merge-v37.mjs
 node tests/canonical-live-score-pipeline-v20_8_8.mjs
 node tests/canonical-score-state-v20_7.mjs
 node tests/card-details-live-authority-v20_5.mjs
 node tests/settings-gate.mjs
 node tests/per-mint-card-refresh-v18.mjs
 node tests/live-ranking-reorder-v23.mjs
)
echo "TARGETED_TESTS_OK"

echo
echo "=== V21.1 FULL PROJECT TEST SUITE ==="
(
 cd memeflow-app
 npm test
)
echo "FULL_TEST_SUITE_OK"

echo
echo "=== V21.1 STATIC WHOLE-PROJECT AUDIT ==="
python3 - <<'PY'
from pathlib import Path
app=Path("memeflow-app/app-server.mjs").read_text()
rank=Path("memeflow-app/src/feed-ranking.mjs").read_text()
trading=Path("memeflow-app/trading.js").read_text()
ui=Path("memeflow-app/system-tokens.js").read_text()
game=Path("memeflow-app/src/game-engine.mjs").read_text()
legacy=Path("memeflow-app/src/evaluator.mjs").read_text()
errors=[]
if "MEMEFLOW_UNIFIED_ANALYSIS_ENGINE_V21" not in Path("memeflow-app/src/evaluate.mjs").read_text(): errors.append("canonical evaluate marker missing")
if "feedScore:" in rank or "relevanceScore:" in rank: errors.append("ranker emits another score")
if "/api/ai/decisions?scope=all&limit=100" in trading: errors.append("Terminal second decision feed remains")
if "MEMEFLOW_TERMINAL_WATCH_DUPLICATE_MERGE_V37" in trading: errors.append("Terminal state override remains")
if "a?.feedScore??a?.relevanceScore" in ui: errors.append("Token Flow hidden score remains")
if "decision?.aiScore" in game or "decision?.priority" in game: errors.append("Game alternate score fallback remains")
if "MEMEFLOW_LEGACY_EVALUATOR_ADAPTER_V21" not in legacy: errors.append("legacy evaluator not delegated")
if "MEMEFLOW_TRADE_ELIGIBLE_CANONICAL_STATE_V21" not in app: errors.append("tradeEligible canonical-state guard missing")
asset_checks={
 "memeflow-app/system-tokens.html":"system-tokens.js?v=unified-analysis-v21-20260903",
 "memeflow-app/trading.html":"trading.js?v=unified-analysis-v21-20260903",
 "memeflow-app/system.html":"system.js?v=unified-analysis-v21-20260903",
 "memeflow-app/settings.html":"settings-page.js?v=unified-analysis-v21-20260903"
}
for file,marker in asset_checks.items():
    if marker not in Path(file).read_text(): errors.append(f"asset version missing: {file}")
if errors: raise SystemExit("WHOLE_PROJECT_AUDIT_FAILED:\n- "+"\n- ".join(errors))
print("WHOLE_PROJECT_AUDIT_OK")
PY

git diff --check -- "${FILES[@]}" "$NEWTEST"

echo
echo "=== V21 DIFF ==="
git diff --stat -- "${FILES[@]}" "$NEWTEST"

git reset >/dev/null
git add "${FILES[@]}" "$NEWTEST"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|system-tokens\.js|trading\.js|system\.js|settings-page\.js|index\.html|system-tokens\.html|trading\.html|system\.html|settings\.html|src/evaluate\.mjs|src/feed-ranking\.mjs|src/evaluator\.mjs|src/adaptive-position-sizing\.mjs|src/openai-intelligence\.mjs|src/game-engine\.mjs|src/settings\.mjs|tests/feed-ranking\.mjs|tests/opportunity-engine\.mjs|tests/adaptive-position-sizing\.mjs|tests/terminal-watch-merge-v37\.mjs|tests/canonical-live-score-pipeline-v20_8_8\.mjs|tests/unified-analysis-engine-v21\.mjs)$'
BAD="$(git diff --cached --name-only | grep -Ev "$ALLOWED_RE" || true)"
if [[ -n "$BAD" ]]; then
  echo "ERROR: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check
echo
echo "=== V21 STAGED ==="
git diff --cached --stat

git commit -m "refactor: unify MEMEFLOW analysis into one score engine v21.1"
git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline
echo
echo "UNIFIED CONTRACT:"
echo "  Scanner            = facts only"
echo "  Opportunity engine = private signals only"
echo "  evaluate()          = ONE Score + ONE State authority"
echo "  Entry/Live/Risk     = readiness gates, never alternate scores"
echo "  Ranking             = canonical Score + factual tie-breakers"
echo "  Terminal/Token Flow = same canonical live decision feed"
echo "  Game/OpenAI/Sizing  = canonical Score only"
