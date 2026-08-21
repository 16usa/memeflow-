#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW_UNIFIED_CORE_V1_1"
EXPECTED_HEAD="b4d3d18842191afc3cb87c6737dc86723af4aab0"

log(){ printf '[PATCH] %s\n' "$*"; }
die(){ log "STOP: $*"; exit 1; }

# Replit may start in repository root or directly in memeflow-app.
if [[ -f "app-server.mjs" && -f "src/evaluate.mjs" ]]; then
  ROOT="."
elif [[ -f "memeflow-app/app-server.mjs" && -f "memeflow-app/src/evaluate.mjs" ]]; then
  ROOT="memeflow-app"
else
  die "MEMEFLOW app root not found."
fi

cd "$ROOT"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside the MEMEFLOW git worktree."

HEAD_NOW="$(git rev-parse HEAD)"
[[ "$HEAD_NOW" == "$EXPECTED_HEAD" ]] || \
  die "This patch is built only for $EXPECTED_HEAD. Current HEAD is $HEAD_NOW. Nothing changed."

TARGETS=(
  "src/evaluate.mjs"
  "src/enrich.mjs"
  "src/candidate-visibility.mjs"
  "src/openai-intelligence.mjs"
  "src/store.mjs"
  "src/paper-engine.mjs"
  "src/filter-upgrade.test.mjs"
  "app-server.mjs"
)

for f in "${TARGETS[@]}"; do
  [[ -f "$f" ]] || die "Missing target file: $f"
  git diff --quiet -- "$f" || die "$f has unstaged local changes. Commit/push them first. Nothing changed."
  git diff --cached --quiet -- "$f" || die "$f has staged local changes. Commit/push them first. Nothing changed."
done

# Exact blob guard from commit b4d3d188... . This prevents accidental application
# to a newer or differently generated file even if HEAD somehow matches unexpectedly.
declare -A EXPECTED_BLOB=(
  ["src/evaluate.mjs"]="75b87886049154ddfbcb2f4be68ef597ff6a6e5b"
  ["src/enrich.mjs"]="3689c5f82598bfeb730d3f935a435760364faedb"
  ["src/candidate-visibility.mjs"]="495fa418774fac70d3b595ccad5da90e029099e1"
  ["src/openai-intelligence.mjs"]="9c716b02989c2708d730209cc576d69543205f84"
  ["src/store.mjs"]="d32c7d08b03149485c7e567199094cdcb7709c3f"
  ["src/paper-engine.mjs"]="1d5c7de4d14929b214cdb6ceefae8e419cdc5a4e"
  ["src/filter-upgrade.test.mjs"]="418b58c89e286232d488ad77bb4d58b7e2fffc29"
  ["app-server.mjs"]="b5cad58041c0bdf32f3a7e2fe4f4c592df0cd85d"
)

for f in "${TARGETS[@]}"; do
  actual="$(git hash-object "$f")"
  expected="${EXPECTED_BLOB[$f]}"
  [[ "$actual" == "$expected" ]] || \
    die "$f differs from the audited b4d3d188 baseline (got $actual, expected $expected). Nothing changed."
done

NEW_TESTS=(
  "src/unified-decision.test.mjs"
  "src/candidate-visibility-lifecycle.test.mjs"
  "src/paper-fee-reserve.test.mjs"
  "src/openai-policy.test.mjs"
)
for f in "${NEW_TESTS[@]}"; do
  [[ ! -e "$f" ]] || die "$f already exists. Nothing changed."
done

BACKUP=".memeflow-unified-core-v1-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/src"
for f in "${TARGETS[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  code=$?
  log "Validation failed. Restoring exact pre-patch files..."
  for f in "${TARGETS[@]}"; do
    cp "$BACKUP/$f" "$f" || true
  done
  for f in "${NEW_TESTS[@]}"; do rm -f "$f"; done
  log "ROLLBACK COMPLETE. Backup kept at $BACKUP"
  exit "$code"
}
trap rollback ERR INT TERM

log "Applying $PATCH_NAME to exact commit $EXPECTED_HEAD ..."

python3 - <<'PY'
from pathlib import Path
import re

def replace_once(path, old, new, label):
    p=Path(path)
    s=p.read_text(encoding="utf-8")
    n=s.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected exactly 1 anchor, found {n}")
    p.write_text(s.replace(old,new,1),encoding="utf-8")

def require(path, needle, label):
    s=Path(path).read_text(encoding="utf-8")
    if needle not in s:
        raise SystemExit(f"{label}: compatibility anchor missing")

# ---------------------------------------------------------------------------
# 1) CANONICAL EVALUATOR
#    Known hard fail => BLOCKED.
#    Missing enabled data => WAITING.
#    AI score/data-confidence may not prematurely turn incomplete data into BLOCKED.
# ---------------------------------------------------------------------------
p=Path("src/evaluate.mjs")
s=p.read_text(encoding="utf-8")
if "MEMEFLOW_UNIFIED_DECISION_V1" in s:
    raise SystemExit("evaluate.mjs already contains MEMEFLOW_UNIFIED_DECISION_V1")

s=s.replace(
"// MEMEFLOW_V30_2_CORE_CLEANUP\n// MEMEFLOW_V30_2_CORE_CLEANUP\n",
"// MEMEFLOW_V30_2_CORE_CLEANUP\n// MEMEFLOW_UNIFIED_DECISION_V1_1\n",
1
)

old_meta="""function metadataKnown(t={}){
  return Boolean(t.metadataReady===true||t.metadataFetched===true||t.metadataResolved===true||t.name||t.symbol||t.uri||t.metadataUri);
}"""
new_meta="""function metadataKnown(t={}){
  // A Pump CREATE name/symbol/URI does NOT mean off-chain metadata/socials
  // have already been resolved. Treat social absence as authoritative only
  // after metadata resolution (or when an enriched token has no metadata URI).
  const hasSocial=Boolean(firstText(
    t.twitter,t.twitterUrl,t.x,t.xUrl,
    t.website,t.websiteUrl,t.telegram,t.telegramUrl,
    t.socials?.twitter,t.socials?.x,t.socials?.website,t.socials?.telegram
  ));
  if(hasSocial)return true;
  if(t.metadataReady===true||t.metadataFetched===true||t.metadataResolved===true)return true;
  const hasUri=Boolean(firstText(t.uri,t.metadataUri,t.metadataUrl));
  if(!hasUri&&(t.lastScannedAt||t.dexConfirmed===true))return true;
  return false;
}"""
if old_meta not in s: raise SystemExit("evaluate metadataKnown anchor mismatch")
s=s.replace(old_meta,new_meta,1)

old_helpers="""  const addMin=(name,value,limit,reason,zeroDisables=true)=>{
    if(!finite(limit))return;const x=Number(limit);if(zeroDisables&&x<=0)return;
    addGate(name,value===null?null:value>=x,reason,{value,threshold:x,operator:'>='});
  };
  const addMax=(name,value,limit,reason)=>{
    if(!finite(limit))return;const x=Number(limit);
    addGate(name,value===null?null:value<=x,reason,{value,threshold:x,operator:'<='});
  };"""
new_helpers="""  const addMin=(name,value,limit,reason,zeroDisables=true)=>{
    if(!finite(limit))return;const x=Number(limit);if(zeroDisables&&x<=0)return;
    const pending=`${name.replace(/^(Minimum|Maximum)\\s+/,'')} data pending`;
    addGate(name,value===null?null:value>=x,value===null?pending:reason,{value,threshold:x,operator:'>='});
  };
  const addMax=(name,value,limit,reason)=>{
    if(!finite(limit))return;const x=Number(limit);
    const pending=`${name.replace(/^(Minimum|Maximum)\\s+/,'')} data pending`;
    addGate(name,value===null?null:value<=x,value===null?pending:reason,{value,threshold:x,operator:'<='});
  };"""
if old_helpers not in s: raise SystemExit("evaluate addMin/addMax anchor mismatch")
s=s.replace(old_helpers,new_helpers,1)

replacements=[
("addMax('Maximum holders',v.holders,s.maxHolders,`holders above ${s.maxHolders}`);",
 "addMax('Maximum holders',v.holders,s.maxHolders,`holders above maximum ${s.maxHolders}`);"),
("if(s.requireTwitter===true)addGate('Twitter / X required',known?Boolean(soc.twitter):null,'Twitter / X is required');",
 "if(s.requireTwitter===true)addGate('Twitter / X required',known?Boolean(soc.twitter):null,'Twitter/X required');"),
("if(s.requireWebsite===true)addGate('Website required',known?Boolean(soc.website):null,'website is required');",
 "if(s.requireWebsite===true)addGate('Website required',known?Boolean(soc.website):null,'Website required');"),
("if(s.requireTelegram===true)addGate('Telegram required',known?Boolean(soc.telegram):null,'Telegram is required');",
 "if(s.requireTelegram===true)addGate('Telegram required',known?Boolean(soc.telegram):null,'Telegram required');"),
("if(s.requireAnySocial===true)addGate('Any social required',known?Boolean(soc.twitter||soc.website||soc.telegram):null,'at least one social link is required');",
 "if(s.requireAnySocial===true)addGate('Any social required',known?Boolean(soc.twitter||soc.website||soc.telegram):null,'At least one social link is required');"),
("if(s.requireWebsiteOrX===true)addGate('Website or X required',known?Boolean(soc.website||soc.twitter):null,'website or X is required');",
 "if(s.requireWebsiteOrX===true)addGate('Website or X required',known?Boolean(soc.website||soc.twitter):null,'Website or X required');"),
("addGate('Developer blacklist',creator?!bl.includes(creator):null,'developer wallet is blacklisted');",
 "addGate('Developer blacklist',creator?!bl.includes(creator):null,'Developer wallet is blacklisted');"),
]
for old,new in replacements:
    if old not in s: raise SystemExit("evaluate wording anchor mismatch: "+old[:40])
    s=s.replace(old,new,1)

old_fresh_holder="""  addGate('Verified price',v.price===null?null:v.price>0,'price unavailable',{value:v.price});
  if(s.requireFreshHolderSnapshot===true)addGate('Fresh holder snapshot',token.holderFresh==null?null:token.holderFresh===true,'holder snapshot unavailable');"""
new_fresh_holder="""  addGate('Verified price',v.price===null?null:v.price>0,'price unavailable',{value:v.price});
  if(s.requireFreshHolderSnapshot===true){
    // holderFresh=false is provisional while the holder scan is still running.
    // Missing/freshness-pending evidence must WAIT; only known hard gates BLOCK.
    addGate('Fresh holder snapshot',token.holderFresh===true?true:null,'fresh holder snapshot data pending');
  }"""
if old_fresh_holder not in s: raise SystemExit("evaluate fresh-holder anchor mismatch")
s=s.replace(old_fresh_holder,new_fresh_holder,1)

old_score="""  const minScore=finite(s.minScore)?Number(s.minScore):null;
  const minConfidence=finite(s.minConfidence)?Number(s.minConfidence):null;
  const scorePass=minScore===null||score>=minScore;
  const confPass=minConfidence===null||confidence>=minConfidence;
  gates.push({name:'Minimum AI score',status:scorePass?'PASS':'FAIL',pass:scorePass,value:score,threshold:minScore});
  if(!scorePass){blocked=true;reasons.push(`AI score ${score} below configured minimum ${minScore}`)}
  gates.push({name:'Minimum data confidence',status:confPass?'PASS':'FAIL',pass:confPass,value:confidence,threshold:minConfidence});
  if(!confPass){blocked=true;reasons.push(`data confidence ${confidence}% below configured minimum ${minConfidence}%`)}

  const state=blocked?'BLOCKED':waiting?'WAITING':scorePass&&confPass?'BUY READY':'WATCH';
  return {
    state,score,confidence,dataConfidence:confidence,confidenceKind:'data-completeness',reasons,
    primaryReason:reasons[0]||'Independent AI quality and all configured user gates passed',
    aiQuality:{model:'MEMEFLOW_INDEPENDENT_AI_V1',score,components:ai.quality},
    settingsEvaluation:{minScore,minConfidence,gates}
  };"""
new_score="""  const minScore=finite(s.minScore)?Number(s.minScore):null;
  const minConfidence=finite(s.minConfidence)?Number(s.minConfidence):null;
  const scorePass=minScore===null||score>=minScore;
  const confPass=minConfidence===null||confidence>=minConfidence;

  // Critical lifecycle rule:
  // incomplete enabled evidence is WAITING, never a synthetic low-score BLOCK.
  // Known hard gate failures still win and remain BLOCKED.
  if(waiting){
    gates.push({name:'Minimum AI score',status:'WAITING',pass:false,value:score,threshold:minScore});
    gates.push({name:'Minimum data confidence',status:'WAITING',pass:false,value:confidence,threshold:minConfidence});
  }else{
    gates.push({name:'Minimum AI score',status:scorePass?'PASS':'FAIL',pass:scorePass,value:score,threshold:minScore});
    if(!scorePass){blocked=true;reasons.push(`AI score ${score} below configured minimum ${minScore}`)}
    gates.push({name:'Minimum data confidence',status:confPass?'PASS':'FAIL',pass:confPass,value:confidence,threshold:minConfidence});
    if(!confPass){blocked=true;reasons.push(`data confidence ${confidence}% below configured minimum ${minConfidence}%`)}
  }

  const state=blocked?'BLOCKED':waiting?'WAITING':scorePass&&confPass?'BUY READY':'WATCH';
  const primaryReason=blocked
    ? (reasons.find(r=>!String(r).startsWith('Waiting: '))||reasons[0])
    : reasons[0];

  return {
    state,score,confidence,dataConfidence:confidence,confidenceKind:'data-completeness',reasons,
    primaryReason:primaryReason||'Independent AI quality and all configured user gates passed',
    aiQuality:{model:'MEMEFLOW_INDEPENDENT_AI_V1',score,components:ai.quality},
    settingsEvaluation:{minScore,minConfidence,gates}
  };"""
if old_score not in s: raise SystemExit("evaluate score/confidence anchor mismatch")
s=s.replace(old_score,new_score,1)
p.write_text(s,encoding="utf-8")

# Update the legacy regression test to match the canonical social lifecycle:
# unresolved metadata => WAITING; resolved metadata with no required link => BLOCKED.
p=Path("src/filter-upgrade.test.mjs")
s=p.read_text(encoding="utf-8")
old_social_test="""test('required social link blocks when missing',()=>{const s=normalizeSettings({...defaultSettings(),minHolders:null,maxTop10Pct:null,maxDeveloperPct:null,minTokenAgeMinutes:null,maxTokenAgeMinutes:null,requireFreshHolderSnapshot:false,minBuyPressure:null,requireTwitter:true});const d=evaluate(baseToken({twitter:null}),s);assert.equal(d.state,'BLOCKED');assert.match(d.reasons.join(' '),/Twitter\/X required/)});"""
new_social_tests="""test('required social link waits while metadata is unresolved',()=>{const s=normalizeSettings({...defaultSettings(),minHolders:null,maxTop10Pct:null,maxDeveloperPct:null,minTokenAgeMinutes:null,maxTokenAgeMinutes:null,requireFreshHolderSnapshot:false,minBuyPressure:null,requireTwitter:true,minScore:0,minConfidence:0});const d=evaluate(baseToken({twitter:null,metadataReady:false,metadataFetched:false,metadataResolved:false}),s);assert.equal(d.state,'WAITING')});
test('required social link blocks only after metadata resolves without it',()=>{const s=normalizeSettings({...defaultSettings(),minHolders:null,maxTop10Pct:null,maxDeveloperPct:null,minTokenAgeMinutes:null,maxTokenAgeMinutes:null,requireFreshHolderSnapshot:false,minBuyPressure:null,requireTwitter:true,minScore:0,minConfidence:0});const d=evaluate(baseToken({twitter:null,metadataResolved:true}),s);assert.equal(d.state,'BLOCKED');assert.match(d.reasons.join(' '),/Twitter\/X required/)});"""
if s.count(old_social_test)!=1: raise SystemExit("filter-upgrade social lifecycle anchor mismatch")
s=s.replace(old_social_test,new_social_tests,1)
p.write_text(s,encoding="utf-8")

# ---------------------------------------------------------------------------
# 2) METADATA/SOCIAL ENRICHMENT
#    Reuse the metadata request that already exists; no new realtime dependency.
# ---------------------------------------------------------------------------
p=Path("src/enrich.mjs")
s=p.read_text(encoding="utf-8")

image_fn_end="""  return null;
}

async function fetchTokenMetadata(uri) {"""
social_helpers="""  return null;
}

function firstMetadataText(metadata, keys=[]) {
  if (!metadata || typeof metadata !== 'object') return null;
  const roots=[metadata,metadata.extensions,metadata.links,metadata.socials].filter(Boolean);
  for (const root of roots) {
    for (const key of keys) {
      const value=root?.[key];
      if (typeof value === 'string' && value.trim()) return value.trim().slice(0,500);
    }
  }
  return null;
}

async function fetchTokenMetadata(uri) {"""
if image_fn_end not in s: raise SystemExit("enrich metadata helper anchor mismatch")
s=s.replace(image_fn_end,social_helpers,1)

old_invalid="""  if (!metadataUrl) return {metadataUrl:null, imageUrl:null};"""
new_invalid="""  if (!metadataUrl) return {
    metadataUrl:null,imageUrl:null,metadataResolved:true,
    twitter:null,website:null,telegram:null
  };"""
if old_invalid not in s: raise SystemExit("enrich invalid metadata URL anchor mismatch")
s=s.replace(old_invalid,new_invalid,1)

old_return="""    return {
      metadataUrl,
      imageUrl:firstMetadataImage(metadata),
      metadataName:typeof metadata?.name === 'string' ? metadata.name.slice(0,160) : null,
      metadataSymbol:typeof metadata?.symbol === 'string' ? metadata.symbol.slice(0,40) : null
    };"""
new_return="""    return {
      metadataUrl,
      metadataResolved:true,
      imageUrl:firstMetadataImage(metadata),
      metadataName:typeof metadata?.name === 'string' ? metadata.name.slice(0,160) : null,
      metadataSymbol:typeof metadata?.symbol === 'string' ? metadata.symbol.slice(0,40) : null,
      twitter:firstMetadataText(metadata,['twitter','x','twitter_url','x_url']),
      website:firstMetadataText(metadata,['website','site','url','homepage']),
      telegram:firstMetadataText(metadata,['telegram','tg','telegram_url'])
    };"""
if old_return not in s: raise SystemExit("enrich metadata return anchor mismatch")
s=s.replace(old_return,new_return,1)

old_should="""    let metadataPatch = {};
    const shouldFetchMetadata =
      existingToken.uri &&
      !existingToken.imageUrl &&
      (!existingToken.metadataFetchedAt ||
        Date.now() - Number(existingToken.metadataFetchedAt) > 6 * 60 * 60 * 1000);

    if (shouldFetchMetadata) {
      try {
        const metadata = await fetchTokenMetadata(existingToken.uri);
        metadataPatch = {
          metadataFetchedAt:Date.now(),
          metadataUrl:metadata.metadataUrl,
          imageUrl:metadata.imageUrl,
          image:metadata.imageUrl,
          logoUrl:metadata.imageUrl,
          metadataName:metadata.metadataName,
          metadataSymbol:metadata.metadataSymbol
        };
      } catch (error) {
        metadataPatch = {
          metadataFetchedAt:Date.now(),
          metadataError:sanitize(error?.message || String(error))
        };
      }
    }"""
new_should="""    let metadataPatch = {};
    const metadataAttemptAt=Number(existingToken.metadataFetchedAt||0);
    const metadataRetryMs=60_000;
    const metadataRetryReady=
      !metadataAttemptAt ||
      !existingToken.metadataError ||
      Date.now()-metadataAttemptAt>=metadataRetryMs;
    const shouldFetchMetadata =
      Boolean(existingToken.uri) &&
      existingToken.metadataResolved!==true &&
      metadataRetryReady;

    if (shouldFetchMetadata) {
      try {
        const metadata = await fetchTokenMetadata(existingToken.uri);
        const socialPatch={};
        if(metadata.twitter){socialPatch.twitter=metadata.twitter;socialPatch.twitterUrl=metadata.twitter}
        if(metadata.website){socialPatch.website=metadata.website;socialPatch.websiteUrl=metadata.website}
        if(metadata.telegram){socialPatch.telegram=metadata.telegram;socialPatch.telegramUrl=metadata.telegram}
        metadataPatch = {
          metadataFetchedAt:Date.now(),
          metadataResolved:metadata.metadataResolved===true,
          metadataError:null,
          metadataUrl:metadata.metadataUrl,
          imageUrl:metadata.imageUrl,
          image:metadata.imageUrl,
          logoUrl:metadata.imageUrl,
          metadataName:metadata.metadataName,
          metadataSymbol:metadata.metadataSymbol,
          ...socialPatch
        };
      } catch (error) {
        metadataPatch = {
          metadataFetchedAt:Date.now(),
          metadataResolved:false,
          metadataError:sanitize(error?.message || String(error))
        };
      }
    }"""
if old_should not in s: raise SystemExit("enrich shouldFetchMetadata anchor mismatch")
s=s.replace(old_should,new_should,1)
p.write_text(s,encoding="utf-8")

# ---------------------------------------------------------------------------
# 3) LIVE FEED LIFECYCLE
#    Read-time only. No RPC, no OpenAI, no disk write, no scanner await.
# ---------------------------------------------------------------------------
Path("src/candidate-visibility.mjs").write_text(r"""const terminalStates=new Set(['EXPIRED','BLOCKED','REJECTED','CLOSED','IGNORED']);

const FILTERED_LIVE_TTL_MS=Math.max(
  60_000,
  Number(process.env.MEMEFLOW_FILTERED_LIVE_TTL_MS||15*60_000)
);
const PASSIVE_LIVE_TTL_MS=Math.max(
  FILTERED_LIVE_TTL_MS,
  Number(process.env.MEMEFLOW_PASSIVE_LIVE_TTL_MS||60*60_000)
);

function tsMs(v){
  if(v===null||v===undefined||v==='')return null;
  if(typeof v==='number'&&Number.isFinite(v))return v<1e12?v*1000:v;
  const n=Number(v);
  if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;
  const d=Date.parse(String(v));
  return Number.isFinite(d)?d:null;
}

function lookupToken(tokenLookup,mint){
  if(typeof tokenLookup==='function')return tokenLookup(mint)||null;
  if(tokenLookup&&typeof tokenLookup==='object')return tokenLookup[mint]||null;
  return null;
}

function marketActivityAt(token={},decision={}){
  // updatedAt/lastPriceAt are deliberately NOT first: polling a flat market
  // must not keep a dead token alive forever.
  for(const v of [
    token.lastMarketActivityAt,
    token.lastPriceChangeAt,
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

  // Never remove a currently qualified candidate merely because its market is quiet.
  if(state==='BUY READY')return false;

  const activity=marketActivityAt(token,decision);
  if(activity===null)return false;
  const idle=Math.max(0,Number(now)-activity);

  if(state==='WAITING'||state==='WATCH')return idle>=PASSIVE_LIVE_TTL_MS;
  if(terminalStates.has(state)||decision.terminal===true)return idle>=FILTERED_LIVE_TTL_MS;
  return false;
}

export function classifyDecisionVisibility(decision={},token=null,now=Date.now()){
  if(isDecisionArchived(decision,token,now))return 'archived';

  const state=String(decision.state||'WAITING').trim().toUpperCase();
  const closed=
    decision.terminal===true||
    String(decision.lifecycle||'').toLowerCase()==='closed'||
    terminalStates.has(state);

  if(state==='BUY READY'&&!closed)return 'candidate';
  if(state==='WAITING'&&!closed)return 'processing';
  return 'filtered';
}

export function candidateFeed(decisions=[],scope='candidates',tokenLookup=null,now=Date.now()){
  const rows=Array.isArray(decisions)?decisions.filter(Boolean):[];
  const normalized=String(scope||'candidates').trim().toLowerCase();
  const kindOf=row=>classifyDecisionVisibility(
    row,
    lookupToken(tokenLookup,row?.mint),
    now
  );

  // "all" is the live surface. "audit" stays exhaustive while the in-memory
  // decision exists; "archived" exposes lifecycle-hidden rows.
  if(normalized==='audit')return rows;
  if(normalized==='archived')return rows.filter(row=>kindOf(row)==='archived');
  if(normalized==='all')return rows.filter(row=>kindOf(row)!=='archived');
  if(normalized==='processing')return rows.filter(row=>kindOf(row)==='processing');
  if(normalized==='watch')return rows.filter(row=>
    String(row?.state||'').toUpperCase()==='WATCH'&&kindOf(row)!=='archived'
  );
  if(normalized==='filtered')return rows.filter(row=>kindOf(row)==='filtered');

  return rows.filter(row=>kindOf(row)==='candidate');
}

export function candidateVisibilityCounts(decisions=[],tokenLookup=null,now=Date.now()){
  const counts={
    candidates:0,
    processing:0,
    filtered:0,
    archived:0,
    visible:0,
    totalEvaluated:0,
    buyReady:0,
    watch:0,
    waiting:0,
    blocked:0
  };

  for(const row of Array.isArray(decisions)?decisions:[]){
    if(!row)continue;
    counts.totalEvaluated++;

    const token=lookupToken(tokenLookup,row?.mint);
    const kind=classifyDecisionVisibility(row,token,now);
    if(kind==='archived'){counts.archived++;continue}

    counts.visible++;
    const state=String(row.state||'WAITING').trim().toUpperCase();
    if(state==='BUY READY')counts.buyReady++;
    else if(state==='WATCH')counts.watch++;
    else if(state==='WAITING')counts.waiting++;
    else if(state==='BLOCKED')counts.blocked++;

    if(kind==='candidate')counts.candidates++;
    else if(kind==='processing')counts.processing++;
    else counts.filtered++;
  }
  return counts;
}
""",encoding="utf-8")

# ---------------------------------------------------------------------------
# 4) STORE: less disk churn + canonical decision deletion + settings version.
# ---------------------------------------------------------------------------
p=Path("src/store.mjs")
s=p.read_text(encoding="utf-8")

old_ctor="""    this._lastPruneAt=0;
    this._tokenCount=0;
    this.maxTokens=Math.max(250,Math.floor(envNum('STORE_MAX_TOKENS',2000,250)));"""
new_ctor="""    this._lastPruneAt=0;
    this._tokenCount=0;
    this._lastTouchPersistAt={};
    this.userActivitySaveIntervalMs=Math.max(
      5000,
      envNum('STORE_USER_ACTIVITY_SAVE_INTERVAL_MS',30000,5000)
    );
    this.maxTokens=Math.max(250,Math.floor(envNum('STORE_MAX_TOKENS',2000,250)));"""
if old_ctor not in s: raise SystemExit("store constructor anchor mismatch")
s=s.replace(old_ctor,new_ctor,1)

old_touch="""  touchUser(id){this.user(id).lastActiveAt=Date.now();this.save();return this.user(id)}"""
new_touch="""  touchUser(id){
    const u=this.user(id),now=Date.now();
    u.lastActiveAt=now;
    const last=Number(this._lastTouchPersistAt[id]||0);
    if(!last||now-last>=this.userActivitySaveIntervalMs){
      this._lastTouchPersistAt[id]=now;
      this.save();
    }
    return u
  }"""
if old_touch not in s: raise SystemExit("store touchUser anchor mismatch")
s=s.replace(old_touch,new_touch,1)

old_decision="""  setDecision(uid,mint,d){
    const key=uid+':'+mint,now=Date.now();
    this.state.decisions[key]={...d,userId:uid,mint,updatedAt:now};
    if(!this._uidDec[uid])this._uidDec[uid]=new Map();"""
new_decision="""  setDecision(uid,mint,d){
    const key=uid+':'+mint,now=Date.now();
    const settingsVersion=this.state.users?.[uid]?.settingsVersion||1;
    this.state.decisions[key]={
      ...d,
      userId:uid,
      mint,
      settingsVersion:d?.settingsVersion??settingsVersion,
      updatedAt:now
    };
    if(!this._uidDec[uid])this._uidDec[uid]=new Map();"""
if old_decision not in s: raise SystemExit("store setDecision anchor mismatch")
s=s.replace(old_decision,new_decision,1)

anchor="""    // Decisions are intentionally in-memory only; do not schedule a disk write.
  }
  decisions(uid){"""
insert="""    // Decisions are intentionally in-memory only; do not schedule a disk write.
  }
  deleteDecision(uid,mint){
    const key=uid+':'+mint;
    const existed=Boolean(this.state.decisions?.[key]);
    if(this.state.decisions)delete this.state.decisions[key];
    const m=this._uidDec?.[uid];
    if(m){
      m.delete(key);
      if(!m.size)delete this._uidDec[uid];
    }
    return existed;
  }
  decisions(uid){"""
if anchor not in s: raise SystemExit("store deleteDecision insertion anchor mismatch")
s=s.replace(anchor,insert,1)
p.write_text(s,encoding="utf-8")

# ---------------------------------------------------------------------------
# 5) PAPER ENGINE: feeReserve becomes an actual execution constraint.
# ---------------------------------------------------------------------------
p=Path("src/paper-engine.mjs")
s=p.read_text(encoding="utf-8")

old="""      tradingCapital: Math.max(0, num(settings.tradingCapital, 0)),
      dailyLossLimit: Math.max(0, num(settings.dailyLossLimit, 0)),
      hardStopPct:"""
new="""      tradingCapital: Math.max(0, num(settings.tradingCapital, 0)),
      dailyLossLimit: Math.max(0, num(settings.dailyLossLimit, 0)),
      feeReserve: Math.max(0, num(settings.feeReserve, 0)),
      hardStopPct:"""
if old not in s: raise SystemExit("paper settings feeReserve anchor mismatch")
s=s.replace(old,new,1)

old="""    const deployed = openPositions.reduce(
      (sum, position) => sum + num(position.remainingSizeSol),
      0
    );

    const priceReady"""
new="""    const deployed = openPositions.reduce(
      (sum, position) => sum + num(position.remainingSizeSol),
      0
    );
    const tradableCapital =
      s.tradingCapital > 0
        ? Math.max(0, Math.round((s.tradingCapital - s.feeReserve) * 1e9) / 1e9)
        : 0;

    const priceReady"""
if old not in s: raise SystemExit("paper tradableCapital anchor mismatch")
s=s.replace(old,new,1)

old="""    const capitalAvailable =
      s.tradingCapital <= 0 ||
      deployed + s.positionSize <= s.tradingCapital;"""
new="""    const capitalAvailable =
      s.tradingCapital <= 0 ||
      deployed + s.positionSize <= tradableCapital + 1e-12;"""
if old not in s: raise SystemExit("paper capitalAvailable anchor mismatch")
s=s.replace(old,new,1)

old="""        deployed,
        tradingCapital: s.tradingCapital,
        dailyRealizedPnl,"""
new="""        deployed,
        tradingCapital: s.tradingCapital,
        feeReserve: s.feeReserve,
        tradableCapital: s.tradingCapital > 0 ? tradableCapital : null,
        dailyRealizedPnl,"""
if old not in s: raise SystemExit("paper metrics anchor mismatch")
s=s.replace(old,new,1)
p.write_text(s,encoding="utf-8")

# ---------------------------------------------------------------------------
# 6) OPENAI: proposal generation is allowed; automatic mutation is not.
#    Explicit /strategy/apply is routed through canonical settings validation,
#    shadow validation, audit, and reevaluation in app-server.
# ---------------------------------------------------------------------------
p=Path("src/openai-intelligence.mjs")
s=p.read_text(encoding="utf-8")

old="enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:true,"
new="enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:false,"
if s.count(old)!=1: raise SystemExit("OpenAI default autoOptimize anchor mismatch")
s=s.replace(old,new,1)

old="""  constructor({store,executeTrade=null}){this.store=store;this.executeTrade=executeTrade;this.tokenCache=new Map()}"""
new="""  constructor({store,executeTrade=null,applySettingsProposal=null}){this.store=store;this.executeTrade=executeTrade;this.applySettingsProposal=applySettingsProposal;this.tokenCache=new Map()}"""
if old not in s: raise SystemExit("OpenAI constructor anchor mismatch")
s=s.replace(old,new,1)

old="""    u.ai.settings={...aiDefaults(),...(u.ai.settings||{})};"""
new="""    u.ai.settings={...aiDefaults(),...(u.ai.settings||{}),autoOptimize:false};"""
if old not in s: raise SystemExit("OpenAI userState anchor mismatch")
s=s.replace(old,new,1)

# Null/disabled settings must not accidentally become numeric zero in the optional AI gate.
old="""    if(t.top10Pct!=null&&t.top10Pct>s.maxTop10Pct)reasons.push('TOP10_LIMIT');
    if(t.developerPct!=null&&t.developerPct>s.maxDeveloperPct)reasons.push('DEVELOPER_LIMIT');
    if(t.buyPressure!=null&&t.buyPressure<s.minBuyPressure)reasons.push('BUY_PRESSURE_LIMIT');"""
new="""    if(s.maxTop10Pct!=null&&Number.isFinite(Number(s.maxTop10Pct))&&t.top10Pct!=null&&Number(t.top10Pct)>Number(s.maxTop10Pct))reasons.push('TOP10_LIMIT');
    if(s.maxDeveloperPct!=null&&Number.isFinite(Number(s.maxDeveloperPct))&&t.developerPct!=null&&Number(t.developerPct)>Number(s.maxDeveloperPct))reasons.push('DEVELOPER_LIMIT');
    if(s.minBuyPressure!=null&&Number.isFinite(Number(s.minBuyPressure))&&t.buyPressure!=null&&Number(t.buyPressure)<Number(s.minBuyPressure))reasons.push('BUY_PRESSURE_LIMIT');"""
if old not in s: raise SystemExit("OpenAI hardRiskGate anchor mismatch")
s=s.replace(old,new,1)

old_apply="""  async applyProposal(uid,proposal){
    const ai=this.userState(uid),cfg=ai.settings;if(!cfg.autoOptimize)return {applied:false,reason:'AUTO_OPTIMIZE_DISABLED'};
    const allowed=cfg.allowedAutoTune?.[proposal.setting];if(!allowed)return {applied:false,reason:'SETTING_NOT_ALLOWED'};
    if((cfg.lockedSettings||[]).includes(proposal.setting))return {applied:false,reason:'SETTING_LOCKED'};
    if(Number(proposal.confidence)<80)return {applied:false,reason:'CONFIDENCE_BELOW_80'};
    const current=this.store.settings(uid),n=Number(proposal.proposed);if(!Number.isFinite(n))return {applied:false,reason:'NON_NUMERIC_PROPOSAL'};
    const next={...current,[proposal.setting]:clamp(n,Number(allowed.min),Number(allowed.max))};this.store.setSettings(uid,next);
    this.audit(uid,'auto_optimize',{setting:proposal.setting,from:current[proposal.setting],to:next[proposal.setting]});return {applied:true,setting:proposal.setting,value:next[proposal.setting]};
  }"""
new_apply="""  async applyProposal(uid,proposal){
    const ai=this.userState(uid),cfg=ai.settings;
    const setting=String(proposal?.setting||'').trim();
    const allowed=cfg.allowedAutoTune?.[setting];if(!allowed)return {applied:false,reason:'SETTING_NOT_ALLOWED'};
    if((cfg.lockedSettings||[]).includes(setting))return {applied:false,reason:'SETTING_LOCKED'};
    if(Number(proposal?.confidence)<80)return {applied:false,reason:'CONFIDENCE_BELOW_80'};
    const n=Number(proposal?.proposed);if(!Number.isFinite(n))return {applied:false,reason:'NON_NUMERIC_PROPOSAL'};
    if(typeof this.applySettingsProposal!=='function')return {applied:false,reason:'OWNER_APPROVAL_PATH_NOT_CONNECTED'};
    const normalized={
      ...proposal,
      setting,
      proposed:clamp(n,Number(allowed.min),Number(allowed.max)),
      confidence:clamp(proposal.confidence,0,100)
    };
    const result=await this.applySettingsProposal({uid,proposal:normalized,aiSettings:cfg});
    this.audit(uid,result?.applied?'owner_approved_strategy_apply':'strategy_apply_rejected',{
      setting,
      proposed:normalized.proposed,
      reason:result?.reason||null
    });
    return result;
  }"""
if old_apply not in s: raise SystemExit("OpenAI applyProposal anchor mismatch")
s=s.replace(old_apply,new_apply,1)

old_put="""if(url.pathname==='/api/openai/settings'&&req.method==='PUT'){const b=await readBody(req),ai=this.userState(uid),next={...ai.settings,...(b.settings||{}),updatedAt:now()};delete next.userId;ai.settings=next;this.save();return {status:200,body:{settings:ai.settings}}}"""
new_put="""if(url.pathname==='/api/openai/settings'&&req.method==='PUT'){const b=await readBody(req),ai=this.userState(uid),next={...ai.settings,...(b.settings||{}),autoOptimize:false,updatedAt:now()};delete next.userId;ai.settings=next;this.save();return {status:200,body:{settings:ai.settings}}}"""
if old_put not in s: raise SystemExit("OpenAI settings PUT anchor mismatch")
s=s.replace(old_put,new_put,1)
p.write_text(s,encoding="utf-8")

# ---------------------------------------------------------------------------
# 7) APP SERVER: wire lifecycle to token activity; canonical owner-approved AI apply.
# ---------------------------------------------------------------------------
p=Path("app-server.mjs")
s=p.read_text(encoding="utf-8")

openai_anchor="""const openaiAI=new OpenAIIntelligence({
  store,
  executeTrade:async({uid,mint,side,amountSol})=>({"""
openai_insert="""async function applyOwnerApprovedAIProposal({uid,proposal}={}){
  const setting=String(proposal?.setting||'').trim();
  const proposed=Number(proposal?.proposed);
  if(!uid||!setting||!Number.isFinite(proposed)){
    return {applied:false,reason:'INVALID_PROPOSAL'};
  }

  const before=JSON.parse(JSON.stringify(store.settings(uid)));
  if(before.aiChangePolicy!=='propose'){
    return {applied:false,reason:'AI_POLICY_NOT_PROPOSE'};
  }

  const checked=validateSettings({...before,[setting]:proposed});
  if(!checked.ok){
    return {applied:false,reason:'INVALID_SETTINGS',errors:checked.errors};
  }

  const shadow=checked.settings.shadowValidation
    ? shadowValidateSettings(checked.settings,50)
    : null;
  if(shadow?.errors?.length){
    return {applied:false,reason:'SHADOW_VALIDATION_FAILED',shadowValidation:shadow};
  }

  const saved=store.setSettings(uid,checked.settings);
  if(saved.changeLog!==false){
    store.recordSettingsChange(uid,before,saved,{
      actor:uid,
      source:'openai_owner_approved'
    });
  }
  const decisionsReevaluated=reevaluateUser(uid);
  return {
    applied:true,
    setting,
    value:saved[setting],
    settingsVersion:store.user(uid)?.settingsVersion||1,
    decisionsReevaluated,
    shadowValidation:shadow
  };
}

const openaiAI=new OpenAIIntelligence({
  store,
  applySettingsProposal:applyOwnerApprovedAIProposal,
  executeTrade:async({uid,mint,side,amountSol})=>({"""
if openai_anchor not in s: raise SystemExit("app-server OpenAI constructor anchor mismatch")
s=s.replace(openai_anchor,openai_insert,1)

old_status="""if(url.pathname==='/api/openai/status'&&req.method==='GET')return json(res,200,{ok:true,configured:Boolean(process.env.OPENAI_API_KEY),model:OPENAI_MODEL,mode:'read-only'});"""
new_status="""if(url.pathname==='/api/openai/status'&&req.method==='GET')return json(res,200,{ok:true,configured:Boolean(process.env.OPENAI_API_KEY),model:OPENAI_MODEL,mode:'proposal-only',autoOptimize:false,settingsPolicy:'owner-approved'});"""
if old_status not in s: raise SystemExit("app-server native OpenAI status anchor mismatch")
s=s.replace(old_status,new_status,1)

old_feed="""  const _all=store.decisions(u.id);
  const _selected=candidateFeed(_all,_scope);
  const _counts=candidateVisibilityCounts(_all);"""
new_feed="""  const _all=store.decisions(u.id);
  const _tokenLookup=(mint)=>store.state.tokens?.[mint]||null;
  const _selected=candidateFeed(_all,_scope,_tokenLookup);
  const _counts=candidateVisibilityCounts(_all,_tokenLookup);"""
if old_feed not in s: raise SystemExit("app-server decisions feed anchor mismatch")
s=s.replace(old_feed,new_feed,1)

old_debug="""    const decision=
      store?._uidDec?.[u.id]?.get?.(mint) ??
      store?.state?.decisions?.[u.id]?.[mint] ??
      null;"""
new_debug="""    const decision=
      store?.state?.decisions?.[u.id+':'+mint] ??
      null;"""
if old_debug not in s: raise SystemExit("app-server debug decision lookup anchor mismatch")
s=s.replace(old_debug,new_debug,1)

p.write_text(s,encoding="utf-8")

# ---------------------------------------------------------------------------
# 8) TESTS
# ---------------------------------------------------------------------------
Path("src/unified-decision.test.mjs").write_text(r"""import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettings,normalizeSettings} from './settings.mjs';
import {evaluate} from './evaluate.mjs';

const complete=(patch={})=>({
  mint:'Mint111',
  name:'Token',
  symbol:'TOK',
  holderCount:50,
  holderFresh:true,
  priceSol:1,
  dataQuality:1,
  buyPressure:2,
  top10Pct:20,
  developerPct:10,
  source:'Pump create',
  launchPlatform:'pump',
  discoveredAt:Date.now(),
  metadataResolved:true,
  ...patch
});

test('fresh incomplete token waits instead of being blocked by synthetic low score',()=>{
  const d=evaluate({
    mint:'Fresh111',
    name:'Fresh',
    symbol:'F',
    uri:'https://example.invalid/meta.json',
    source:'Pump create',
    launchPlatform:'pump',
    discoveredAt:Date.now(),
    holderFresh:false
  },defaultSettings());
  assert.equal(d.state,'WAITING');
  assert.equal(d.settingsEvaluation.gates.find(g=>g.name==='Minimum AI score')?.status,'WAITING');
  assert.equal(d.settingsEvaluation.gates.find(g=>g.name==='Minimum data confidence')?.status,'WAITING');
});

test('known hard fail remains BLOCKED even while other evidence is pending',()=>{
  const d=evaluate({
    mint:'Bad111',
    holderCount:2,
    holderFresh:false,
    source:'Pump create',
    launchPlatform:'pump',
    discoveredAt:Date.now()
  },defaultSettings());
  assert.equal(d.state,'BLOCKED');
  assert.match(d.primaryReason,/holders below 30/i);
});

test('social gate waits until metadata is actually resolved',()=>{
  const s=normalizeSettings({...defaultSettings(),requireAnySocial:true});
  const d=evaluate(complete({
    metadataResolved:false,
    uri:'https://example.invalid/meta.json',
    twitter:null,website:null,telegram:null
  }),s);
  assert.equal(d.state,'WAITING');
});

test('social gate blocks after successful metadata resolution confirms no socials',()=>{
  const s=normalizeSettings({...defaultSettings(),requireAnySocial:true});
  const d=evaluate(complete({
    metadataResolved:true,
    twitter:null,website:null,telegram:null
  }),s);
  assert.equal(d.state,'BLOCKED');
  assert.match(d.primaryReason,/social link/i);
});

test('social gate passes when resolved metadata contains a social',()=>{
  const s=normalizeSettings({...defaultSettings(),requireAnySocial:true});
  const d=evaluate(complete({
    metadataResolved:true,
    twitter:'https://x.com/example'
  }),s);
  assert.equal(d.state,'BUY READY');
});
""",encoding="utf-8")

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
  {mint:'blocked-stale',state:'BLOCKED',updatedAt:NOW-M},
  {mint:'blocked-live',state:'BLOCKED',updatedAt:NOW-M},
  {mint:'waiting-stale',state:'WAITING',updatedAt:NOW-M},
  {mint:'watch-stale',state:'WATCH',updatedAt:NOW-M},
  {mint:'buy-stale',state:'BUY READY',updatedAt:NOW-M}
];
const tokens={
  'blocked-stale':{lastMarketActivityAt:NOW-16*M,discoveredAt:NOW-20*M},
  'blocked-live':{lastMarketActivityAt:NOW-2*M,discoveredAt:NOW-20*M},
  'waiting-stale':{lastMarketActivityAt:NOW-61*M,discoveredAt:NOW-70*M},
  'watch-stale':{lastMarketActivityAt:NOW-61*M,discoveredAt:NOW-70*M},
  'buy-stale':{lastMarketActivityAt:NOW-120*M,discoveredAt:NOW-130*M}
};
const lookup=m=>tokens[m];

test('stale BLOCKED leaves live but remains available to audit/archive',()=>{
  assert.equal(isDecisionArchived(decisions[0],tokens['blocked-stale'],NOW),true);
  assert.equal(candidateFeed(decisions,'all',lookup,NOW).some(x=>x.mint==='blocked-stale'),false);
  assert.equal(candidateFeed(decisions,'audit',lookup,NOW).some(x=>x.mint==='blocked-stale'),true);
  assert.equal(candidateFeed(decisions,'archived',lookup,NOW).some(x=>x.mint==='blocked-stale'),true);
});

test('recent BLOCKED remains visible',()=>{
  assert.equal(classifyDecisionVisibility(decisions[1],tokens['blocked-live'],NOW),'filtered');
});

test('WAITING/WATCH age out after passive TTL',()=>{
  assert.equal(classifyDecisionVisibility(decisions[2],tokens['waiting-stale'],NOW),'archived');
  assert.equal(classifyDecisionVisibility(decisions[3],tokens['watch-stale'],NOW),'archived');
});

test('BUY READY is not hidden only because market is quiet',()=>{
  assert.equal(classifyDecisionVisibility(decisions[4],tokens['buy-stale'],NOW),'candidate');
});

test('visible counts exclude archived rows without destroying audit total',()=>{
  const c=candidateVisibilityCounts(decisions,lookup,NOW);
  assert.equal(c.totalEvaluated,5);
  assert.equal(c.archived,3);
  assert.equal(c.visible,2);
  assert.equal(c.buyReady,1);
  assert.equal(c.blocked,1);
});
""",encoding="utf-8")

Path("src/paper-fee-reserve.test.mjs").write_text(r"""import test from 'node:test';
import assert from 'node:assert/strict';
import {PaperEngine} from './paper-engine.mjs';

function fakeStore(){
  return {
    state:{
      users:{u1:{killSwitch:false}},
      paperPositions:{},paperTrades:{},paperProposals:{},paperProcessed:{},
      paperMetrics:{entries:0,exits:0,errors:0}
    },
    save(){}
  };
}

const token=()=>({
  mint:'Mint111',
  name:'Token',
  symbol:'TOK',
  priceSol:1,
  holderFresh:true,
  updatedAt:Date.now()
});

const settings=(patch={})=>({
  operatingMode:'automate',
  tradingEnvironment:'paper',
  positionSize:0.2,
  maxPositionSize:0.5,
  maxOpenPositions:4,
  maxDailyEntries:10,
  dailySpendLimit:0,
  tradingCapital:1,
  dailyLossLimit:0,
  feeReserve:0.1,
  requireFreshHolderSnapshot:true,
  decisionFreshnessSec:60,
  ...patch
});

test('fee reserve reduces tradable paper capital',()=>{
  const engine=new PaperEngine(fakeStore());
  const r=engine.entryReadiness('u1',token(),settings({tradingCapital:1,feeReserve:0.9,positionSize:0.2}));
  const capital=r.checks.find(x=>x.key==='paperCapital');
  assert.equal(capital.pass,false);
  assert.equal(r.metrics.tradableCapital,0.1);
  assert.equal(r.metrics.feeReserve,0.9);
});

test('position passes capital gate when reserve is preserved',()=>{
  const engine=new PaperEngine(fakeStore());
  const r=engine.entryReadiness('u1',token(),settings({tradingCapital:1,feeReserve:0.1,positionSize:0.2}));
  assert.equal(r.checks.find(x=>x.key==='paperCapital').pass,true);
  assert.equal(r.metrics.tradableCapital,0.9);
});
""",encoding="utf-8")

Path("src/openai-policy.test.mjs").write_text(r"""import test from 'node:test';
import assert from 'node:assert/strict';
import {OpenAIIntelligence} from './openai-intelligence.mjs';

function makeStore(){
  const users={u1:{id:'u1',settings:{
    minScore:72,minConfidence:70,minBuyPressure:1.2,maxTop10Pct:25,maxDeveloperPct:20,
    maxPositionSize:0.5,aiChangePolicy:'propose'
  },ai:{settings:{autoOptimize:true}}}};
  return {
    state:{users,tokens:{}},
    user(id){return users[id]},
    settings(id){return users[id].settings},
    decisions(){return[]},
    save(){}
  };
}

test('persisted autoOptimize true is forced off',()=>{
  const ai=new OpenAIIntelligence({store:makeStore()});
  assert.equal(ai.userState('u1').settings.autoOptimize,false);
});

test('explicit strategy apply uses owner-approved callback, not auto mutation',async()=>{
  const store=makeStore();
  let call=null;
  const ai=new OpenAIIntelligence({
    store,
    applySettingsProposal:async payload=>{
      call=payload;
      return {applied:true,setting:payload.proposal.setting,value:payload.proposal.proposed};
    }
  });
  const out=await ai.applyProposal('u1',{
    setting:'minScore',
    current:72,
    proposed:80,
    reason:'test',
    confidence:90
  });
  assert.equal(out.applied,true);
  assert.equal(call.proposal.setting,'minScore');
  assert.equal(call.proposal.proposed,80);
  assert.equal(ai.userState('u1').settings.autoOptimize,false);
});
""",encoding="utf-8")
PY

log "Syntax validation..."
for f in "${TARGETS[@]}"; do
  case "$f" in
    *.mjs) node --check "$f" ;;
  esac
done
node --check app-server.mjs

log "Canonical evaluator + lifecycle + policy tests..."
node --test \
  src/filter-upgrade.test.mjs \
  src/unified-decision.test.mjs \
  src/candidate-visibility-lifecycle.test.mjs \
  src/paper-fee-reserve.test.mjs \
  src/openai-policy.test.mjs

log "Existing integration suite..."
npm test

# Guardrail: learning/OpenAI/archive may not become an awaited realtime dependency.
if grep -Eiq "from .*openai|await .*openai|await .*candidateFeed|await .*archive" src/liveeval.mjs src/recovery.mjs; then
  die "Realtime guardrail detected an OpenAI/archive dependency in live evaluation/recovery."
fi

# Optional existing 500-user benchmark. It is intentionally opt-in because it can
# take longer on a phone/Replit session and is not required to apply the patch.
if [[ "${MEMEFLOW_PATCH_RUN_BENCHMARK:-0}" == "1" ]]; then
  log "Running optional 500-user benchmark..."
  npm run benchmark
fi

trap - ERR INT TERM

log "SUCCESS: $PATCH_NAME applied and tests passed."
log "Backup: $BACKUP"
log "Key behavior:"
log "  - incomplete evidence and provisional holder freshness => WAITING, not premature BLOCKED"
log "  - metadata social links are extracted from the existing metadata fetch"
log "  - stale BLOCKED leaves Live after 15m without market activity"
log "  - stale WAITING/WATCH leaves Live after 60m without market activity"
log "  - BUY READY is not lifecycle-hidden"
log "  - Live cleanup is read-time only: no new RPC/OpenAI/disk await in diagnostics"
log "  - user activity persistence is throttled to reduce state.json churn"
log "  - feeReserve is enforced by the paper capital gate with 9-decimal SOL normalization"
log "  - OpenAI autoOptimize is OFF; explicit Apply uses canonical validation/shadow/audit"
log ""
log "Review changes with:"
log "git diff -- src/evaluate.mjs src/enrich.mjs src/candidate-visibility.mjs src/openai-intelligence.mjs src/store.mjs src/paper-engine.mjs app-server.mjs src/*unified* src/*lifecycle* src/*fee-reserve* src/*openai-policy*"
