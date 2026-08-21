#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW_UNIFIED_ENGINE_V4"
EXPECTED_HEAD="b4d3d18842191afc3cb87c6737dc86723af4aab0"
EXPECTED_BRANCH="debug-trading-v30-4-2026-08-19-1734"

log(){ printf '[PATCH] %s\n' "$*"; }
die(){ log "STOP: $*"; exit 1; }

# Replit may expose the app itself as ~/workspace while GitHub stores it under memeflow-app/.
if [[ -f "src/evaluate.mjs" && -f "app-server.mjs" ]]; then
  APP_ROOT="."
elif [[ -f "memeflow-app/src/evaluate.mjs" && -f "memeflow-app/app-server.mjs" ]]; then
  APP_ROOT="memeflow-app"
else
  die "Cannot locate MEMEFLOW app root."
fi

HEAD_NOW="$(git rev-parse HEAD 2>/dev/null || true)"
BRANCH_NOW="$(git branch --show-current 2>/dev/null || true)"

[[ "$HEAD_NOW" == "$EXPECTED_HEAD" ]] || die "Expected HEAD $EXPECTED_HEAD but found ${HEAD_NOW:-unknown}. Nothing changed."
[[ "$BRANCH_NOW" == "$EXPECTED_BRANCH" ]] || die "Expected branch $EXPECTED_BRANCH but found ${BRANCH_NOW:-unknown}. Nothing changed."

cd "$APP_ROOT"

TARGETS=(
  "src/evaluate.mjs"
  "src/enrich.mjs"
  "src/candidate-visibility.mjs"
  "src/store.mjs"
  "src/openai-intelligence.mjs"
  "src/paper-engine.mjs"
  "app-server.mjs"
  "package.json"
)

log "Preflight against pushed commit $EXPECTED_HEAD..."
for f in "${TARGETS[@]}"; do
  [[ -f "$f" ]] || die "Missing target file: $f"
  git diff --quiet -- "$f" || die "$f has unstaged changes. Push/commit first; nothing changed."
  git diff --cached --quiet -- "$f" || die "$f has staged changes. Push/commit first; nothing changed."
done

TEST_FILE="src/unified-engine.test.mjs"
[[ ! -e "$TEST_FILE" ]] || die "$TEST_FILE already exists. Refusing to overwrite."

BACKUP=".memeflow-unified-v4-backup-$(date +%Y%m%d-%H%M%S)"
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
  rm -f "$TEST_FILE"
  log "Rollback complete. Backup kept at $BACKUP"
  exit "$code"
}
trap rollback ERR INT TERM

log "Applying unified Settings -> Evaluator -> Feed -> Execution fixes..."

python3 - <<'PY'
from pathlib import Path
import json

def replace_once(path, old, new, label):
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    n = s.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected 1 exact anchor, found {n}")
    p.write_text(s.replace(old, new, 1), encoding="utf-8")

# ---------------------------------------------------------------------------
# 1) Canonical evaluator: missing async data must WAIT, never false-BLOCK.
# ---------------------------------------------------------------------------
p = Path("src/evaluate.mjs")
s = p.read_text(encoding="utf-8")

old = """function metadataKnown(t={}){
  return Boolean(t.metadataReady===true||t.metadataFetched===true||t.metadataResolved===true||t.name||t.symbol||t.uri||t.metadataUri);
}"""
new = """function metadataKnown(t={}){
  const soc=socials(t);
  if(soc.twitter||soc.website||soc.telegram)return true;

  // A token with no fetchable metadata URI has no pending metadata step:
  // absence of a requested social is therefore definitive.
  const uri=firstText(t.uri,t.metadataUri,t.metadata_url,t.metadataUrl);
  if(!uri)return true;

  // A transient metadata fetch error is not proof that socials are absent.
  if(t.metadataResolved===false||t.metadataError)return false;

  // If a metadata request completed successfully, socials are now known.
  return Boolean(
    t.metadataReady===true||
    t.metadataFetched===true||
    t.metadataResolved===true||
    finite(t.metadataFetchedAt)
  );
}"""
if s.count(old) != 1:
    raise SystemExit("evaluate metadataKnown anchor mismatch")
s = s.replace(old, new, 1)

old = """  const addMin=(name,value,limit,reason,zeroDisables=true)=>{
    if(!finite(limit))return;const x=Number(limit);if(zeroDisables&&x<=0)return;
    addGate(name,value===null?null:value>=x,reason,{value,threshold:x,operator:'>='});
  };
  const addMax=(name,value,limit,reason)=>{
    if(!finite(limit))return;const x=Number(limit);
    addGate(name,value===null?null:value<=x,reason,{value,threshold:x,operator:'<='});
  };"""
new = """  const addMin=(name,value,limit,reason,zeroDisables=true)=>{
    if(!finite(limit))return;const x=Number(limit);if(zeroDisables&&x<=0)return;
    const pending=`${name.replace(/^(Minimum|Maximum)\\s+/,'')} data pending`;
    addGate(name,value===null?null:value>=x,value===null?pending:reason,{value,threshold:x,operator:'>='});
  };
  const addMax=(name,value,limit,reason)=>{
    if(!finite(limit))return;const x=Number(limit);
    const pending=`${name.replace(/^(Minimum|Maximum)\\s+/,'')} data pending`;
    addGate(name,value===null?null:value<=x,value===null?pending:reason,{value,threshold:x,operator:'<='});
  };"""
if s.count(old) != 1:
    raise SystemExit("evaluate addMin/addMax anchor mismatch")
s = s.replace(old, new, 1)

old = """  if(s.requireFreshHolderSnapshot===true)addGate('Fresh holder snapshot',token.holderFresh==null?null:token.holderFresh===true,'holder snapshot unavailable');"""
new = """  if(s.requireFreshHolderSnapshot===true)addGate('Fresh holder snapshot',token.holderFresh===true?true:null,'holder snapshot data pending');"""
if s.count(old) != 1:
    raise SystemExit("evaluate fresh-holder anchor mismatch")
s = s.replace(old, new, 1)

old = """  const minScore=finite(s.minScore)?Number(s.minScore):null;
  const minConfidence=finite(s.minConfidence)?Number(s.minConfidence):null;
  const scorePass=minScore===null||score>=minScore;
  const confPass=minConfidence===null||confidence>=minConfidence;
  gates.push({name:'Minimum AI score',status:scorePass?'PASS':'FAIL',pass:scorePass,value:score,threshold:minScore});
  if(!scorePass){blocked=true;reasons.push(`AI score ${score} below configured minimum ${minScore}`)}
  gates.push({name:'Minimum data confidence',status:confPass?'PASS':'FAIL',pass:confPass,value:confidence,threshold:minConfidence});
  if(!confPass){blocked=true;reasons.push(`data confidence ${confidence}% below configured minimum ${minConfidence}%`)}

  const state=blocked?'BLOCKED':waiting?'WAITING':scorePass&&confPass?'BUY READY':'WATCH';"""
new = """  const minScore=finite(s.minScore)?Number(s.minScore):null;
  const minConfidence=finite(s.minConfidence)?Number(s.minConfidence):null;
  const scorePass=minScore===null||score>=minScore;
  const confPass=minConfidence===null||confidence>=minConfidence;

  // AI score/confidence are derived from the same async evidence as the hard gates.
  // If any enabled evidence is still pending, low partial-data scores are not a reject.
  const scoreStatus=waiting?'WAITING':scorePass?'PASS':'FAIL';
  const confStatus=waiting?'WAITING':confPass?'PASS':'FAIL';
  gates.push({name:'Minimum AI score',status:scoreStatus,pass:scoreStatus==='PASS',value:score,threshold:minScore});
  if(!waiting&&!scorePass){blocked=true;reasons.push(`AI score ${score} below configured minimum ${minScore}`)}
  gates.push({name:'Minimum data confidence',status:confStatus,pass:confStatus==='PASS',value:confidence,threshold:minConfidence});
  if(!waiting&&!confPass){blocked=true;reasons.push(`data confidence ${confidence}% below configured minimum ${minConfidence}%`)}

  const state=blocked?'BLOCKED':waiting?'WAITING':scorePass&&confPass?'BUY READY':'WATCH';"""
if s.count(old) != 1:
    raise SystemExit("evaluate score/confidence anchor mismatch")
s = s.replace(old, new, 1)

if s.count("`holders above ${s.maxHolders}`") != 1:
    raise SystemExit("evaluate max holders diagnostic anchor mismatch")
s = s.replace("`holders above ${s.maxHolders}`", "`holders above maximum ${s.maxHolders}`", 1)

if s.count("'developer wallet is blacklisted'") != 1:
    raise SystemExit("evaluate developer blacklist diagnostic anchor mismatch")
s = s.replace("'developer wallet is blacklisted'", "'Developer wallet is blacklisted'", 1)

p.write_text(s, encoding="utf-8")

# ---------------------------------------------------------------------------
# 2) Metadata enrichment: reuse the existing metadata fetch to collect socials.
#    No new HTTP request is added.
# ---------------------------------------------------------------------------
p = Path("src/enrich.mjs")
s = p.read_text(encoding="utf-8")

anchor = """function firstMetadataImage(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  const values = [
    metadata.image,
    metadata.image_url,
    metadata.imageUrl,
    metadata.logo,
    metadata.logo_url,
    metadata.logoUrl,
    metadata.icon,
    metadata.icon_url,
    metadata.iconUrl,
    metadata.properties?.files?.[0]?.uri,
    metadata.properties?.files?.[0]?.url
  ];
  for (const value of values) {
    const normalized = normalizeMetadataUrl(value);
    if (normalized) return normalized;
  }
  return null;
}
"""
insert = anchor + """
function firstMetadataText(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (text) return text.slice(0, 500);
  }
  return null;
}

function firstMetadataSocials(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return {twitter:null, website:null, telegram:null};
  }
  const ext = metadata.extensions || metadata.extension || {};
  const links = metadata.links || metadata.socials || {};
  return {
    twitter:firstMetadataText(
      metadata.twitter, metadata.x, metadata.twitter_url, metadata.x_url,
      ext.twitter, ext.x, ext.twitter_url, ext.x_url,
      links.twitter, links.x
    ),
    website:firstMetadataText(
      metadata.website, metadata.website_url, metadata.external_url,
      ext.website, ext.website_url, ext.external_url,
      links.website
    ),
    telegram:firstMetadataText(
      metadata.telegram, metadata.telegram_url,
      ext.telegram, ext.telegram_url,
      links.telegram
    )
  };
}
"""
if s.count(anchor) != 1:
    raise SystemExit("enrich firstMetadataImage anchor mismatch")
s = s.replace(anchor, insert, 1)

old = """  if (!metadataUrl) return {metadataUrl:null, imageUrl:null};"""
new = """  if (!metadataUrl) return {metadataUrl:null, imageUrl:null, twitter:null, website:null, telegram:null};"""
if s.count(old) != 1:
    raise SystemExit("enrich invalid metadata URL anchor mismatch")
s = s.replace(old, new, 1)

old = """    const metadata = await response.json();
    return {
      metadataUrl,
      imageUrl:firstMetadataImage(metadata),
      metadataName:typeof metadata?.name === 'string' ? metadata.name.slice(0,160) : null,
      metadataSymbol:typeof metadata?.symbol === 'string' ? metadata.symbol.slice(0,40) : null
    };"""
new = """    const metadata = await response.json();
    const social=firstMetadataSocials(metadata);
    return {
      metadataUrl,
      imageUrl:firstMetadataImage(metadata),
      metadataName:typeof metadata?.name === 'string' ? metadata.name.slice(0,160) : null,
      metadataSymbol:typeof metadata?.symbol === 'string' ? metadata.symbol.slice(0,40) : null,
      twitter:social.twitter,
      website:social.website,
      telegram:social.telegram
    };"""
if s.count(old) != 1:
    raise SystemExit("enrich metadata return anchor mismatch")
s = s.replace(old, new, 1)

old = """        metadataPatch = {
          metadataFetchedAt:Date.now(),
          metadataUrl:metadata.metadataUrl,
          imageUrl:metadata.imageUrl,
          image:metadata.imageUrl,
          logoUrl:metadata.imageUrl,
          metadataName:metadata.metadataName,
          metadataSymbol:metadata.metadataSymbol
        };"""
new = """        metadataPatch = {
          metadataFetchedAt:Date.now(),
          metadataResolved:true,
          metadataUrl:metadata.metadataUrl,
          imageUrl:metadata.imageUrl,
          image:metadata.imageUrl,
          logoUrl:metadata.imageUrl,
          metadataName:metadata.metadataName,
          metadataSymbol:metadata.metadataSymbol,
          ...(metadata.twitter?{twitter:metadata.twitter}:{}),
          ...(metadata.website?{website:metadata.website}:{}),
          ...(metadata.telegram?{telegram:metadata.telegram}:{})
        };"""
if s.count(old) != 1:
    raise SystemExit("enrich metadata patch anchor mismatch")
s = s.replace(old, new, 1)

old = """        metadataPatch = {
          metadataFetchedAt:Date.now(),
          metadataError:sanitize(error?.message || String(error))
        };"""
new = """        metadataPatch = {
          metadataFetchedAt:Date.now(),
          metadataResolved:false,
          metadataError:sanitize(error?.message || String(error))
        };"""
if s.count(old) != 1:
    raise SystemExit("enrich metadata error patch anchor mismatch")
s = s.replace(old, new, 1)

p.write_text(s, encoding="utf-8")

# ---------------------------------------------------------------------------
# 3) Live feed lifecycle: hide dead/stale rows only when the feed is READ.
#    This has zero RPC/OpenAI/disk activity and never enters the scanner hot path.
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

function tokenActivityAt(token={},decision={}){
  // Polling/metadata refresh is not market activity.
  for(const v of [
    token.lastMarketActivityAt,
    token.lastPriceChangeAt,
    token.discoveredAt,
    token.createdAt,
    token.firstSeenAt,
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
  if(state==='BUY READY')return false;

  const activity=tokenActivityAt(token,decision);
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
  if(state==='WATCH'&&!closed)return 'watch';
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
  const kindOf=row=>classifyDecisionVisibility(row,lookupToken(tokenLookup,row?.mint),now);

  if(normalized==='audit')return rows;
  if(normalized==='archived')return rows.filter(x=>kindOf(x)==='archived');
  if(normalized==='all')return rows.filter(x=>kindOf(x)!=='archived');
  if(normalized==='processing'||normalized==='waiting')return rows.filter(x=>kindOf(x)==='processing');
  if(normalized==='watch')return rows.filter(x=>kindOf(x)==='watch');
  if(normalized==='filtered'||normalized==='blocked')return rows.filter(x=>kindOf(x)==='filtered');
  if(normalized==='candidate'||normalized==='candidates'||normalized==='buy-ready'||normalized==='buy_ready'){
    return rows.filter(x=>kindOf(x)==='candidate');
  }
  return rows.filter(x=>kindOf(x)==='candidate');
}

export function candidateVisibilityCounts(decisions=[],tokenLookup=null,now=Date.now()){
  const counts={
    candidates:0,
    processing:0,
    filtered:0,
    watch:0,
    archived:0,
    visible:0,
    totalEvaluated:0,
    buyReady:0,
    waiting:0,
    blocked:0,
    all:0
  };

  for(const row of Array.isArray(decisions)?decisions:[]){
    if(!row)continue;
    counts.totalEvaluated++;

    const kind=classifyDecisionVisibility(row,lookupToken(tokenLookup,row?.mint),now);
    if(kind==='archived'){
      counts.archived++;
      continue;
    }

    counts.visible++;
    counts.all++;

    if(kind==='candidate'){
      counts.candidates++;
      counts.buyReady++;
    }else if(kind==='processing'){
      counts.processing++;
      counts.waiting++;
    }else if(kind==='watch'){
      counts.watch++;
    }else{
      counts.filtered++;
      if(String(row.state||'').toUpperCase()==='BLOCKED')counts.blocked++;
    }
  }
  return counts;
}
""", encoding="utf-8")

# ---------------------------------------------------------------------------
# 4) Feed endpoint supplies token activity to lifecycle classifier.
# ---------------------------------------------------------------------------
replace_once(
    "app-server.mjs",
    """  const _all=store.decisions(u.id);
  const _selected=candidateFeed(_all,_scope);
  const _counts=candidateVisibilityCounts(_all);""",
    """  const _all=store.decisions(u.id);
  const _tokenLookup=(mint)=>store.state.tokens?.[mint]||null;
  const _selected=candidateFeed(_all,_scope,_tokenLookup);
  const _counts=candidateVisibilityCounts(_all,_tokenLookup);""",
    "app-server candidate feed"
)

# ---------------------------------------------------------------------------
# 5) Store: UI polling updates lastActiveAt in memory but persists at most
#    once per 30s/user. Also add the deleteDecision API liveeval already expects.
# ---------------------------------------------------------------------------
p = Path("src/store.mjs")
s = p.read_text(encoding="utf-8")

old = """    this._lastPruneAt=0;
    this._tokenCount=0;
    this.maxTokens=Math.max(250,Math.floor(envNum('STORE_MAX_TOKENS',2000,250)));"""
new = """    this._lastPruneAt=0;
    this._tokenCount=0;
    this._lastTouchPersist=new Map();
    this.touchSaveIntervalMs=Math.max(5000,envNum('STORE_TOUCH_SAVE_INTERVAL_MS',30000,5000));
    this.maxTokens=Math.max(250,Math.floor(envNum('STORE_MAX_TOKENS',2000,250)));"""
if s.count(old) != 1:
    raise SystemExit("store constructor anchor mismatch")
s = s.replace(old, new, 1)

old = """  touchUser(id){this.user(id).lastActiveAt=Date.now();this.save();return this.user(id)}"""
new = """  touchUser(id){
    const u=this.user(id),now=Date.now();
    u.lastActiveAt=now;
    const last=this._lastTouchPersist.get(id)||0;
    if(now-last>=this.touchSaveIntervalMs){
      this._lastTouchPersist.set(id,now);
      this.save();
    }
    return u;
  }"""
if s.count(old) != 1:
    raise SystemExit("store touchUser anchor mismatch")
s = s.replace(old, new, 1)

old = """    // Decisions are intentionally in-memory only; do not schedule a disk write.
  }
  decisions(uid){"""
new = """    // Decisions are intentionally in-memory only; do not schedule a disk write.
  }
  deleteDecision(uid,mint){
    const key=uid+':'+mint;
    const existed=Boolean(this.state.decisions[key]);
    delete this.state.decisions[key];
    const m=this._uidDec[uid];
    if(m){
      m.delete(key);
      if(!m.size)delete this._uidDec[uid];
    }
    return existed;
  }
  decisions(uid){"""
if s.count(old) != 1:
    raise SystemExit("store deleteDecision insertion anchor mismatch")
s = s.replace(old, new, 1)

p.write_text(s, encoding="utf-8")

# ---------------------------------------------------------------------------
# 6) OpenAI: Strategy Coach is proposal-only by default.
#    Explicit /strategy/apply is treated as owner-confirmed and goes through
#    canonical settings validation + settings audit.
# ---------------------------------------------------------------------------
p = Path("src/openai-intelligence.mjs")
s = p.read_text(encoding="utf-8")

if not s.startswith("const OPENAI_URL="):
    raise SystemExit("openai file header anchor mismatch")
s = "import {validateSettings} from './settings.mjs';\n" + s

old = """    enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:true,"""
new = """    enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:false,"""
if s.count(old) != 1:
    raise SystemExit("openai default autoOptimize anchor mismatch")
s = s.replace(old, new, 1)

old = """    u.ai.settings={...aiDefaults(),...(u.ai.settings||{})};"""
new = """    u.ai.settings={...aiDefaults(),...(u.ai.settings||{}),autoOptimize:false};"""
if s.count(old) != 1:
    raise SystemExit("openai persisted settings anchor mismatch")
s = s.replace(old, new, 1)

old = """  async applyProposal(uid,proposal){
    const ai=this.userState(uid),cfg=ai.settings;if(!cfg.autoOptimize)return {applied:false,reason:'AUTO_OPTIMIZE_DISABLED'};
    const allowed=cfg.allowedAutoTune?.[proposal.setting];if(!allowed)return {applied:false,reason:'SETTING_NOT_ALLOWED'};
    if((cfg.lockedSettings||[]).includes(proposal.setting))return {applied:false,reason:'SETTING_LOCKED'};
    if(Number(proposal.confidence)<80)return {applied:false,reason:'CONFIDENCE_BELOW_80'};
    const current=this.store.settings(uid),n=Number(proposal.proposed);if(!Number.isFinite(n))return {applied:false,reason:'NON_NUMERIC_PROPOSAL'};
    const next={...current,[proposal.setting]:clamp(n,Number(allowed.min),Number(allowed.max))};this.store.setSettings(uid,next);
    this.audit(uid,'auto_optimize',{setting:proposal.setting,from:current[proposal.setting],to:next[proposal.setting]});return {applied:true,setting:proposal.setting,value:next[proposal.setting]};
  }"""
new = """  async applyProposal(uid,proposal,{confirmed=false}={}){
    if(confirmed!==true)return {applied:false,reason:'OWNER_CONFIRMATION_REQUIRED'};
    const ai=this.userState(uid),cfg=ai.settings;
    const allowed=cfg.allowedAutoTune?.[proposal.setting];if(!allowed)return {applied:false,reason:'SETTING_NOT_ALLOWED'};
    if((cfg.lockedSettings||[]).includes(proposal.setting))return {applied:false,reason:'SETTING_LOCKED'};
    if(Number(proposal.confidence)<80)return {applied:false,reason:'CONFIDENCE_BELOW_80'};
    const current=this.store.settings(uid),n=Number(proposal.proposed);if(!Number.isFinite(n))return {applied:false,reason:'NON_NUMERIC_PROPOSAL'};
    const candidate={...current,[proposal.setting]:clamp(n,Number(allowed.min),Number(allowed.max))};
    const validated=validateSettings(candidate);
    if(!validated.ok)return {applied:false,reason:'SETTINGS_VALIDATION_FAILED',errors:validated.errors};
    const next=this.store.setSettings(uid,validated.settings);
    this.store.recordSettingsChange?.(uid,current,next,{actor:uid,source:'openai_strategy_user_apply'});
    this.audit(uid,'strategy_apply_user',{setting:proposal.setting,from:current[proposal.setting],to:next[proposal.setting]});
    return {applied:true,setting:proposal.setting,value:next[proposal.setting],confirmed:true};
  }"""
if s.count(old) != 1:
    raise SystemExit("openai applyProposal anchor mismatch")
s = s.replace(old, new, 1)

old = """      if(url.pathname==='/api/openai/settings'&&req.method==='PUT'){const b=await readBody(req),ai=this.userState(uid),next={...ai.settings,...(b.settings||{}),updatedAt:now()};delete next.userId;ai.settings=next;this.save();return {status:200,body:{settings:ai.settings}}}"""
new = """      if(url.pathname==='/api/openai/settings'&&req.method==='PUT'){const b=await readBody(req),ai=this.userState(uid),next={...ai.settings,...(b.settings||{}),autoOptimize:false,updatedAt:now()};delete next.userId;ai.settings=next;this.save();return {status:200,body:{settings:ai.settings}}}"""
if s.count(old) != 1:
    raise SystemExit("openai settings PUT anchor mismatch")
s = s.replace(old, new, 1)

old = """      if(url.pathname==='/api/openai/strategy/apply'&&req.method==='POST'){const b=await readBody(req);return {status:200,body:await this.applyProposal(uid,b.proposal||{})}}"""
new = """      if(url.pathname==='/api/openai/strategy/apply'&&req.method==='POST'){const b=await readBody(req);return {status:200,body:await this.applyProposal(uid,b.proposal||{},{confirmed:true})}}"""
if s.count(old) != 1:
    raise SystemExit("openai strategy apply route anchor mismatch")
s = s.replace(old, new, 1)

p.write_text(s, encoding="utf-8")

# ---------------------------------------------------------------------------
# 7) Execution gate: feeReserve now actually reserves capital.
# ---------------------------------------------------------------------------
p = Path("src/paper-engine.mjs")
s = p.read_text(encoding="utf-8")

old = """      dailyLossLimit: Math.max(0, num(settings.dailyLossLimit, 0)),
      hardStopPct:"""
new = """      dailyLossLimit: Math.max(0, num(settings.dailyLossLimit, 0)),
      feeReserve: Math.max(0, num(settings.feeReserve, 0.05)),
      hardStopPct:"""
if s.count(old) != 1:
    raise SystemExit("paper feeReserve settings anchor mismatch")
s = s.replace(old, new, 1)

old = """    const capitalAvailable =
      s.tradingCapital <= 0 ||
      deployed + s.positionSize <= s.tradingCapital;"""
new = """    const tradableCapital =
      s.tradingCapital <= 0
        ? 0
        : Math.max(0, s.tradingCapital - Math.min(s.feeReserve, s.tradingCapital));

    const capitalAvailable =
      s.tradingCapital <= 0 ||
      deployed + s.positionSize <= tradableCapital;"""
if s.count(old) != 1:
    raise SystemExit("paper capitalAvailable anchor mismatch")
s = s.replace(old, new, 1)

old = """        deployed,
        tradingCapital: s.tradingCapital,
        dailyRealizedPnl,"""
new = """        deployed,
        tradingCapital: s.tradingCapital,
        feeReserve: s.feeReserve,
        tradableCapital,
        dailyRealizedPnl,"""
if s.count(old) != 1:
    raise SystemExit("paper metrics anchor mismatch")
s = s.replace(old, new, 1)

p.write_text(s, encoding="utf-8")

# ---------------------------------------------------------------------------
# 8) Regression tests for the unified contract.
# ---------------------------------------------------------------------------
Path("src/unified-engine.test.mjs").write_text(r"""import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate} from './evaluate.mjs';
import {defaultSettings,normalizeSettings} from './settings.mjs';
import {
  candidateFeed,
  candidateVisibilityCounts,
  classifyDecisionVisibility
} from './candidate-visibility.mjs';
import {PaperEngine} from './paper-engine.mjs';
import {OpenAIIntelligence} from './openai-intelligence.mjs';

const NOW=2_000_000_000_000;
const M=60_000;

test('partial Phase-A evidence stays WAITING instead of false BLOCKED',()=>{
  const s=normalizeSettings(defaultSettings());
  const d=evaluate({
    mint:'MintPending',
    uri:'https://example.invalid/meta.json',
    discoveredAt:NOW,
    holderFresh:false,
    holderCount:null,
    top10Pct:null,
    developerPct:null,
    buyPressure:null,
    priceSol:null,
    dataQuality:0
  },s);
  assert.equal(d.state,'WAITING');
  assert.equal(d.settingsEvaluation.gates.find(g=>g.name==='Minimum AI score')?.status,'WAITING');
  assert.equal(d.settingsEvaluation.gates.find(g=>g.name==='Minimum data confidence')?.status,'WAITING');
  assert.match(d.reasons.join(' '),/data pending|Waiting:/);
});

test('known hard-gate failure still BLOCKS even while other evidence is pending',()=>{
  const s=normalizeSettings({...defaultSettings(),minHolders:30});
  const d=evaluate({
    discoveredAt:NOW,
    holderFresh:true,
    holderCount:5,
    top10Pct:null,
    developerPct:null,
    buyPressure:null,
    priceSol:null,
    dataQuality:0.2
  },s);
  assert.equal(d.state,'BLOCKED');
  assert.match(d.reasons.join(' '),/holders below 30/);
});

test('social gate waits for fetchable metadata, then becomes definitive',()=>{
  const s=normalizeSettings({
    ...defaultSettings(),
    requireAnySocial:true,
    minHolders:null,
    maxTop10Pct:null,
    maxDeveloperPct:null,
    minBuyPressure:0,
    requireFreshHolderSnapshot:false,
    minScore:0,
    minConfidence:0
  });

  const pending=evaluate({
    uri:'https://example.invalid/meta.json',
    discoveredAt:NOW,
    priceSol:1
  },s);
  assert.equal(pending.state,'WAITING');

  const missing=evaluate({
    uri:'https://example.invalid/meta.json',
    metadataFetchedAt:NOW,
    discoveredAt:NOW,
    priceSol:1
  },s);
  assert.equal(missing.state,'BLOCKED');
  assert.match(missing.reasons.join(' '),/at least one social link is required/);

  const present=evaluate({
    uri:'https://example.invalid/meta.json',
    metadataFetchedAt:NOW,
    twitter:'https://x.com/example',
    discoveredAt:NOW,
    priceSol:1
  },s);
  assert.notEqual(present.state,'BLOCKED');
});

test('stale terminal rows leave LIVE only; audit/archive retain them in memory',()=>{
  const rows=[
    {mint:'dead',state:'BLOCKED',updatedAt:NOW-M},
    {mint:'recent',state:'BLOCKED',updatedAt:NOW-M},
    {mint:'waiting',state:'WAITING',updatedAt:NOW-M},
    {mint:'watch',state:'WATCH',updatedAt:NOW-M},
    {mint:'ready',state:'BUY READY',updatedAt:NOW-M}
  ];
  const tokens={
    dead:{lastMarketActivityAt:NOW-16*M,discoveredAt:NOW-20*M},
    recent:{lastMarketActivityAt:NOW-2*M,discoveredAt:NOW-20*M},
    waiting:{lastMarketActivityAt:NOW-61*M,discoveredAt:NOW-70*M},
    watch:{lastMarketActivityAt:NOW-61*M,discoveredAt:NOW-70*M},
    ready:{lastMarketActivityAt:NOW-180*M,discoveredAt:NOW-200*M}
  };
  const lookup=m=>tokens[m];

  assert.equal(classifyDecisionVisibility(rows[0],tokens.dead,NOW),'archived');
  assert.deepEqual(candidateFeed(rows,'all',lookup,NOW).map(x=>x.mint),['recent','ready']);
  assert.equal(candidateFeed(rows,'audit',lookup,NOW).length,5);
  assert.deepEqual(candidateFeed(rows,'archived',lookup,NOW).map(x=>x.mint),['dead','waiting','watch']);

  const c=candidateVisibilityCounts(rows,lookup,NOW);
  assert.equal(c.all,2);
  assert.equal(c.archived,3);
  assert.equal(c.buyReady,1);
  assert.equal(c.blocked,1);
});

test('feeReserve is excluded from tradable paper capital',()=>{
  const store={
    state:{
      users:{u:{id:'u',killSwitch:false}},
      paperPositions:{},paperTrades:{},paperProposals:{},paperProcessed:{},
      paperMetrics:{entries:0,exits:0,errors:0}
    },
    save(){}
  };
  const engine=new PaperEngine(store,{clock:()=>NOW});
  const readiness=engine.entryReadiness('u',{
    mint:'MintFee',
    priceSol:1,
    holderFresh:true,
    updatedAt:NOW
  },{
    operatingMode:'automate',
    tradingEnvironment:'paper',
    tradingCapital:1,
    feeReserve:0.1,
    positionSize:0.95,
    maxPositionSize:1,
    maxOpenPositions:4,
    maxDailyEntries:10,
    dailySpendLimit:0,
    dailyLossLimit:0,
    requireFreshHolderSnapshot:true,
    decisionFreshnessSec:60
  });
  const capital=readiness.checks.find(x=>x.key==='paperCapital');
  assert.equal(capital.pass,false);
  assert.equal(readiness.metrics.tradableCapital,0.9);
});

test('OpenAI strategy cannot auto-mutate; explicit apply uses canonical validation',async()=>{
  const state={
    users:{u:{id:'u',settings:defaultSettings()}},
    tokens:{},decisions:{},settingsAudit:{}
  };
  const store={
    state,
    user(id){return this.state.users[id]},
    settings(id){return this.state.users[id].settings},
    decisions(){return[]},
    save(){},
    setSettings(id,s){this.state.users[id].settings=normalizeSettings(s);return this.state.users[id].settings},
    recordSettingsChange(id,before,after,meta){
      this.state.settingsAudit[id]||=[];
      this.state.settingsAudit[id].push({before,after,meta});
    }
  };

  const ai=new OpenAIIntelligence({store});
  assert.equal(ai.userState('u').settings.autoOptimize,false);

  const proposal={setting:'minScore',proposed:80,confidence:90};
  const denied=await ai.applyProposal('u',proposal);
  assert.equal(denied.applied,false);
  assert.equal(denied.reason,'OWNER_CONFIRMATION_REQUIRED');

  const applied=await ai.applyProposal('u',proposal,{confirmed:true});
  assert.equal(applied.applied,true);
  assert.equal(store.settings('u').minScore,80);
  assert.equal(state.settingsAudit.u.length,1);
});
""", encoding="utf-8")

# ---------------------------------------------------------------------------
# 9) Make the canonical contract tests part of normal npm test.
# ---------------------------------------------------------------------------
p = Path("package.json")
pkg = json.loads(p.read_text(encoding="utf-8"))
old_test = pkg.get("scripts",{}).get("test")
expected = "node tests/integration.mjs && node tests/billing-cycle.mjs && node tests/owner-live.mjs"
if old_test != expected:
    raise SystemExit(f"package.json test script changed: {old_test!r}")
pkg["scripts"]["test"] = (
    "node --test src/filter-upgrade.test.mjs src/unified-engine.test.mjs"
    " && node tests/integration.mjs"
    " && node tests/billing-cycle.mjs"
    " && node tests/owner-live.mjs"
)
p.write_text(json.dumps(pkg, indent=2) + "\n", encoding="utf-8")
PY

log "Static guardrails..."
node --check src/evaluate.mjs
node --check src/enrich.mjs
node --check src/candidate-visibility.mjs
node --check src/store.mjs
node --check src/openai-intelligence.mjs
node --check src/paper-engine.mjs
node --check app-server.mjs
node --check src/unified-engine.test.mjs
git diff --check

# Hot-path invariant: evaluator/liveeval must not gain network/OpenAI/disk work.
if grep -Eq '\bfetch\s*\(|OPENAI_URL|fs\.|writeFile|rename\(' src/evaluate.mjs src/liveeval.mjs; then
  die "Hot-path guardrail failed: network/disk marker found in evaluate/liveeval."
fi

log "Canonical evaluator + lifecycle + execution tests..."
node --test src/filter-upgrade.test.mjs src/unified-engine.test.mjs

log "Existing project integration tests..."
npm test

trap - ERR INT TERM

log "SUCCESS: $PATCH_NAME"
log "Backup: $BACKUP"
log "No scanner RPC, OpenAI request, or disk write was added to discovery -> diagnostics -> decision."
log "Important behavior:"
log "  - Missing async evidence => WAITING, not false BLOCKED."
log "  - Known failed hard gate => BLOCKED immediately."
log "  - Existing metadata HTTP fetch now also extracts Twitter/X, website and Telegram."
log "  - BLOCKED/terminal tokens leave LIVE after 15m of no market activity."
log "  - WAITING/WATCH leave LIVE after 60m of no market activity."
log "  - BUY READY is never removed by this inactivity cleanup."
log "  - audit/archived scopes retain rows while decisions remain in memory."
log "  - UI activity persistence is throttled to reduce state.json churn."
log "  - feeReserve is now enforced by Paper Engine capital checks."
log "  - OpenAI can propose settings; only explicit strategy/apply can change them."
log ""
log "Review changes with:"
log "git diff -- src/evaluate.mjs src/enrich.mjs src/candidate-visibility.mjs src/store.mjs src/openai-intelligence.mjs src/paper-engine.mjs app-server.mjs package.json src/unified-engine.test.mjs"
