#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW_UNIFIED_CORE_V4"
EXPECTED_HEAD="b4d3d18842191afc3cb87c6737dc86723af4aab0"

log(){ printf '[PATCH] %s\n' "$*"; }
die(){ log "STOP: $*"; exit 1; }

if [[ -f "memeflow-app/app-server.mjs" && -f "memeflow-app/src/evaluate.mjs" ]]; then
  APP_ROOT="memeflow-app"
elif [[ -f "app-server.mjs" && -f "src/evaluate.mjs" ]]; then
  APP_ROOT="."
else
  die "Cannot find MEMEFLOW app root."
fi

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside the MEMEFLOW git repository."
HEAD_NOW="$(git rev-parse HEAD)"
[[ "$HEAD_NOW" == "$EXPECTED_HEAD" ]] || die "Expected HEAD $EXPECTED_HEAD but found $HEAD_NOW. Nothing changed."

cd "$APP_ROOT"

TARGETS=(
  "src/evaluate.mjs"
  "src/enrich.mjs"
  "src/candidate-visibility.mjs"
  "src/openai-intelligence.mjs"
  "src/store.mjs"
  "src/paper-engine.mjs"
  "src/pump-live-trade-feed.mjs"
  "src/filter-upgrade.test.mjs"
  "app-server.mjs"
  "package.json"
)

for f in "${TARGETS[@]}"; do
  [[ -f "$f" ]] || die "Missing target: $f"
  git diff --quiet -- "$f" || die "$f has unstaged changes. Nothing changed."
  git diff --cached --quiet -- "$f" || die "$f has staged changes. Nothing changed."
done

[[ ! -e src/candidate-visibility-lifecycle.test.mjs ]] || die "candidate lifecycle test already exists."
[[ ! -e src/paper-engine-unified.test.mjs ]] || die "paper engine unified test already exists."

log "Baseline syntax checks..."
for f in src/evaluate.mjs src/enrich.mjs src/candidate-visibility.mjs src/openai-intelligence.mjs src/store.mjs src/paper-engine.mjs src/pump-live-trade-feed.mjs app-server.mjs; do
  node --check "$f"
done

log "Baseline integration suite..."
npm test

BACKUP=".memeflow-unified-v4-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/src"
for f in "${TARGETS[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  code=$?
  log "Validation failed — restoring exact pre-patch files..."
  for f in "${TARGETS[@]}"; do
    [[ -f "$BACKUP/$f" ]] && cp "$BACKUP/$f" "$f" || true
  done
  rm -f src/candidate-visibility-lifecycle.test.mjs src/paper-engine-unified.test.mjs
  log "Rollback complete. Backup kept at $BACKUP"
  exit "$code"
}
trap rollback ERR INT TERM

log "Applying unified patch..."

python3 - <<'PY'
from pathlib import Path
import json

def one(s, old, new, label):
    n=s.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected exactly one anchor, found {n}")
    return s.replace(old,new,1)

# evaluator: unresolved evidence stays WAITING; hard failures remain BLOCKED.
p=Path("src/evaluate.mjs"); s=p.read_text()
s=one(s,
"""function metadataKnown(t={}){
  return Boolean(t.metadataReady===true||t.metadataFetched===true||t.metadataResolved===true||t.name||t.symbol||t.uri||t.metadataUri);
}""",
"""function metadataKnown(t={}){
  const soc=socials(t);
  if(soc.twitter||soc.website||soc.telegram)return true;
  if(t.metadataReady===true||t.metadataFetched===true||t.metadataResolved===true)return true;
  const fetched=finite(t.metadataFetchedAt)&&Number(t.metadataFetchedAt)>0;
  return Boolean(fetched&&!t.metadataError);
}""","evaluate metadataKnown")
s=one(s,
"""  const addMin=(name,value,limit,reason,zeroDisables=true)=>{
    if(!finite(limit))return;const x=Number(limit);if(zeroDisables&&x<=0)return;
    addGate(name,value===null?null:value>=x,reason,{value,threshold:x,operator:'>='});
  };
  const addMax=(name,value,limit,reason)=>{
    if(!finite(limit))return;const x=Number(limit);
    addGate(name,value===null?null:value<=x,reason,{value,threshold:x,operator:'<='});
  };""",
"""  const addMin=(name,value,limit,reason,zeroDisables=true)=>{
    if(!finite(limit))return;const x=Number(limit);if(zeroDisables&&x<=0)return;
    const pendingReason=`${name.replace(/^(Minimum|Maximum)\\s+/,'')} data pending`;
    addGate(name,value===null?null:value>=x,value===null?pendingReason:reason,{value,threshold:x,operator:'>='});
  };
  const addMax=(name,value,limit,reason)=>{
    if(!finite(limit))return;const x=Number(limit);
    const pendingReason=`${name.replace(/^(Minimum|Maximum)\\s+/,'')} data pending`;
    addGate(name,value===null?null:value<=x,value===null?pendingReason:reason,{value,threshold:x,operator:'<='});
  };""","evaluate range helpers")
s=s.replace("addMax('Maximum holders',v.holders,s.maxHolders,`holders above ${s.maxHolders}`);",
            "addMax('Maximum holders',v.holders,s.maxHolders,`holders above maximum ${s.maxHolders}`);",1)
s=s.replace("addGate('Developer blacklist',creator?!bl.includes(creator):null,'developer wallet is blacklisted');",
            "addGate('Developer blacklist',creator?!bl.includes(creator):null,'Developer wallet is blacklisted');",1)
s=one(s,
"""  if(s.requireFreshHolderSnapshot===true)addGate('Fresh holder snapshot',token.holderFresh==null?null:token.holderFresh===true,'holder snapshot unavailable');""",
"""  if(s.requireFreshHolderSnapshot===true)addGate('Fresh holder snapshot',token.holderFresh===true?true:null,'holder snapshot data pending');""",
"evaluate holderFresh")
s=one(s,
"""  const minScore=finite(s.minScore)?Number(s.minScore):null;
  const minConfidence=finite(s.minConfidence)?Number(s.minConfidence):null;
  const scorePass=minScore===null||score>=minScore;
  const confPass=minConfidence===null||confidence>=minConfidence;
  gates.push({name:'Minimum AI score',status:scorePass?'PASS':'FAIL',pass:scorePass,value:score,threshold:minScore});
  if(!scorePass){blocked=true;reasons.push(`AI score ${score} below configured minimum ${minScore}`)}
  gates.push({name:'Minimum data confidence',status:confPass?'PASS':'FAIL',pass:confPass,value:confidence,threshold:minConfidence});
  if(!confPass){blocked=true;reasons.push(`data confidence ${confidence}% below configured minimum ${minConfidence}%`)}

  const state=blocked?'BLOCKED':waiting?'WAITING':scorePass&&confPass?'BUY READY':'WATCH';""",
"""  const minScore=finite(s.minScore)?Number(s.minScore):null;
  const minConfidence=finite(s.minConfidence)?Number(s.minConfidence):null;
  const scorePass=minScore===null||score>=minScore;
  const confPass=minConfidence===null||confidence>=minConfidence;
  const scoreStatus=waiting?'WAITING':(scorePass?'PASS':'FAIL');
  const confStatus=waiting?'WAITING':(confPass?'PASS':'FAIL');
  gates.push({name:'Minimum AI score',status:scoreStatus,pass:scoreStatus==='PASS',value:score,threshold:minScore});
  if(scoreStatus==='FAIL'){blocked=true;reasons.push(`AI score ${score} below configured minimum ${minScore}`)}
  gates.push({name:'Minimum data confidence',status:confStatus,pass:confStatus==='PASS',value:confidence,threshold:minConfidence});
  if(confStatus==='FAIL'){blocked=true;reasons.push(`data confidence ${confidence}% below configured minimum ${minConfidence}%`)}

  const state=blocked?'BLOCKED':waiting?'WAITING':scorePass&&confPass?'BUY READY':'WATCH';""",
"evaluate score/conf")
p.write_text(s)

# metadata: reuse the existing fetch; extract socials without adding requests.
p=Path("src/enrich.mjs"); s=p.read_text()
s=one(s,
"""    const metadata = await response.json();
    return {
      metadataUrl,
      imageUrl:firstMetadataImage(metadata),
      metadataName:typeof metadata?.name === 'string' ? metadata.name.slice(0,160) : null,
      metadataSymbol:typeof metadata?.symbol === 'string' ? metadata.symbol.slice(0,40) : null
    };""",
"""    const metadata = await response.json();
    const pickText=(...values)=>{
      for(const value of values){
        if(typeof value==='string'&&value.trim())return value.trim().slice(0,500);
      }
      return null;
    };
    const extensions=metadata?.extensions||{};
    const links=metadata?.links||{};
    return {
      metadataUrl,
      imageUrl:firstMetadataImage(metadata),
      metadataName:typeof metadata?.name === 'string' ? metadata.name.slice(0,160) : null,
      metadataSymbol:typeof metadata?.symbol === 'string' ? metadata.symbol.slice(0,40) : null,
      twitter:pickText(metadata?.twitter,metadata?.x,extensions?.twitter,extensions?.x,links?.twitter,links?.x),
      website:pickText(metadata?.website,metadata?.external_url,metadata?.externalUrl,extensions?.website,links?.website),
      telegram:pickText(metadata?.telegram,extensions?.telegram,links?.telegram)
    };""","enrich metadata parse")
s=one(s,
"""        metadataPatch = {
          metadataFetchedAt:Date.now(),
          metadataUrl:metadata.metadataUrl,
          imageUrl:metadata.imageUrl,
          image:metadata.imageUrl,
          logoUrl:metadata.imageUrl,
          metadataName:metadata.metadataName,
          metadataSymbol:metadata.metadataSymbol
        };""",
"""        metadataPatch = {
          metadataFetchedAt:Date.now(),
          metadataUrl:metadata.metadataUrl,
          imageUrl:metadata.imageUrl,
          image:metadata.imageUrl,
          logoUrl:metadata.imageUrl,
          metadataName:metadata.metadataName,
          metadataSymbol:metadata.metadataSymbol,
          twitter:metadata.twitter,
          website:metadata.website,
          telegram:metadata.telegram,
          metadataError:null
        };""","enrich metadata store")
p.write_text(s)

# read-time lifecycle: no scanner/RPC/OpenAI dependency.
Path("src/candidate-visibility.mjs").write_text(r"""const terminalStates=new Set(['EXPIRED','BLOCKED','REJECTED','CLOSED','IGNORED']);
const envMs=(name,fallback,min=60000)=>{const n=Number(process.env[name]);return Number.isFinite(n)?Math.max(min,n):fallback};
const FILTERED_LIVE_TTL_MS=envMs('MEMEFLOW_FILTERED_LIVE_TTL_MS',15*60_000);
const WATCH_LIVE_TTL_MS=envMs('MEMEFLOW_WATCH_LIVE_TTL_MS',30*60_000);
const WAITING_LIVE_TTL_MS=envMs('MEMEFLOW_WAITING_LIVE_TTL_MS',60*60_000);
const BUY_READY_LIVE_TTL_MS=envMs('MEMEFLOW_BUY_READY_LIVE_TTL_MS',30*60_000);

function tsMs(v){
  if(v===null||v===undefined||v==='')return null;
  if(typeof v==='number'&&Number.isFinite(v))return v<1e12?v*1000:v;
  const n=Number(v);if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;
  const d=Date.parse(String(v));return Number.isFinite(d)?d:null;
}
function activityAt(token={},decision={}){
  for(const v of [token.lastMarketActivityAt,token.lastPriceChangeAt,token.discoveredAt,token.createdAt,token.firstSeenAt,decision.createdAt,decision.updatedAt]){
    const ms=tsMs(v);if(ms!==null)return ms;
  }
  return null;
}
function lookup(tokenLookup,mint){
  if(typeof tokenLookup==='function')return tokenLookup(mint)||null;
  if(tokenLookup&&typeof tokenLookup==='object')return tokenLookup[mint]||null;
  return null;
}
export function isDecisionArchived(decision={},token=null,now=Date.now()){
  if(!token||typeof token!=='object')return false;
  const state=String(decision.state||'WAITING').trim().toUpperCase();
  const at=activityAt(token,decision);if(at===null)return false;
  const idle=Math.max(0,Number(now)-at);
  if(state==='BUY READY')return idle>=BUY_READY_LIVE_TTL_MS;
  if(state==='WATCH')return idle>=WATCH_LIVE_TTL_MS;
  if(state==='WAITING')return idle>=WAITING_LIVE_TTL_MS;
  if(terminalStates.has(state)||decision.terminal===true)return idle>=FILTERED_LIVE_TTL_MS;
  return false;
}
export function classifyDecisionVisibility(decision={},token=null,now=Date.now()){
  if(isDecisionArchived(decision,token,now))return 'archived';
  const state=String(decision.state||'WAITING').trim().toUpperCase();
  const closed=decision.terminal===true||String(decision.lifecycle||'').toLowerCase()==='closed'||terminalStates.has(state);
  if(state==='BUY READY'&&!closed)return 'candidate';
  if(state==='WAITING'&&!closed)return 'processing';
  if(state==='WATCH'&&!closed)return 'watch';
  return 'filtered';
}
export function candidateFeed(decisions=[],scope='candidates',tokenLookup=null,now=Date.now()){
  const rows=Array.isArray(decisions)?decisions.filter(Boolean):[];
  const normalized=String(scope||'candidates').trim().toLowerCase();
  const kind=x=>classifyDecisionVisibility(x,lookup(tokenLookup,x?.mint),now);
  if(normalized==='audit')return rows;
  if(normalized==='archived')return rows.filter(x=>kind(x)==='archived');
  if(normalized==='all')return rows.filter(x=>kind(x)!=='archived');
  if(normalized==='processing')return rows.filter(x=>kind(x)==='processing');
  if(normalized==='watch')return rows.filter(x=>kind(x)==='watch');
  if(normalized==='filtered')return rows.filter(x=>kind(x)==='filtered');
  return rows.filter(x=>kind(x)==='candidate');
}
export function candidateVisibilityCounts(decisions=[],tokenLookup=null,now=Date.now()){
  const counts={candidates:0,processing:0,watch:0,filtered:0,archived:0,visible:0,totalEvaluated:0};
  for(const row of Array.isArray(decisions)?decisions:[]){
    if(!row)continue;counts.totalEvaluated++;
    const kind=classifyDecisionVisibility(row,lookup(tokenLookup,row?.mint),now);
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

# store: throttle user-save, canonical decision key methods, preserve explicit market activity.
p=Path("src/store.mjs"); s=p.read_text()
s=one(s,"""    this._uidDec={}; // uid → Map<key,updatedAt> — in-memory only, not persisted
    this._st=null;""",
"""    this._uidDec={}; // uid → Map<key,updatedAt> — in-memory only, not persisted
    this._lastTouchPersistAt={};
    this._st=null;""","store constructor")
s=one(s,"""  touchUser(id){this.user(id).lastActiveAt=Date.now();this.save();return this.user(id)}""",
"""  touchUser(id){
    const u=this.user(id),now=Date.now();u.lastActiveAt=now;
    const interval=Math.max(5000,Number(process.env.STORE_TOUCH_SAVE_INTERVAL_MS||30000));
    if(now-Number(this._lastTouchPersistAt[id]||0)>=interval){this._lastTouchPersistAt[id]=now;this.save()}
    return u
  }""","store touchUser")
s=one(s,
"""    const pressureChanged=t?.buyPressure!==undefined&&Number(t.buyPressure)!==Number(old?.buyPressure);
    const activityChanged=priceChanged||pressureChanged||Number(t?.buyTransactions||0)!==Number(old?.buyTransactions||0)||Number(t?.sellTransactions||0)!==Number(old?.sellTransactions||0);""",
"""    const pressureChanged=t?.buyPressure!==undefined&&Number(t.buyPressure)!==Number(old?.buyPressure);
    const explicitActivityRaw=Number(patch?.lastMarketActivityAt);
    const explicitActivityAt=Number.isFinite(explicitActivityRaw)&&explicitActivityRaw>0?(explicitActivityRaw<1e12?explicitActivityRaw*1000:explicitActivityRaw):null;
    const activityChanged=priceChanged||pressureChanged||Number(t?.buyTransactions||0)!==Number(old?.buyTransactions||0)||Number(t?.sellTransactions||0)!==Number(old?.sellTransactions||0);""","store activity")
s=one(s,
"""      lastMarketActivityAt:activityChanged?now:(old.lastMarketActivityAt||old.lastPriceChangeAt||null),
      updatedAt:now""",
"""      lastMarketActivityAt:explicitActivityAt||(activityChanged?now:(old.lastMarketActivityAt||old.lastPriceChangeAt||null)),
      updatedAt:now""","store activity write")
s=one(s,
"""  setDecision(uid,mint,d){
    const key=uid+':'+mint,now=Date.now();
    this.state.decisions[key]={...d,userId:uid,mint,updatedAt:now};
    if(!this._uidDec[uid])this._uidDec[uid]=new Map();
    const m=this._uidDec[uid];
    m.set(key,now);
    if(m.size>250){let ok=null,ot=Infinity;for(const[k,t]of m)if(t<ot){ot=t;ok=k};if(ok){m.delete(ok);delete this.state.decisions[ok]}}
    // Decisions are intentionally in-memory only; do not schedule a disk write.
  }
  decisions(uid){""",
"""  setDecision(uid,mint,d){
    const key=uid+':'+mint,now=Date.now(),createdAt=this.state.decisions[key]?.createdAt||now;
    const row={...d,userId:uid,mint,createdAt,updatedAt:now};
    this.state.decisions[key]=row;
    if(!this._uidDec[uid])this._uidDec[uid]=new Map();
    const m=this._uidDec[uid];
    m.set(key,now);
    if(m.size>250){let ok=null,ot=Infinity;for(const[k,t]of m)if(t<ot){ot=t;ok=k};if(ok){m.delete(ok);delete this.state.decisions[ok]}}
    // Decisions are intentionally in-memory only; do not schedule a disk write.
    return row
  }
  getDecision(uid,mint){return this.state.decisions?.[uid+':'+mint]||null}
  deleteDecision(uid,mint){
    const key=uid+':'+mint,existed=Boolean(this.state.decisions?.[key]);
    if(this.state.decisions)delete this.state.decisions[key];
    const m=this._uidDec?.[uid];if(m){m.delete(key);if(!m.size)delete this._uidDec[uid]}
    return existed
  }
  decisions(uid){""","store decisions")
p.write_text(s)

# Pump WS: explicit real trade activity timestamp, no new request/await.
p=Path("src/pump-live-trade-feed.mjs"); s=p.read_text()
s=one(s,
"""      const patch={
        marketSource:'ws-direct-trade-event',
        buyPressure,
        lastPriceAt:eventAt
      };""",
"""      const patch={
        marketSource:'ws-direct-trade-event',
        buyPressure,
        lastPriceAt:eventAt,
        lastMarketActivityAt:eventAt
      };""","pump live activity")
p.write_text(s)

# paper execution: fee reserve is actually reserved.
p=Path("src/paper-engine.mjs"); s=p.read_text()
s=one(s,
"""      tradingCapital: Math.max(0, num(settings.tradingCapital, 0)),
      dailyLossLimit: Math.max(0, num(settings.dailyLossLimit, 0)),""",
"""      tradingCapital: Math.max(0, num(settings.tradingCapital, 0)),
      dailyLossLimit: Math.max(0, num(settings.dailyLossLimit, 0)),
      feeReserve: Math.max(0, num(settings.feeReserve, 0)),""","paper settings")
s=one(s,
"""    const capitalAvailable =
      s.tradingCapital <= 0 ||
      deployed + s.positionSize <= s.tradingCapital;""",
"""    const usableTradingCapital=s.tradingCapital<=0?Infinity:Math.max(0,s.tradingCapital-s.feeReserve);
    const capitalAvailable =
      s.tradingCapital <= 0 ||
      deployed + s.positionSize <= usableTradingCapital;""","paper capital")
s=one(s,
"""        deployed,
        tradingCapital: s.tradingCapital,
        dailyRealizedPnl,""",
"""        deployed,
        tradingCapital: s.tradingCapital,
        feeReserve: s.feeReserve,
        usableTradingCapital: Number.isFinite(usableTradingCapital)?usableTradingCapital:null,
        dailyRealizedPnl,""","paper metrics")
p.write_text(s)

# OpenAI: proposal-only settings policy.
p=Path("src/openai-intelligence.mjs"); s=p.read_text()
s=s.replace("enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:true,",
            "enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:false,",1)
s=one(s,"""    u.ai.settings={...aiDefaults(),...(u.ai.settings||{})};""",
"""    u.ai.settings={...aiDefaults(),...(u.ai.settings||{}),autoOptimize:false};""","openai userState")
s=one(s,
"""      if(url.pathname==='/api/openai/settings'&&req.method==='PUT'){const b=await readBody(req),ai=this.userState(uid),next={...ai.settings,...(b.settings||{}),updatedAt:now()};delete next.userId;ai.settings=next;this.save();return {status:200,body:{settings:ai.settings}}}""",
"""      if(url.pathname==='/api/openai/settings'&&req.method==='PUT'){const b=await readBody(req),ai=this.userState(uid),next={...ai.settings,...(b.settings||{}),autoOptimize:false,updatedAt:now()};delete next.userId;ai.settings=next;this.save();return {status:200,body:{settings:ai.settings}}}""","openai PUT")
s=one(s,
"""    const ai=this.userState(uid),cfg=ai.settings;if(!cfg.autoOptimize)return {applied:false,reason:'AUTO_OPTIMIZE_DISABLED'};""",
"""    const ai=this.userState(uid),cfg=ai.settings;if(!cfg.autoOptimize)return {applied:false,reason:'OWNER_APPLY_REQUIRED',proposalOnly:true};""","openai apply")
p.write_text(s)

# server: live feed token lookup + canonical decision lookup + remove redundant bridge eval bug.
p=Path("app-server.mjs"); s=p.read_text()
s=one(s,
"""  const _all=store.decisions(u.id);
  const _selected=candidateFeed(_all,_scope);
  const _counts=candidateVisibilityCounts(_all);""",
"""  const _all=store.decisions(u.id);
  const _tokenLookup=(mint)=>store.state.tokens?.[mint]||null;
  const _selected=candidateFeed(_all,_scope,_tokenLookup);
  const _counts=candidateVisibilityCounts(_all,_tokenLookup);""","server candidate feed")
s=one(s,
"""      for(const m of Object.values(store?._uidDec||{})){
        if(m?.has?.(mint)){hasAnyDecision=true;break}
      }""",
"""      for(const uid of Object.keys(store?._uidDec||{})){
        if(store.getDecision?.(uid,mint)){hasAnyDecision=true;break}
      }""","server bridge lookup")
s=one(s,
"""    const decision=
      store?._uidDec?.[u.id]?.get?.(mint) ??
      store?.state?.decisions?.[u.id]?.[mint] ??
      null;""",
"""    const decision=store.getDecision?.(u.id,mint)||null;""","server debug lookup")
p.write_text(s)

# tests: social missing is BLOCK only after metadata resolved; pending metadata/holders WAIT.
p=Path("src/filter-upgrade.test.mjs"); s=p.read_text()
s=one(s,
"""test('required social link blocks when missing',()=>{const s=normalizeSettings({...defaultSettings(),minHolders:null,maxTop10Pct:null,maxDeveloperPct:null,minTokenAgeMinutes:null,maxTokenAgeMinutes:null,requireFreshHolderSnapshot:false,minBuyPressure:null,requireTwitter:true});const d=evaluate(baseToken({twitter:null}),s);assert.equal(d.state,'BLOCKED');assert.match(d.reasons.join(' '),/Twitter\\/X required/)});""",
"""test('required social link blocks only after metadata resolved',()=>{const s=normalizeSettings({...defaultSettings(),minHolders:null,maxTop10Pct:null,maxDeveloperPct:null,minTokenAgeMinutes:null,maxTokenAgeMinutes:null,requireFreshHolderSnapshot:false,minBuyPressure:null,requireTwitter:true});const d=evaluate(baseToken({metadataFetchedAt:Date.now(),metadataUrl:'https://example.invalid/meta.json',metadataError:null,twitter:null}),s);assert.equal(d.state,'BLOCKED');assert.match(d.reasons.join(' '),/Twitter \\/ X is required/)});
test('required social waits while metadata is unresolved',()=>{const s=normalizeSettings({...defaultSettings(),minHolders:null,maxTop10Pct:null,maxDeveloperPct:null,minTokenAgeMinutes:null,maxTokenAgeMinutes:null,requireFreshHolderSnapshot:false,minBuyPressure:null,minScore:90,minConfidence:90,requireTwitter:true});const d=evaluate(baseToken({metadataFetchedAt:null,metadataError:null,twitter:null}),s);assert.equal(d.state,'WAITING')});
test('fresh holder requirement waits instead of false-blocking Phase A',()=>{const s=normalizeSettings({...defaultSettings(),minHolders:30,maxTop10Pct:25,maxDeveloperPct:20,requireFreshHolderSnapshot:true,minBuyPressure:1.2,minScore:72,minConfidence:70});const d=evaluate(baseToken({holderFresh:false,holderCount:null,top10Pct:null,developerPct:null}),s);assert.equal(d.state,'WAITING');assert.equal(d.settingsEvaluation.gates.find(g=>g.name==='Minimum AI score')?.status,'WAITING')});""","filter social test")
p.write_text(s)

Path("src/candidate-visibility-lifecycle.test.mjs").write_text(r"""import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateFeed,candidateVisibilityCounts,classifyDecisionVisibility,isDecisionArchived} from './candidate-visibility.mjs';
const NOW=2_000_000_000_000,M=60_000;
const ds=[
 {mint:'blocked-old',state:'BLOCKED',createdAt:NOW-20*M,updatedAt:NOW-M},
 {mint:'blocked-live',state:'BLOCKED',createdAt:NOW-20*M,updatedAt:NOW-M},
 {mint:'waiting-old',state:'WAITING',createdAt:NOW-70*M,updatedAt:NOW-M},
 {mint:'watch-live',state:'WATCH',createdAt:NOW-20*M,updatedAt:NOW-M},
 {mint:'ready-live',state:'BUY READY',createdAt:NOW-20*M,updatedAt:NOW-M}
];
const ts={
 'blocked-old':{lastMarketActivityAt:NOW-16*M,discoveredAt:NOW-20*M},
 'blocked-live':{lastMarketActivityAt:NOW-2*M,discoveredAt:NOW-20*M},
 'waiting-old':{lastMarketActivityAt:NOW-61*M,discoveredAt:NOW-70*M},
 'watch-live':{lastMarketActivityAt:NOW-5*M,discoveredAt:NOW-20*M},
 'ready-live':{lastMarketActivityAt:NOW-5*M,discoveredAt:NOW-20*M}
};
const lookup=m=>ts[m];
test('stale blocked leaves live but stays audit/archive',()=>{
 assert.equal(isDecisionArchived(ds[0],ts['blocked-old'],NOW),true);
 assert.equal(candidateFeed(ds,'all',lookup,NOW).some(x=>x.mint==='blocked-old'),false);
 assert.equal(candidateFeed(ds,'audit',lookup,NOW).some(x=>x.mint==='blocked-old'),true);
 assert.equal(candidateFeed(ds,'archived',lookup,NOW).some(x=>x.mint==='blocked-old'),true);
});
test('recent activity keeps blocked visible temporarily',()=>assert.equal(classifyDecisionVisibility(ds[1],ts['blocked-live'],NOW),'filtered'));
test('stuck waiting archives after one hour',()=>assert.equal(classifyDecisionVisibility(ds[2],ts['waiting-old'],NOW),'archived'));
test('watch and ready stay live with recent activity',()=>{
 assert.equal(classifyDecisionVisibility(ds[3],ts['watch-live'],NOW),'watch');
 assert.equal(classifyDecisionVisibility(ds[4],ts['ready-live'],NOW),'candidate');
});
test('counts split visible and archived',()=>{
 const c=candidateVisibilityCounts(ds,lookup,NOW);
 assert.deepEqual({total:c.totalEvaluated,archived:c.archived,visible:c.visible,candidates:c.candidates,watch:c.watch,filtered:c.filtered},
                  {total:5,archived:2,visible:3,candidates:1,watch:1,filtered:1});
});
""")

Path("src/paper-engine-unified.test.mjs").write_text(r"""import test from 'node:test';
import assert from 'node:assert/strict';
import {PaperEngine} from './paper-engine.mjs';
const NOW=2_000_000_000_000;
const store=()=>({state:{users:{u:{id:'u',killSwitch:false}},paperPositions:{},paperTrades:{},paperProposals:{},paperProcessed:{},paperMetrics:{}},save(){}});
const token={mint:'mint',priceSol:0.001,holderFresh:true,updatedAt:NOW,lastPriceAt:NOW};
const settings=(x={})=>({operatingMode:'automate',tradingEnvironment:'paper',positionSize:.1,maxPositionSize:.5,maxOpenPositions:4,maxDailyEntries:10,dailySpendLimit:0,tradingCapital:1,dailyLossLimit:0,feeReserve:.05,hardStopPct:25,trailingStopPct:15,tp1Pct:100,tp1SellPct:50,tp2Pct:200,tp2SellPct:25,runnerPct:25,maxHoldMinutes:1440,exitBuyPressure:1,exitOnWeakBuyPressure:true,requireFreshHolderSnapshot:true,decisionFreshnessSec:60,...x});
test('fee reserve reduces deployable capital',()=>{
 const e=new PaperEngine(store(),{clock:()=>NOW});
 const r=e.entryReadiness('u',token,settings({feeReserve:.95}));
 assert.equal(r.checks.find(x=>x.key==='paperCapital').pass,false);
});
test('normal reserve leaves capacity',()=>{
 const e=new PaperEngine(store(),{clock:()=>NOW});
 const r=e.entryReadiness('u',token,settings());
 assert.equal(r.checks.find(x=>x.key==='paperCapital').pass,true);
 assert.equal(r.metrics.feeReserve,.05);
});
""")

# future npm test protects this contract.
p=Path("package.json"); data=json.loads(p.read_text())
expected="node tests/integration.mjs && node tests/billing-cycle.mjs && node tests/owner-live.mjs"
if data["scripts"]["test"] != expected:
    raise SystemExit("package test script changed")
data["scripts"]["test"]="node --test src/filter-upgrade.test.mjs src/candidate-visibility-lifecycle.test.mjs src/paper-engine-unified.test.mjs && node tests/integration.mjs && node tests/billing-cycle.mjs && node tests/owner-live.mjs"
p.write_text(json.dumps(data,indent=2)+"\n")
PY

log "Post-patch syntax checks..."
for f in src/evaluate.mjs src/enrich.mjs src/candidate-visibility.mjs src/openai-intelligence.mjs src/store.mjs src/paper-engine.mjs src/pump-live-trade-feed.mjs app-server.mjs; do
  node --check "$f"
done

log "Canonical tests..."
node --test src/filter-upgrade.test.mjs src/candidate-visibility-lifecycle.test.mjs src/paper-engine-unified.test.mjs

log "Full integration suite..."
npm test

log "Diff validation..."
git diff --check

# Hard guardrail: no OpenAI/archive await is added to liveeval.
if grep -En "await[[:space:]].*(openai|archive|candidateFeed|strategy)" src/liveeval.mjs >/tmp/memeflow-v4-hotpath.txt 2>/dev/null; then
  cat /tmp/memeflow-v4-hotpath.txt
  die "Hot-path guardrail found forbidden awaited work in src/liveeval.mjs."
fi

trap - ERR INT TERM

log "SUCCESS — $PATCH_NAME installed."
log "Backup: $BACKUP"
log "No new RPC/OpenAI/disk await was added to discovery -> diagnostics -> decision."
log "BLOCKED idle 15m, WATCH/BUY READY idle 30m, WAITING idle 60m leave the LIVE feed; audit remains available in memory."
log "OpenAI strategy remains advisory; autoOptimize is forced OFF."
log "Review with: git diff"
