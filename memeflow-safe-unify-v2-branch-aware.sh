#!/usr/bin/env bash
set -Eeuo pipefail

EXPECTED_HEAD="e10faf50771ea6761bbf9e52c4909eb60a15cabe"
PATCH_NAME="MEMEFLOW_SAFE_UNIFY_V2_BRANCH_AWARE"

log(){ printf '[PATCH] %s\n' "$*"; }
die(){ log "STOP: $*"; exit 1; }

# Locate project root without assuming Replit layout.
if [[ -f "src/evaluate.mjs" && -f "app-server.mjs" ]]; then
  ROOT="."
elif [[ -f "memeflow-app/src/evaluate.mjs" && -f "memeflow-app/app-server.mjs" ]]; then
  ROOT="memeflow-app"
else
  die "Cannot find MEMEFLOW app root (expected src/evaluate.mjs + app-server.mjs)."
fi

cd "$ROOT"

log "Preflight..."
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside a git worktree."

HEAD_NOW="$(git rev-parse HEAD)"
if [[ "$HEAD_NOW" != "$EXPECTED_HEAD" ]]; then
  die "This patch is built for HEAD $EXPECTED_HEAD, but current HEAD is $HEAD_NOW. Nothing changed."
fi

TARGETS=(
  "src/evaluate.mjs"
  "src/candidate-visibility.mjs"
  "src/openai-intelligence.mjs"
  "app-server.mjs"
)

for f in "${TARGETS[@]}"; do
  [[ -f "$f" ]] || die "Missing target file: $f"
  git diff --quiet -- "$f" || die "$f has unstaged local changes. Nothing changed."
  git diff --cached --quiet -- "$f" || die "$f has staged local changes. Nothing changed."
done

TEST_FILE="src/candidate-visibility-lifecycle.test.mjs"
if [[ -e "$TEST_FILE" ]]; then
  die "$TEST_FILE already exists; refusing to overwrite it."
fi

BACKUP=".memeflow-safe-unify-v2-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/src"
cp src/evaluate.mjs "$BACKUP/src/evaluate.mjs"
cp src/candidate-visibility.mjs "$BACKUP/src/candidate-visibility.mjs"
cp src/openai-intelligence.mjs "$BACKUP/src/openai-intelligence.mjs"
cp app-server.mjs "$BACKUP/app-server.mjs"

rollback(){
  local code=$?
  log "Validation failed; restoring originals..."
  cp "$BACKUP/src/evaluate.mjs" src/evaluate.mjs || true
  cp "$BACKUP/src/candidate-visibility.mjs" src/candidate-visibility.mjs || true
  cp "$BACKUP/src/openai-intelligence.mjs" src/openai-intelligence.mjs || true
  cp "$BACKUP/app-server.mjs" app-server.mjs || true
  rm -f "$TEST_FILE"
  log "Rollback complete. Backup kept at $BACKUP"
  exit "$code"
}
trap rollback ERR INT TERM

log "Applying branch-aware changes..."

python3 - <<'PY'
from pathlib import Path
import re

# 1) Candidate feed lifecycle:
#    This runs only when the feed API is read. It does NOT enter discovery,
#    enrichment, evaluation, holder RPC, market RPC, or execution hot paths.
candidate = Path("src/candidate-visibility.mjs")
candidate.write_text(r"""const terminalStates=new Set(['EXPIRED','BLOCKED','REJECTED','CLOSED','IGNORED']);

const FILTERED_LIVE_TTL_MS=Math.max(
  60000,
  Number(process.env.MEMEFLOW_FILTERED_LIVE_TTL_MS||15*60*1000)
);
const WAITING_LIVE_TTL_MS=Math.max(
  FILTERED_LIVE_TTL_MS,
  Number(process.env.MEMEFLOW_WAITING_LIVE_TTL_MS||60*60*1000)
);

function tsMs(v){
  if(v===null||v===undefined||v==='')return null;
  if(typeof v==='number'&&Number.isFinite(v))return v<1e12?v*1000:v;
  const n=Number(v);
  if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;
  const d=Date.parse(String(v));
  return Number.isFinite(d)?d:null;
}

function tokenActivityAt(token={},decision={}){
  // Intentionally DO NOT use token.updatedAt first:
  // metadata/diagnostic refreshes must not keep a dead market token "live".
  for(const v of [
    token.lastMarketActivityAt,
    token.lastPriceChangeAt,
    token.lastPriceAt,
    token.discoveredAt,
    token.createdAt,
    token.firstSeenAt,
    decision.createdAt,
    decision.updatedAt
  ]){
    const ms=tsMs(v);
    if(ms!==null)return ms;
  }
  return null;
}

export function isDecisionArchived(decision={},token=null,now=Date.now()){
  if(!token||typeof token!=='object')return false;

  const state=String(decision.state||'WAITING').trim().toUpperCase();
  if(state==='BUY READY'||state==='WATCH')return false;

  const activity=tokenActivityAt(token,decision);
  if(activity===null)return false;

  const idle=Math.max(0,Number(now)-activity);

  if(state==='WAITING'){
    return idle>=WAITING_LIVE_TTL_MS;
  }

  if(terminalStates.has(state)||decision.terminal===true){
    return idle>=FILTERED_LIVE_TTL_MS;
  }

  return false;
}

export function classifyDecisionVisibility(decision={},token=null,now=Date.now()){
  if(isDecisionArchived(decision,token,now))return 'archived';

  const state=String(decision.state||'WAITING').trim().toUpperCase();
  const closed=decision.terminal===true||
    String(decision.lifecycle||'').toLowerCase()==='closed'||
    terminalStates.has(state);

  if(state==='BUY READY'&&!closed)return 'candidate';
  if(state==='WAITING'&&!closed)return 'processing';
  return 'filtered';
}

function lookupToken(tokenLookup,mint){
  if(typeof tokenLookup==='function')return tokenLookup(mint)||null;
  if(tokenLookup&&typeof tokenLookup==='object')return tokenLookup[mint]||null;
  return null;
}

export function candidateFeed(decisions=[],scope='candidates',tokenLookup=null,now=Date.now()){
  const rows=Array.isArray(decisions)?decisions.filter(Boolean):[];
  const normalized=String(scope||'candidates').trim().toLowerCase();
  const kindOf=(row)=>classifyDecisionVisibility(
    row,
    lookupToken(tokenLookup,row?.mint),
    now
  );

  // "all" means the current LIVE surface, not historical audit.
  // Historical rows remain available through scope=audit / scope=archived.
  if(normalized==='audit')return rows;
  if(normalized==='archived')return rows.filter(x=>kindOf(x)==='archived');
  if(normalized==='all')return rows.filter(x=>kindOf(x)!=='archived');
  if(normalized==='processing')return rows.filter(x=>kindOf(x)==='processing');
  if(normalized==='filtered')return rows.filter(x=>kindOf(x)==='filtered');

  return rows.filter(x=>kindOf(x)==='candidate');
}

export function candidateVisibilityCounts(decisions=[],tokenLookup=null,now=Date.now()){
  const counts={
    candidates:0,
    processing:0,
    filtered:0,
    archived:0,
    visible:0,
    totalEvaluated:0
  };

  for(const row of Array.isArray(decisions)?decisions:[]){
    if(!row)continue;
    counts.totalEvaluated++;

    const kind=classifyDecisionVisibility(
      row,
      lookupToken(tokenLookup,row?.mint),
      now
    );

    if(kind==='archived'){
      counts.archived++;
      continue;
    }

    counts.visible++;
    if(kind==='candidate')counts.candidates++;
    else if(kind==='processing')counts.processing++;
    else counts.filtered++;
  }

  return counts;
}
""", encoding="utf-8")

# 2) Wire token lifecycle into the READ-ONLY feed endpoint.
#    Only API rendering is changed; evaluateAI/live discovery is untouched.
server = Path("app-server.mjs")
s = server.read_text(encoding="utf-8")

pattern = re.compile(
    r"(const _all=store\.decisions\(u\.id\);\s*)"
    r"const _selected=candidateFeed\(_all,_scope\);\s*"
    r"const _counts=candidateVisibilityCounts\(_all\);"
)
replacement = (
    r"\1const _tokenLookup=(mint)=>store.state.tokens?.[mint]||null;\n"
    r"  const _selected=candidateFeed(_all,_scope,_tokenLookup);\n"
    r"  const _counts=candidateVisibilityCounts(_all,_tokenLookup);"
)
s2, n = pattern.subn(replacement, s, count=1)
if n != 1:
    raise SystemExit("Could not uniquely patch /api/ai/decisions candidate feed wiring.")
server.write_text(s2, encoding="utf-8")

# 3) Keep OpenAI strategy suggestions proposal-only.
#    Existing saved autoOptimize=true values are forcibly neutralized.
oa = Path("src/openai-intelligence.mjs")
o = oa.read_text(encoding="utf-8")

def once(old, new, label):
    global o
    count=o.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 occurrence, found {count}")
    o=o.replace(old,new,1)

once(
    "enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:true,",
    "enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:false,",
    "OpenAI default autoOptimize"
)
once(
    "u.ai.settings={...aiDefaults(),...(u.ai.settings||{})};",
    "u.ai.settings={...aiDefaults(),...(u.ai.settings||{}),autoOptimize:false};",
    "OpenAI persisted autoOptimize neutralization"
)
once(
    "next={...ai.settings,...(b.settings||{}),updatedAt:now()};",
    "next={...ai.settings,...(b.settings||{}),autoOptimize:false,updatedAt:now()};",
    "OpenAI settings PUT autoOptimize guard"
)
oa.write_text(o, encoding="utf-8")

# 4) Fix evaluator diagnostics only (no filter logic changes).
#    Missing enabled metrics should say "data pending", not "below threshold".
ev = Path("src/evaluate.mjs")
e = ev.read_text(encoding="utf-8")

old = """  const addMin=(name,value,limit,reason,zeroDisables=true)=>{\n    if(!finite(limit))return;const x=Number(limit);if(zeroDisables&&x<=0)return;\n    addGate(name,value===null?null:value>=x,reason,{value,threshold:x,operator:'>='});\n  };\n  const addMax=(name,value,limit,reason)=>{\n    if(!finite(limit))return;const x=Number(limit);\n    addGate(name,value===null?null:value<=x,reason,{value,threshold:x,operator:'<='});\n  };"""
new = """  const addMin=(name,value,limit,reason,zeroDisables=true)=>{\n    if(!finite(limit))return;const x=Number(limit);if(zeroDisables&&x<=0)return;\n    const waitReason=`${name.replace(/^(Minimum|Maximum)\\\\s+/,'')} data pending`;\n    addGate(name,value===null?null:value>=x,value===null?waitReason:reason,{value,threshold:x,operator:'>='});\n  };\n  const addMax=(name,value,limit,reason)=>{\n    if(!finite(limit))return;const x=Number(limit);\n    const waitReason=`${name.replace(/^(Minimum|Maximum)\\\\s+/,'')} data pending`;\n    addGate(name,value===null?null:value<=x,value===null?waitReason:reason,{value,threshold:x,operator:'<='});\n  };"""
if old not in e:
    raise SystemExit("Evaluator helper block differs from audited branch; refusing to patch.")
e=e.replace(old,new,1)

if "`holders above ${s.maxHolders}`" not in e:
    raise SystemExit("Expected maximum-holder diagnostic not found.")
e=e.replace("`holders above ${s.maxHolders}`","`holders above maximum ${s.maxHolders}`",1)

if "'developer wallet is blacklisted'" not in e:
    raise SystemExit("Expected developer-blacklist diagnostic not found.")
e=e.replace("'developer wallet is blacklisted'","'Developer wallet is blacklisted'",1)

ev.write_text(e, encoding="utf-8")

# 5) Focused lifecycle tests.
Path("src/candidate-visibility-lifecycle.test.mjs").write_text(r"""import test from 'node:test';
import assert from 'node:assert/strict';
import {
  candidateFeed,
  candidateVisibilityCounts,
  classifyDecisionVisibility,
  isDecisionArchived
} from './candidate-visibility.mjs';

const NOW=2_000_000_000_000;
const M=60_000;

const decisions=[
  {mint:'blocked-stale',state:'BLOCKED',updatedAt:NOW-1*M},
  {mint:'blocked-live',state:'BLOCKED',updatedAt:NOW-1*M},
  {mint:'waiting-stale',state:'WAITING',updatedAt:NOW-1*M},
  {mint:'buy-stale',state:'BUY READY',updatedAt:NOW-1*M}
];

const tokens={
  'blocked-stale':{lastMarketActivityAt:NOW-16*M,discoveredAt:NOW-20*M},
  'blocked-live':{lastMarketActivityAt:NOW-2*M,discoveredAt:NOW-20*M},
  'waiting-stale':{lastMarketActivityAt:NOW-61*M,discoveredAt:NOW-70*M},
  'buy-stale':{lastMarketActivityAt:NOW-120*M,discoveredAt:NOW-130*M}
};

const lookup=m=>tokens[m];

test('stale BLOCKED leaves live all feed but remains in audit/archive',()=>{
  assert.equal(isDecisionArchived(decisions[0],tokens['blocked-stale'],NOW),true);
  assert.equal(candidateFeed(decisions,'all',lookup,NOW).some(x=>x.mint==='blocked-stale'),false);
  assert.equal(candidateFeed(decisions,'audit',lookup,NOW).some(x=>x.mint==='blocked-stale'),true);
  assert.equal(candidateFeed(decisions,'archived',lookup,NOW).some(x=>x.mint==='blocked-stale'),true);
});

test('recent BLOCKED stays visible as filtered',()=>{
  assert.equal(classifyDecisionVisibility(decisions[1],tokens['blocked-live'],NOW),'filtered');
  assert.equal(candidateFeed(decisions,'all',lookup,NOW).some(x=>x.mint==='blocked-live'),true);
});

test('stuck WAITING archives after one hour',()=>{
  assert.equal(classifyDecisionVisibility(decisions[2],tokens['waiting-stale'],NOW),'archived');
});

test('BUY READY is never archived by inactivity cleanup',()=>{
  assert.equal(classifyDecisionVisibility(decisions[3],tokens['buy-stale'],NOW),'candidate');
});

test('counts separate visible from archived',()=>{
  const c=candidateVisibilityCounts(decisions,lookup,NOW);
  assert.equal(c.totalEvaluated,4);
  assert.equal(c.archived,2);
  assert.equal(c.visible,2);
  assert.equal(c.candidates,1);
  assert.equal(c.filtered,1);
});

test('legacy callers without token lookup preserve old visibility',()=>{
  assert.equal(classifyDecisionVisibility({state:'BLOCKED',mint:'x'}), 'filtered');
});
""", encoding="utf-8")
PY

log "Syntax checks..."
node --check src/evaluate.mjs
node --check src/candidate-visibility.mjs
node --check src/openai-intelligence.mjs
node --check app-server.mjs

log "Focused lifecycle tests..."
node --test src/candidate-visibility-lifecycle.test.mjs

log "Settings/evaluator tests..."
node --test src/filter-upgrade.test.mjs

log "Existing integration suite..."
npm test

# Verify the realtime engine files were not structurally redirected to OpenAI/archive code.
# These are simple guardrails against accidental coupling.
if grep -Eq "await .*openai|await .*archive|await .*candidateFeed" src/liveeval.mjs 2>/dev/null; then
  die "Realtime guardrail detected a new awaited OpenAI/archive/feed dependency in src/liveeval.mjs."
fi

trap - ERR INT TERM

log "SUCCESS."
log "Backup: $BACKUP"
log "What changed:"
log "  • Current branch evaluator/settings architecture kept intact."
log "  • Stale BLOCKED/terminal rows leave LIVE feed after 15 min of no market activity."
log "  • Stuck WAITING leaves LIVE after 60 min."
log "  • BUY READY/WATCH are not auto-archived by this cleanup."
log "  • audit/archived scopes expose stale rows while their decision remains in memory; token state stays persisted separately."
log "  • Cleanup runs only on feed reads — zero new RPC/OpenAI/disk awaits in diagnostics."
log "  • OpenAI Strategy Coach remains available, but autoOptimize is forced OFF."
log "  • Evaluator WAITING diagnostics now say data pending accurately."
log ""
log "Review diff with: git diff -- src/evaluate.mjs src/candidate-visibility.mjs src/openai-intelligence.mjs app-server.mjs src/candidate-visibility-lifecycle.test.mjs"
