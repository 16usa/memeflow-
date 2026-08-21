#!/usr/bin/env bash
set -Eeuo pipefail

EXPECTED_HEAD="b4d3d18842191afc3cb87c6737dc86723af4aab0"
PATCH_ID="MEMEFLOW_UNIFIED_ENGINE_V1_B4D3D18"

log(){ printf '[PATCH] %s\n' "$*"; }
die(){ log "STOP: $*"; exit 1; }

# Replit can open either the repository root or the memeflow-app subdirectory.
if [[ -f "src/evaluate.mjs" && -f "app-server.mjs" ]]; then
  APP_ROOT="."
elif [[ -f "memeflow-app/src/evaluate.mjs" && -f "memeflow-app/app-server.mjs" ]]; then
  APP_ROOT="memeflow-app"
else
  die "Cannot find MEMEFLOW app root."
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$REPO_ROOT" ]] || die "Not inside the MEMEFLOW git repository."

HEAD_NOW="$(git rev-parse HEAD)"
[[ "$HEAD_NOW" == "$EXPECTED_HEAD" ]] || die "Patch is built for $EXPECTED_HEAD, current HEAD is $HEAD_NOW. Nothing changed."

cd "$APP_ROOT"

TARGETS=(
  "src/evaluate.mjs"
  "src/enrich.mjs"
  "src/dex-verification-gate.mjs"
  "src/candidate-visibility.mjs"
  "src/openai-intelligence.mjs"
  "src/store.mjs"
  "src/paper-engine.mjs"
  "src/filter-upgrade.test.mjs"
  "app-server.mjs"
  "package.json"
)

log "Preflight on exact pushed commit ${EXPECTED_HEAD:0:7}..."
for f in "${TARGETS[@]}"; do
  [[ -f "$f" ]] || die "Missing required file: $f"
  git diff --quiet -- "$f" || die "$f has local unstaged edits. Nothing changed."
  git diff --cached --quiet -- "$f" || die "$f has staged edits. Nothing changed."
done

for f in src/candidate-visibility-lifecycle.test.mjs src/unified-mechanism.test.mjs; do
  [[ ! -e "$f" ]] || die "$f already exists. Nothing changed."
done

BACKUP=".memeflow-unified-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/src"
for f in "${TARGETS[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  code=$?
  log "Validation failed — restoring exact pre-patch files..."
  for f in "${TARGETS[@]}"; do
    cp "$BACKUP/$f" "$f" || true
  done
  rm -f src/candidate-visibility-lifecycle.test.mjs src/unified-mechanism.test.mjs
  log "Rollback complete. Backup kept at $BACKUP"
  exit "$code"
}
trap rollback ERR INT TERM

log "Applying unified Settings → Evaluator → Lifecycle → Strategy architecture..."

python3 - <<'PY'
from pathlib import Path
import json
import re

def read(path):
    return Path(path).read_text(encoding="utf-8")

def write(path, text):
    Path(path).write_text(text, encoding="utf-8")

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 compatible anchor, found {count}")
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------------
# 1) CANONICAL EVALUATOR
#    Missing/in-flight data => WAITING, known hard failure => BLOCKED.
#    This prevents Phase-A partial data from being mislabeled as a final reject.
# ---------------------------------------------------------------------------
p = "src/evaluate.mjs"
s = read(p)

# DEX score has no reliable developer/creator component. Normalize its 80-point
# available score back to 0..100 so minScore has the same meaning on Pump/DEX.
old = """function independentAiScore(token={}){
  let score=0; const quality=[];
  const h=firstFinite(token.holderCount,token.holders,token.holder?.count);
  if(h!==null){let p=0;if(h>=100)p=20;else if(h>=60)p=17;else if(h>=30)p=13;else if(h>=15)p=7;else if(h>0)p=3;score+=p;quality.push({key:'holders',value:h,points:p,maxPoints:20})}
  const t=firstFinite(token.top10Pct,token.top10,token.holder?.top10Pct);
  if(t!==null){let p=0;if(t<=15)p=20;else if(t<=25)p=17;else if(t<=35)p=12;else if(t<=50)p=6;score+=p;quality.push({key:'top10',value:t,points:p,maxPoints:20})}
  const d=firstFinite(token.developerPct,token.developerSharePct,token.creatorPct,token.holder?.developerPct);
  if(d!==null){let p=0;if(d<=5)p=20;else if(d<=10)p=18;else if(d<=20)p=14;else if(d<=30)p=7;score+=p;quality.push({key:'developer',value:d,points:p,maxPoints:20})}
  const b=firstFinite(token.buyPressure,token.momentum,token.market?.buyPressure);
  if(b!==null){let p=0;if(b>=3)p=20;else if(b>=2)p=17;else if(b>=1.5)p=13;else if(b>=1.2)p=9;else if(b>=1)p=4;score+=p;quality.push({key:'buyPressure',value:b,points:p,maxPoints:20})}
  const price=firstFinite(token.priceSol),hasPrice=price!==null&&price>0;
  if(hasPrice)score+=10;quality.push({key:'verifiedPrice',value:hasPrice,points:hasPrice?10:0,maxPoints:10});
  const fresh=token.holderFresh===true;
  if(fresh)score+=10;quality.push({key:'freshHolders',value:fresh,points:fresh?10:0,maxPoints:10});
  return {score:clampScore(score),quality};
}"""
new = """function independentAiScore(token={}){
  let score=0; const quality=[];
  const isDex=String(token?.launchPlatform||'').toLowerCase()==='dex';
  const h=firstFinite(token.holderCount,token.holders,token.holder?.count);
  if(h!==null){let p=0;if(h>=100)p=20;else if(h>=60)p=17;else if(h>=30)p=13;else if(h>=15)p=7;else if(h>0)p=3;score+=p;quality.push({key:'holders',value:h,points:p,maxPoints:20})}
  const t=firstFinite(token.top10Pct,token.top10,token.holder?.top10Pct);
  if(t!==null){let p=0;if(t<=15)p=20;else if(t<=25)p=17;else if(t<=35)p=12;else if(t<=50)p=6;score+=p;quality.push({key:'top10',value:t,points:p,maxPoints:20})}
  if(!isDex){
    const d=firstFinite(token.developerPct,token.developerSharePct,token.creatorPct,token.holder?.developerPct);
    if(d!==null){let p=0;if(d<=5)p=20;else if(d<=10)p=18;else if(d<=20)p=14;else if(d<=30)p=7;score+=p;quality.push({key:'developer',value:d,points:p,maxPoints:20})}
  }
  const b=firstFinite(token.buyPressure,token.momentum,token.market?.buyPressure);
  if(b!==null){let p=0;if(b>=3)p=20;else if(b>=2)p=17;else if(b>=1.5)p=13;else if(b>=1.2)p=9;else if(b>=1)p=4;score+=p;quality.push({key:'buyPressure',value:b,points:p,maxPoints:20})}
  const price=firstFinite(token.priceSol),hasPrice=price!==null&&price>0;
  if(hasPrice)score+=10;quality.push({key:'verifiedPrice',value:hasPrice,points:hasPrice?10:0,maxPoints:10});
  const fresh=token.holderFresh===true;
  if(fresh)score+=10;quality.push({key:'freshHolders',value:fresh,points:fresh?10:0,maxPoints:10});
  const maxPoints=isDex?80:100;
  return {score:clampScore((score/maxPoints)*100),rawScore:score,maxPoints,quality};
}"""
s = replace_once(s, old, new, "independent AI score")

old = """function metadataKnown(t={}){
  return Boolean(t.metadataReady===true||t.metadataFetched===true||t.metadataResolved===true||t.name||t.symbol||t.uri||t.metadataUri);
}"""
new = """function metadataKnown(t={}){
  const soc=socials(t);
  if(soc.twitter||soc.website||soc.telegram)return true;
  if(t.metadataReady===true||t.metadataFetched===true||t.metadataResolved===true)return true;
  return Boolean(t.metadataFetchedAt&&!t.metadataError);
}"""
s = replace_once(s, old, new, "metadata readiness")

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
    const pendingReason=`${name.replace(/^(Minimum|Maximum)\\s+/,'')} data pending`;
    addGate(name,value===null?null:value>=x,value===null?pendingReason:reason,{value,threshold:x,operator:'>='});
  };
  const addMax=(name,value,limit,reason)=>{
    if(!finite(limit))return;const x=Number(limit);
    const pendingReason=`${name.replace(/^(Minimum|Maximum)\\s+/,'')} data pending`;
    addGate(name,value===null?null:value<=x,value===null?pendingReason:reason,{value,threshold:x,operator:'<='});
  };"""
s = replace_once(s, old, new, "numeric gate pending semantics")

old = """  const ai=independentAiScore(token),score=ai.score;
  const completeness=[
    firstFinite(token.holderCount,token.holders,token.holder?.count),
    firstFinite(token.top10Pct,token.top10,token.holder?.top10Pct),
    firstFinite(token.developerPct,token.developerSharePct,token.creatorPct,token.holder?.developerPct),
    firstFinite(token.buyPressure,token.momentum,token.market?.buyPressure),
    firstFinite(token.priceSol)
  ];
  const fallback=completeness.filter(v=>v!==null).length/completeness.length;
  const storedQuality=finite(token.dataQuality)?Math.max(0,Math.min(1,Number(token.dataQuality))):0;
  const q=Math.max(storedQuality,fallback);
  const confidence=clampScore(q*100);"""
new = """  const ai=independentAiScore(token),score=ai.score;
  const isDexToken=String(token?.launchPlatform||'').toLowerCase()==='dex';
  const completeness=[
    firstFinite(token.holderCount,token.holders,token.holder?.count),
    firstFinite(token.top10Pct,token.top10,token.holder?.top10Pct),
    ...(!isDexToken?[firstFinite(token.developerPct,token.developerSharePct,token.creatorPct,token.holder?.developerPct)]:[]),
    firstFinite(token.buyPressure,token.momentum,token.market?.buyPressure),
    firstFinite(token.priceSol)
  ];
  const fallback=completeness.filter(v=>v!==null).length/completeness.length;
  const storedQuality=finite(token.dataQuality)?Math.max(0,Math.min(1,Number(token.dataQuality))):0;
  // dataQuality from Phase A can be 1.0 before holder data exists. It may cap
  // confidence, but it must never hide missing canonical decision inputs.
  const q=storedQuality>0?Math.min(storedQuality,fallback):fallback;
  const confidence=clampScore(q*100);"""
s = replace_once(s, old, new, "confidence completeness")

s = replace_once(
    s,
    "addMax('Maximum holders',v.holders,s.maxHolders,`holders above ${s.maxHolders}`);",
    "addMax('Maximum holders',v.holders,s.maxHolders,`holders above maximum ${s.maxHolders}`);",
    "maximum holder reason"
)
s = replace_once(
    s,
    "addGate('Developer blacklist',creator?!bl.includes(creator):null,'developer wallet is blacklisted');",
    "addGate('Developer blacklist',creator?!bl.includes(creator):null,'Developer wallet is blacklisted');",
    "developer blacklist reason"
)

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
  const coreReady=completeness.every(v=>v!==null)&&(!s.requireFreshHolderSnapshot||token.holderFresh===true);
  const scoreResult=minScore===null?true:(coreReady?score>=minScore:null);
  const confResult=minConfidence===null?true:(confidence>=minConfidence?true:(coreReady?false:null));
  addGate(
    'Minimum AI score',
    scoreResult,
    scoreResult===null?'AI score inputs pending':`AI score ${score} below configured minimum ${minScore}`,
    {value:score,threshold:minScore,operator:'>='}
  );
  addGate(
    'Minimum data confidence',
    confResult,
    confResult===null?'data confidence inputs pending':`data confidence ${confidence}% below configured minimum ${minConfidence}%`,
    {value:confidence,threshold:minConfidence,operator:'>='}
  );
  const scorePass=scoreResult===true;
  const confPass=confResult===true;

  const state=blocked?'BLOCKED':waiting?'WAITING':scorePass&&confPass?'BUY READY':'WATCH';"""
s = replace_once(s, old, new, "AI threshold finality")

write(p, s)

# ---------------------------------------------------------------------------
# 2) METADATA: actually collect social links before social gates finalize.
# ---------------------------------------------------------------------------
p = "src/enrich.mjs"
s = read(p)

old = """    const metadata = await response.json();
    return {
      metadataUrl,
      imageUrl:firstMetadataImage(metadata),
      metadataName:typeof metadata?.name === 'string' ? metadata.name.slice(0,160) : null,
      metadataSymbol:typeof metadata?.symbol === 'string' ? metadata.symbol.slice(0,40) : null
    };"""
new = """    const metadata = await response.json();
    const metadataText=(...values)=>{
      for(const value of values){
        if(typeof value==='string'&&value.trim())return value.trim().slice(0,500);
      }
      return null;
    };
    return {
      metadataUrl,
      imageUrl:firstMetadataImage(metadata),
      metadataName:typeof metadata?.name === 'string' ? metadata.name.slice(0,160) : null,
      metadataSymbol:typeof metadata?.symbol === 'string' ? metadata.symbol.slice(0,40) : null,
      twitter:metadataText(metadata?.twitter,metadata?.x,metadata?.socials?.twitter,metadata?.socials?.x,metadata?.links?.twitter,metadata?.extensions?.twitter),
      website:metadataText(metadata?.website,metadata?.external_url,metadata?.externalUrl,metadata?.socials?.website,metadata?.links?.website,metadata?.extensions?.website),
      telegram:metadataText(metadata?.telegram,metadata?.socials?.telegram,metadata?.links?.telegram,metadata?.extensions?.telegram)
    };"""
s = replace_once(s, old, new, "Pump metadata social extraction")

old = """          metadataName:metadata.metadataName,
          metadataSymbol:metadata.metadataSymbol
        };"""
new = """          metadataName:metadata.metadataName,
          metadataSymbol:metadata.metadataSymbol,
          twitter:metadata.twitter,
          website:metadata.website,
          telegram:metadata.telegram,
          metadataFetched:true,
          metadataResolved:true,
          metadataError:null
        };"""
s = replace_once(s, old, new, "Pump metadata resolved state")

old = """        metadataPatch = {
          metadataFetchedAt:Date.now(),
          metadataError:sanitize(error?.message || String(error))
        };"""
new = """        metadataPatch = {
          metadataFetchedAt:Date.now(),
          metadataResolved:false,
          metadataError:sanitize(error?.message || String(error))
        };"""
s = replace_once(s, old, new, "Pump metadata failure state")

write(p, s)

# ---------------------------------------------------------------------------
# 3) DEX social metadata from the same DexScreener response already in memory.
#    No new HTTP request is introduced.
# ---------------------------------------------------------------------------
p = "src/dex-verification-gate.mjs"
s = read(p)

old = """  const patch = {
    dexConfirmed: true,"""
new = """  const infoWebsites=Array.isArray(pair?.info?.websites)?pair.info.websites:[];
  const infoSocials=Array.isArray(pair?.info?.socials)?pair.info.socials:[];
  const website=infoWebsites.map(x=>x?.url).find(Boolean)||null;
  const twitter=infoSocials.find(x=>String(x?.type||'').toLowerCase()==='twitter')?.url||null;
  const telegram=infoSocials.find(x=>String(x?.type||'').toLowerCase()==='telegram')?.url||null;

  const patch = {
    dexConfirmed: true,
    metadataResolved: true,
    website,
    twitter,
    telegram,"""
s = replace_once(s, old, new, "DEX social extraction")
write(p, s)

# ---------------------------------------------------------------------------
# 4) LIVE FEED LIFECYCLE.
#    Read-time only: no RPC, no OpenAI, no disk await, no scanner dependency.
# ---------------------------------------------------------------------------
write("src/candidate-visibility.mjs", r"""const terminalStates=new Set(['EXPIRED','BLOCKED','REJECTED','CLOSED','IGNORED']);

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
  // Do NOT use token.updatedAt or token.lastPriceAt here:
  // polling the same value must not keep a dead token in the Live feed.
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
  if(state==='BUY READY')return false;

  const activity=tokenActivityAt(token,decision);
  if(activity===null)return false;
  const idle=Math.max(0,Number(now)-activity);

  if(state==='WATCH'||state==='WAITING')return idle>=PASSIVE_LIVE_TTL_MS;
  if(terminalStates.has(state)||decision.terminal===true)return idle>=FILTERED_LIVE_TTL_MS;
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

  // "all" is the current LIVE surface. "audit" is intentionally exhaustive.
  if(normalized==='audit')return rows;
  if(normalized==='archived')return rows.filter(x=>kindOf(x)==='archived');
  if(normalized==='all')return rows.filter(x=>kindOf(x)!=='archived');
  if(normalized==='processing')return rows.filter(x=>kindOf(x)==='processing');
  if(normalized==='watch')return rows.filter(x=>kindOf(x)==='watch');
  if(normalized==='filtered')return rows.filter(x=>kindOf(x)==='filtered');
  return rows.filter(x=>kindOf(x)==='candidate');
}

export function candidateVisibilityCounts(decisions=[],tokenLookup=null,now=Date.now()){
  const counts={
    candidates:0,
    processing:0,
    watch:0,
    filtered:0,
    archived:0,
    visible:0,
    totalEvaluated:0
  };
  for(const row of Array.isArray(decisions)?decisions:[]){
    if(!row)continue;
    counts.totalEvaluated++;
    const kind=classifyDecisionVisibility(row,lookupToken(tokenLookup,row?.mint),now);
    if(kind==='archived'){counts.archived++;continue}
    counts.visible++;
    if(kind==='candidate')counts.candidates++;
    else if(kind==='processing')counts.processing++;
    else if(kind==='watch')counts.watch++;
    else counts.filtered++;
  }
  return counts;
}
""")

# ---------------------------------------------------------------------------
# 5) STORE: decision deletion, activity-save throttling, compact market archive.
#    Decision writes stay memory-only. Archive recording happens from feed reads.
# ---------------------------------------------------------------------------
p = "src/store.mjs"
s = read(p)

s = replace_once(
    s,
    "settingsAudit:{}};",
    "settingsAudit:{},marketOutcomes:{}};",
    "store initial market archive"
)

old = """    this._lastPruneAt=0;
    this._tokenCount=0;
    this.maxTokens="""
new = """    this._lastPruneAt=0;
    this._tokenCount=0;
    this._lastTouchPersist=new Map();
    this.userTouchPersistMs=Math.max(5_000,envNum('STORE_USER_TOUCH_PERSIST_MS',60_000,5_000));
    this.marketOutcomeMax=Math.max(500,Math.floor(envNum('STORE_MARKET_OUTCOME_MAX',5000,500)));
    this.maxTokens="""
s = replace_once(s, old, new, "store runtime throttles")

old = "  touchUser(id){this.user(id).lastActiveAt=Date.now();this.save();return this.user(id)}"
new = """  touchUser(id){
    const u=this.user(id),now=Date.now();
    u.lastActiveAt=now;
    const last=Number(this._lastTouchPersist.get(id)||0);
    if(now-last>=this.userTouchPersistMs){
      this._lastTouchPersist.set(id,now);
      this.save();
    }
    return u;
  }"""
s = replace_once(s, old, new, "touchUser disk throttle")

old = """    if(m.size>250){let ok=null,ot=Infinity;for(const[k,t]of m)if(t<ot){ot=t;ok=k};if(ok){m.delete(ok);delete this.state.decisions[ok]}}
    // Decisions are intentionally in-memory only; do not schedule a disk write.
  }
  decisions(uid){"""
new = """    if(m.size>250){let ok=null,ot=Infinity;for(const[k,t]of m)if(t<ot){ot=t;ok=k};if(ok){m.delete(ok);delete this.state.decisions[ok]}}
    // Decisions are intentionally in-memory only; do not schedule a disk write.
  }
  deleteDecision(uid,mint){
    const key=uid+':'+mint;
    delete this.state.decisions[key];
    const m=this._uidDec[uid];
    if(m){
      m.delete(key);
      if(!m.size)delete this._uidDec[uid];
    }
  }
  decisions(uid){"""
s = replace_once(s, old, new, "deleteDecision implementation")

anchor = """  addToken(t){
"""
methods = r"""  marketOutcomes(limit=500){
    this.state.marketOutcomes||={};
    return Object.values(this.state.marketOutcomes)
      .sort((a,b)=>Number(b.updatedAt||b.archivedAt||0)-Number(a.updatedAt||a.archivedAt||0))
      .slice(0,Math.max(1,Math.min(this.marketOutcomeMax,Number(limit)||500)));
  }

  recordMarketOutcome(token={}){
    const mint=String(token?.mint||'').trim();
    if(!mint)return null;
    this.state.marketOutcomes||={};
    const existing=this.state.marketOutcomes[mint];
    if(existing)return existing;

    const now=Date.now();
    const activity=Number(token.lastMarketActivityAt||token.lastPriceChangeAt||token.discoveredAt||0);
    const discovered=Number(token.discoveredAt||token.createdAt||token.firstSeenAt||0);
    const price=Number(token.priceSol);
    const peak=Number(token.peakPriceSol);
    const drawdownPct=Number.isFinite(price)&&price>=0&&Number.isFinite(peak)&&peak>0
      ? Math.max(0,Math.min(100,(1-price/peak)*100))
      : null;
    const idleMinutes=activity>0?Math.max(0,(now-activity)/60_000):null;
    const ageMinutes=discovered>0?Math.max(0,(now-discovered)/60_000):null;
    const history=Array.isArray(token.antiRugHistory)?token.antiRugHistory:[];
    const early=history[0]||{};

    let label='STALE';
    if(drawdownPct!==null&&drawdownPct>=90)label='COLLAPSED';
    else if(Number(token.holderCount)<=1&&idleMinutes!==null&&idleMinutes>=15)label='DEAD_LIQUIDITY';

    const compact={
      mint,
      status:'ARCHIVED',
      label,
      archivedAt:now,
      updatedAt:now,
      launchPlatform:token.launchPlatform||null,
      early:{
        priceSol:Number.isFinite(Number(early.priceSol))?Number(early.priceSol):null,
        holderCount:Number.isFinite(Number(early.holderCount))?Number(early.holderCount):null,
        top10Pct:Number.isFinite(Number(early.top10Pct))?Number(early.top10Pct):null,
        developerPct:Number.isFinite(Number(early.developerPct))?Number(early.developerPct):null,
        buyPressure:Number.isFinite(Number(early.buyPressure))?Number(early.buyPressure):null
      },
      current:{
        priceSol:Number.isFinite(price)?price:null,
        peakPriceSol:Number.isFinite(peak)?peak:null,
        drawdownPct,
        idleMinutes,
        ageMinutes,
        holderCount:Number.isFinite(Number(token.holderCount))?Number(token.holderCount):null,
        top10Pct:Number.isFinite(Number(token.top10Pct))?Number(token.top10Pct):null,
        developerPct:Number.isFinite(Number(token.developerPct))?Number(token.developerPct):null,
        buyPressure:Number.isFinite(Number(token.buyPressure))?Number(token.buyPressure):null,
        marketCapUsd:Number.isFinite(Number(token.marketCapUsd))?Number(token.marketCapUsd):null,
        liquidityUsd:Number.isFinite(Number(token.liquidityUsd))?Number(token.liquidityUsd):null,
        bondingCurvePct:Number.isFinite(Number(token.bondingCurvePct))?Number(token.bondingCurvePct):null,
        volume24hUsd:Number.isFinite(Number(token.volume24hUsd))?Number(token.volume24hUsd):null,
        buyTransactions:Number.isFinite(Number(token.buyTransactions))?Number(token.buyTransactions):null,
        sellTransactions:Number.isFinite(Number(token.sellTransactions))?Number(token.sellTransactions):null,
        bundlePct:Number.isFinite(Number(token.bundlePct))?Number(token.bundlePct):null,
        sniperPct:Number.isFinite(Number(token.sniperPct))?Number(token.sniperPct):null,
        hasTwitter:Boolean(token.twitter||token.twitterUrl||token.x||token.xUrl),
        hasWebsite:Boolean(token.website||token.websiteUrl),
        hasTelegram:Boolean(token.telegram||token.telegramUrl)
      }
    };

    this.state.marketOutcomes[mint]=compact;
    const rows=Object.values(this.state.marketOutcomes);
    if(rows.length>this.marketOutcomeMax){
      rows.sort((a,b)=>Number(a.updatedAt||a.archivedAt||0)-Number(b.updatedAt||b.archivedAt||0));
      for(const row of rows.slice(0,rows.length-this.marketOutcomeMax))delete this.state.marketOutcomes[row.mint];
    }
    this.save();
    return compact;
  }

  recordMarketRevival(token={}){
    const mint=String(token?.mint||'').trim();
    const row=this.state.marketOutcomes?.[mint];
    if(!mint||!row||row.status!=='ARCHIVED')return row||null;
    const activity=Number(token.lastMarketActivityAt||token.lastPriceChangeAt||0);
    if(!(activity>Number(row.archivedAt||0)))return row;

    row.status='REVIVED';
    row.label='REVIVED';
    row.revivedAt=Date.now();
    row.updatedAt=row.revivedAt;
    row.revival={
      priceSol:Number.isFinite(Number(token.priceSol))?Number(token.priceSol):null,
      holderCount:Number.isFinite(Number(token.holderCount))?Number(token.holderCount):null,
      buyPressure:Number.isFinite(Number(token.buyPressure))?Number(token.buyPressure):null,
      lastMarketActivityAt:activity
    };
    this.save();
    return row;
  }

"""
if anchor not in s:
    raise SystemExit("market outcome method anchor not found")
s = s.replace(anchor, methods + anchor, 1)
write(p, s)

# ---------------------------------------------------------------------------
# 6) PAPER EXECUTION: feeReserve is an execution/capital gate, not AI scoring.
# ---------------------------------------------------------------------------
p = "src/paper-engine.mjs"
s = read(p)

old = """      tradingCapital: Math.max(0, num(settings.tradingCapital, 0)),
      dailyLossLimit: Math.max(0, num(settings.dailyLossLimit, 0)),"""
new = """      tradingCapital: Math.max(0, num(settings.tradingCapital, 0)),
      feeReserve: Math.max(0, num(settings.feeReserve, 0)),
      dailyLossLimit: Math.max(0, num(settings.dailyLossLimit, 0)),"""
s = replace_once(s, old, new, "paper fee reserve normalization")

old = """    const capitalAvailable =
      s.tradingCapital <= 0 ||
      deployed + s.positionSize <= s.tradingCapital;"""
new = """    const usableCapital =
      s.tradingCapital > 0
        ? Math.max(0, s.tradingCapital - Math.min(s.tradingCapital, s.feeReserve))
        : 0;

    const capitalAvailable =
      s.tradingCapital <= 0 ||
      deployed + s.positionSize <= usableCapital;"""
s = replace_once(s, old, new, "paper fee reserve capital gate")

old = """        deployed,
        tradingCapital: s.tradingCapital,
        dailyRealizedPnl,"""
new = """        deployed,
        tradingCapital: s.tradingCapital,
        feeReserve: s.feeReserve,
        usableCapital,
        dailyRealizedPnl,"""
s = replace_once(s, old, new, "paper fee reserve metrics")
write(p, s)

# ---------------------------------------------------------------------------
# 7) OPENAI: Strategy Coach remains useful, but owner policy is proposal-only.
#    Add compact archived/revived market outcomes to strategy context.
# ---------------------------------------------------------------------------
p = "src/openai-intelligence.mjs"
s = read(p)

s = replace_once(
    s,
    "enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:true,",
    "enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:false,",
    "OpenAI default proposal-only"
)
s = replace_once(
    s,
    "u.ai.settings={...aiDefaults(),...(u.ai.settings||{})};",
    "u.ai.settings={...aiDefaults(),...(u.ai.settings||{}),autoOptimize:false};",
    "OpenAI persisted proposal-only"
)

old = """    const recent=ai.outcomes.slice(0,250);if(recent.length<5)return {enabled:true,insufficientData:true,minimum:5,current:recent.length,proposals:[]};
    if(!this.configured())throw Object.assign(new Error('OPENAI_API_KEY is not configured'),{code:'OPENAI_NOT_CONFIGURED'});
    const summary={count:recent.length,wins:recent.filter(x=>x.pnlSol>0).length,losses:recent.filter(x=>x.pnlSol<0).length,pnlSol:recent.reduce((a,x)=>a+x.pnlSol,0),avgPnlPct:recent.reduce((a,x)=>a+x.pnlPct,0)/recent.length,currentSettings:this.store.settings(uid),aiSettings:cfg,recent:recent.slice(0,80)};"""
new = """    const recent=ai.outcomes.slice(0,250),marketArchive=this.store.marketOutcomes?.(500)||[];
    if(recent.length<5&&marketArchive.length<20)return {enabled:true,insufficientData:true,minimumTradeOutcomes:5,minimumMarketOutcomes:20,currentTradeOutcomes:recent.length,currentMarketOutcomes:marketArchive.length,proposals:[]};
    if(!this.configured())throw Object.assign(new Error('OPENAI_API_KEY is not configured'),{code:'OPENAI_NOT_CONFIGURED'});
    const summary={
      count:recent.length,
      wins:recent.filter(x=>x.pnlSol>0).length,
      losses:recent.filter(x=>x.pnlSol<0).length,
      pnlSol:recent.reduce((a,x)=>a+x.pnlSol,0),
      avgPnlPct:recent.length?recent.reduce((a,x)=>a+x.pnlPct,0)/recent.length:0,
      currentSettings:this.store.settings(uid),
      aiSettings:cfg,
      recent:recent.slice(0,80),
      marketArchive:marketArchive.slice(0,200)
    };"""
s = replace_once(s, old, new, "OpenAI market outcome context")

s = replace_once(
    s,
    "instructions:'You are MEMEFLOW Strategy Coach. Analyze only this user\\'s outcomes/settings. Never claim guaranteed profit. Suggest conservative testable changes. Never suggest locked settings.'",
    "instructions:'You are MEMEFLOW Strategy Coach. Analyze this user\\'s settings/trade outcomes plus the supplied public market archive. ARCHIVED/COLLAPSED/DEAD_LIQUIDITY are negative observations; REVIVED is a false-positive warning and must reduce confidence in overly aggressive filters. Never claim guaranteed profit. Suggest conservative testable changes only. Never suggest locked settings. You may propose changes, but you do not have authority to apply them.'",
    "OpenAI strategy instructions"
)

old = """  async applyProposal(uid,proposal){
    const ai=this.userState(uid),cfg=ai.settings;if(!cfg.autoOptimize)return {applied:false,reason:'AUTO_OPTIMIZE_DISABLED'};
    const allowed=cfg.allowedAutoTune?.[proposal.setting];if(!allowed)return {applied:false,reason:'SETTING_NOT_ALLOWED'};
    if((cfg.lockedSettings||[]).includes(proposal.setting))return {applied:false,reason:'SETTING_LOCKED'};
    if(Number(proposal.confidence)<80)return {applied:false,reason:'CONFIDENCE_BELOW_80'};
    const current=this.store.settings(uid),n=Number(proposal.proposed);if(!Number.isFinite(n))return {applied:false,reason:'NON_NUMERIC_PROPOSAL'};
    const next={...current,[proposal.setting]:clamp(n,Number(allowed.min),Number(allowed.max))};this.store.setSettings(uid,next);
    this.audit(uid,'auto_optimize',{setting:proposal.setting,from:current[proposal.setting],to:next[proposal.setting]});return {applied:true,setting:proposal.setting,value:next[proposal.setting]};
  }"""
new = """  async applyProposal(uid,proposal){
    const cfg=this.userState(uid).settings;
    const allowed=cfg.allowedAutoTune?.[proposal.setting];
    if(!allowed)return {applied:false,reason:'SETTING_NOT_ALLOWED'};
    if((cfg.lockedSettings||[]).includes(proposal.setting))return {applied:false,reason:'SETTING_LOCKED'};
    const n=Number(proposal.proposed);
    if(!Number.isFinite(n))return {applied:false,reason:'NON_NUMERIC_PROPOSAL'};
    return {
      applied:false,
      reason:'PROPOSAL_ONLY_USE_SETTINGS_API',
      proposal:{
        ...proposal,
        proposed:clamp(n,Number(allowed.min),Number(allowed.max))
      }
    };
  }"""
s = replace_once(s, old, new, "OpenAI applyProposal policy")

old = """if(url.pathname==='/api/openai/settings'&&req.method==='PUT'){const b=await readBody(req),ai=this.userState(uid),next={...ai.settings,...(b.settings||{}),updatedAt:now()};delete next.userId;ai.settings=next;this.save();return {status:200,body:{settings:ai.settings}}}"""
new = """if(url.pathname==='/api/openai/settings'&&req.method==='PUT'){const b=await readBody(req),ai=this.userState(uid),next={...ai.settings,...(b.settings||{}),autoOptimize:false,updatedAt:now()};delete next.userId;ai.settings=next;this.save();return {status:200,body:{settings:ai.settings}}}"""
s = replace_once(s, old, new, "OpenAI settings PUT proposal-only")
write(p, s)

# ---------------------------------------------------------------------------
# 8) DECISIONS API: lifecycle-aware Live feed + archival/revival learning labels.
#    This code executes only when the feed is read.
# ---------------------------------------------------------------------------
p = "app-server.mjs"
s = read(p)
old = """  const _all=store.decisions(u.id);
  const _selected=candidateFeed(_all,_scope);
  const _counts=candidateVisibilityCounts(_all);"""
new = """  const _all=store.decisions(u.id);
  const _tokenLookup=(mint)=>store.state.tokens?.[mint]||null;

  // Lifecycle/archive learning is deliberately read-time only. It can never
  // delay discovery, enrichment, evaluation, holder RPC or a trading decision.
  const _archivedRows=candidateFeed(_all,'archived',_tokenLookup);
  for(const row of _archivedRows)store.recordMarketOutcome?.(_tokenLookup(row.mint)||{});
  const _liveRows=candidateFeed(_all,'all',_tokenLookup);
  for(const row of _liveRows)store.recordMarketRevival?.(_tokenLookup(row.mint)||{});

  const _selected=candidateFeed(_all,_scope,_tokenLookup);
  const _counts=candidateVisibilityCounts(_all,_tokenLookup);"""
s = replace_once(s, old, new, "decision feed lifecycle wiring")
write(p, s)

# ---------------------------------------------------------------------------
# 9) TESTS: replace stale expectations with the canonical semantics.
# ---------------------------------------------------------------------------
write("src/filter-upgrade.test.mjs", r"""import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettings,normalizeSettings,validateSettings} from './settings.mjs';
import {evaluate} from './evaluate.mjs';

const baseToken=(patch={})=>({
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
  ...patch
});

test('defaults retain canonical AI and holder thresholds',()=>{
  const s=defaultSettings();
  assert.equal(s.minScore,72);
  assert.equal(s.minHolders,30);
  assert.equal(s.maxTop10Pct,25);
  assert.equal(s.aiChangePolicy,'propose');
});

test('empty nullable ranges normalize to null and zero remains valid',()=>{
  const s=normalizeSettings({minHolders:'',maxHolders:0});
  assert.equal(s.minHolders,null);
  assert.equal(s.maxHolders,0);
});

test('invalid min/max is rejected',()=>{
  assert.equal(validateSettings({minHolders:50,maxHolders:10}).ok,false);
});

test('known hard holder failure blocks even while other data is pending',()=>{
  const d=evaluate(
    baseToken({holderCount:17,top10Pct:null,developerPct:null}),
    {...defaultSettings(),minHolders:30,maxHolders:100}
  );
  assert.equal(d.state,'BLOCKED');
  assert.match(d.reasons.join(' '),/holders below 30/);
});

test('missing enabled bundle data waits instead of becoming a false reject',()=>{
  const d=evaluate(
    baseToken(),
    {...defaultSettings(),minBundlePct:0,maxBundlePct:10}
  );
  assert.equal(d.state,'WAITING');
  assert.match(d.reasons.join(' '),/Bundle data pending/i);
});

test('top10 range and AI thresholds work together',()=>{
  const d=evaluate(
    baseToken(),
    {...defaultSettings(),minTop10Pct:0,maxTop10Pct:25}
  );
  assert.equal(d.state,'BUY READY');
});

test('maximum holders blocks above configured limit',()=>{
  const s=normalizeSettings({...defaultSettings(),minHolders:null,maxHolders:100,requireFreshHolderSnapshot:false});
  const d=evaluate(baseToken({holderCount:101}),s);
  assert.equal(d.state,'BLOCKED');
  assert.match(d.reasons.join(' '),/above maximum 100/);
});

test('social gate waits until metadata resolution finishes',()=>{
  const s=normalizeSettings({...defaultSettings(),requireTwitter:true});
  const d=evaluate(baseToken({twitter:null,metadataFetchedAt:null,metadataResolved:false}),s);
  assert.equal(d.state,'WAITING');
  assert.match(d.reasons.join(' '),/Waiting: Twitter/);
});

test('resolved metadata with required social missing blocks',()=>{
  const s=normalizeSettings({...defaultSettings(),requireTwitter:true});
  const d=evaluate(baseToken({twitter:null,metadataFetchedAt:Date.now(),metadataFetched:true,metadataResolved:true}),s);
  assert.equal(d.state,'BLOCKED');
  assert.match(d.reasons.join(' '),/Twitter \\/ X is required/);
});

test('resolved required social passes when present',()=>{
  const s=normalizeSettings({...defaultSettings(),requireTwitter:true});
  const d=evaluate(baseToken({twitter:'https://x.com/example',metadataResolved:true}),s);
  assert.equal(d.state,'BUY READY');
});

test('developer blacklist blocks exact creator wallet',()=>{
  const s=normalizeSettings({...defaultSettings(),developerBlacklistWallets:['Creator111']});
  const d=evaluate(baseToken({creator:'Creator111'}),s);
  assert.equal(d.state,'BLOCKED');
  assert.match(d.reasons.join(' '),/Developer wallet/);
});

test('missing enabled numeric metric reports data pending',()=>{
  const s=normalizeSettings({...defaultSettings(),minVolume24hUsd:1000});
  const d=evaluate(baseToken({volume24hUsd:null}),s);
  assert.equal(d.state,'WAITING');
  assert.match(d.reasons.join(' '),/24h volume data pending/i);
});

test('missing AI score inputs wait even if Phase A dataQuality says 1',()=>{
  const s=normalizeSettings(defaultSettings());
  const d=evaluate(baseToken({top10Pct:null,developerPct:null,dataQuality:1}),s);
  assert.equal(d.state,'WAITING');
  assert.match(d.reasons.join(' '),/AI score inputs pending/);
});

test('DEX quality score does not require unreliable developer data',()=>{
  const s=normalizeSettings({...defaultSettings(),discoverySourceMode:'dex'});
  const d=evaluate({
    launchPlatform:'dex',
    dexConfirmed:true,
    holderCount:100,
    holderFresh:true,
    priceSol:0.001,
    dataQuality:1,
    buyPressure:3,
    top10Pct:10,
    liquidityUsd:100000,
    marketCapUsd:500000,
    volume24hUsd:250000,
    buyTransactions:100,
    sellTransactions:30,
    discoveredAt:Date.now(),
    metadataResolved:true
  },s);
  assert.notEqual(d.state,'BLOCKED');
  assert.notEqual(d.state,'WAITING');
});
""")

write("src/candidate-visibility-lifecycle.test.mjs", r"""import test from 'node:test';
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
  'blocked-stale':{mint:'blocked-stale',lastMarketActivityAt:NOW-16*M,discoveredAt:NOW-20*M},
  'blocked-live':{mint:'blocked-live',lastMarketActivityAt:NOW-2*M,discoveredAt:NOW-20*M},
  'waiting-stale':{mint:'waiting-stale',lastMarketActivityAt:NOW-61*M,discoveredAt:NOW-70*M},
  'watch-stale':{mint:'watch-stale',lastMarketActivityAt:NOW-61*M,discoveredAt:NOW-70*M},
  'buy-stale':{mint:'buy-stale',lastMarketActivityAt:NOW-120*M,discoveredAt:NOW-130*M}
};
const lookup=m=>tokens[m];

test('stale BLOCKED leaves Live but remains in audit/archive',()=>{
  assert.equal(isDecisionArchived(decisions[0],tokens['blocked-stale'],NOW),true);
  assert.equal(candidateFeed(decisions,'all',lookup,NOW).some(x=>x.mint==='blocked-stale'),false);
  assert.equal(candidateFeed(decisions,'audit',lookup,NOW).some(x=>x.mint==='blocked-stale'),true);
  assert.equal(candidateFeed(decisions,'archived',lookup,NOW).some(x=>x.mint==='blocked-stale'),true);
});

test('recent BLOCKED remains visible filtered',()=>{
  assert.equal(classifyDecisionVisibility(decisions[1],tokens['blocked-live'],NOW),'filtered');
});

test('stuck WAITING and inactive WATCH archive after one hour',()=>{
  assert.equal(classifyDecisionVisibility(decisions[2],tokens['waiting-stale'],NOW),'archived');
  assert.equal(classifyDecisionVisibility(decisions[3],tokens['watch-stale'],NOW),'archived');
});

test('BUY READY is never archived by inactivity cleanup',()=>{
  assert.equal(classifyDecisionVisibility(decisions[4],tokens['buy-stale'],NOW),'candidate');
});

test('counts separate visible and archived rows',()=>{
  const c=candidateVisibilityCounts(decisions,lookup,NOW);
  assert.equal(c.totalEvaluated,5);
  assert.equal(c.archived,3);
  assert.equal(c.visible,2);
  assert.equal(c.candidates,1);
  assert.equal(c.filtered,1);
});
""")

write("src/unified-mechanism.test.mjs", r"""import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {JsonStore} from './store.mjs';
import {PaperEngine} from './paper-engine.mjs';
import {OpenAIIntelligence} from './openai-intelligence.mjs';

test('deleteDecision removes the in-memory decision without persistence coupling',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-store-'));
  const store=new JsonStore(dir);
  store.setDecision('u','mint1',{state:'BLOCKED'});
  assert.equal(store.decisions('u').length,1);
  store.deleteDecision('u','mint1');
  assert.equal(store.decisions('u').length,0);
});

test('market archive records stale token and preserves revival as a false-positive label',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-outcome-'));
  const store=new JsonStore(dir);
  const archivedAt=Date.now();
  const token={
    mint:'mint2',
    discoveredAt:archivedAt-30*60_000,
    lastMarketActivityAt:archivedAt-20*60_000,
    holderCount:1,
    priceSol:0.01,
    peakPriceSol:1
  };
  const row=store.recordMarketOutcome(token);
  assert.equal(row.status,'ARCHIVED');
  assert.equal(row.label,'COLLAPSED');
  token.lastMarketActivityAt=Date.now()+1000;
  const revived=store.recordMarketRevival(token);
  assert.equal(revived.status,'REVIVED');
  assert.equal(revived.label,'REVIVED');
});

test('feeReserve stays outside AI and reduces executable paper capital',()=>{
  const store={
    state:{
      users:{u:{killSwitch:false}},
      paperPositions:{},paperTrades:{},paperProposals:{},paperProcessed:{},
      paperMetrics:{entries:0,exits:0,errors:0}
    },
    save(){}
  };
  const paper=new PaperEngine(store,{clock:()=>Date.now()});
  const token={mint:'m',priceSol:1,holderFresh:true,updatedAt:Date.now()};
  const base={
    operatingMode:'automate',
    tradingEnvironment:'paper',
    positionSize:0.9,
    maxPositionSize:1,
    maxOpenPositions:4,
    maxDailyEntries:10,
    dailySpendLimit:0,
    tradingCapital:1,
    feeReserve:0.2,
    dailyLossLimit:0,
    requireFreshHolderSnapshot:true,
    decisionFreshnessSec:60
  };
  const blocked=paper.entryReadiness('u',token,base);
  assert.equal(blocked.checks.find(x=>x.key==='paperCapital').pass,false);
  const allowed=paper.entryReadiness('u',token,{...base,positionSize:0.8});
  assert.equal(allowed.checks.find(x=>x.key==='paperCapital').pass,true);
  assert.equal(allowed.metrics.usableCapital,0.8);
});

test('OpenAI Strategy settings are proposal-only even if old state requested autoOptimize',async()=>{
  const user={id:'u',settings:{},ai:{settings:{autoOptimize:true}}};
  const store={
    state:{tokens:{},users:{u:user}},
    user(){return user},
    settings(){return {minScore:72}},
    save(){}
  };
  const ai=new OpenAIIntelligence({store});
  assert.equal(ai.userState('u').settings.autoOptimize,false);
  const result=await ai.applyProposal('u',{setting:'minScore',proposed:80,confidence:99});
  assert.equal(result.applied,false);
  assert.equal(result.reason,'PROPOSAL_ONLY_USE_SETTINGS_API');
  assert.equal(store.settings().minScore,72);
});
""")

# Package test script now protects the canonical contract on every npm test.
p = "package.json"
pkg = json.loads(read(p))
old_test = pkg.get("scripts",{}).get("test","")
contract = "node --test src/filter-upgrade.test.mjs src/candidate-visibility-lifecycle.test.mjs src/unified-mechanism.test.mjs"
if contract not in old_test:
    pkg.setdefault("scripts",{})["test"] = contract + (" && " + old_test if old_test else "")
write(p, json.dumps(pkg, indent=2) + "\n")
PY

log "Syntax checks..."
node --check src/evaluate.mjs
node --check src/enrich.mjs
node --check src/dex-verification-gate.mjs
node --check src/candidate-visibility.mjs
node --check src/openai-intelligence.mjs
node --check src/store.mjs
node --check src/paper-engine.mjs
node --check app-server.mjs

log "Canonical contract tests..."
node --test src/filter-upgrade.test.mjs src/candidate-visibility-lifecycle.test.mjs src/unified-mechanism.test.mjs

log "Existing integration / billing / owner tests..."
node tests/integration.mjs
node tests/billing-cycle.mjs
node tests/owner-live.mjs

log "Hot-path guardrails..."
if grep -Eq "await .*openai|await .*marketOutcome|await .*candidateFeed" src/liveeval.mjs; then
  die "Unexpected awaited archive/OpenAI/feed dependency detected in liveeval.mjs."
fi

# No archive/OpenAI import is allowed in the evaluator.
if grep -Eq "openai|marketOutcome|candidateFeed" src/evaluate.mjs; then
  die "Evaluator unexpectedly references non-realtime archive/OpenAI/feed code."
fi

trap - ERR INT TERM

log "SUCCESS — unified patch installed."
log "Backup: $BACKUP"
log ""
log "Key guarantees:"
log "  • Missing/in-flight enrichment is WAITING, not a premature BLOCKED."
log "  • Known hard gate failures still BLOCK immediately."
log "  • Pump + DEX social filters finalize only after their existing metadata source resolves."
log "  • No new network request was added to discovery/diagnostics."
log "  • BLOCKED leaves Live after 15m without market activity."
log "  • WAITING/WATCH leaves Live after 60m without market activity."
log "  • BUY READY is not auto-archived by this cleanup."
log "  • Archived/revived market examples are recorded only from feed reads."
log "  • OpenAI Strategy Coach can study those examples and propose settings changes."
log "  • OpenAI cannot apply settings changes automatically."
log "  • feeReserve is enforced only in the execution/capital gate."
log "  • touchUser persistence is throttled; decisions remain memory-only."
log ""
log "Review changes:"
log "  git diff -- src app-server.mjs package.json"
