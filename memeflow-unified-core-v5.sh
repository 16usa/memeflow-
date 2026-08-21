#!/usr/bin/env bash
set -Eeuo pipefail
PATCH_NAME="MEMEFLOW_UNIFIED_CORE_V5"
EXPECTED_HEAD="b4d3d18"
log(){ printf '[PATCH] %s\n' "$*"; }
die(){ log "STOP: $*"; exit 1; }

if [[ -f "memeflow-app/app-server.mjs" ]]; then APP="memeflow-app"; elif [[ -f "app-server.mjs" && -f "src/evaluate.mjs" ]]; then APP="."; else die "Cannot locate memeflow-app"; fi
[[ -n "$(git rev-parse --show-toplevel 2>/dev/null || true)" ]] || die "Not inside git repository"
HEAD_NOW="$(git rev-parse --short=7 HEAD)"
[[ "$HEAD_NOW" == "$EXPECTED_HEAD" ]] || die "Expected pushed baseline $EXPECTED_HEAD but current HEAD is $HEAD_NOW. Nothing changed."
cd "$APP"

declare -A EXPECTED=(
  ["src/single-instance-lock.mjs"]="230ca13ca489811086103301b51c4cd624a5e919"
  ["src/evaluate.mjs"]="75b87886049154ddfbcb2f4be68ef597ff6a6e5b"
  ["src/enrich.mjs"]="3689c5f82598bfeb730d3f935a435760364faedb"
  ["src/candidate-visibility.mjs"]="495fa418774fac70d3b595ccad5da90e029099e1"
  ["src/store.mjs"]="d32c7d08b03149485c7e567199094cdcb7709c3f"
  ["src/paper-engine.mjs"]="1d5c7de4d14929b214cdb6ceefae8e419cdc5a4e"
  ["src/openai-intelligence.mjs"]="9c716b02989c2708d730209cc576d69543205f84"
  ["app-server.mjs"]="b5cad58041c0bdf32f3a7e2fe4f4c592df0cd85d"
  ["package.json"]="56efce7459ba0e28290a3e84fbaef58dc432a77a"
)
log "Preflight against pushed commit $EXPECTED_HEAD..."
for f in "${!EXPECTED[@]}"; do [[ -f "$f" ]] || die "Missing $f"; a="$(git hash-object "$f")"; [[ "$a" == "${EXPECTED[$f]}" ]] || die "$f differs from pushed baseline. Nothing changed."; done

log "Baseline syntax checks..."
for f in src/single-instance-lock.mjs src/evaluate.mjs src/enrich.mjs src/candidate-visibility.mjs src/store.mjs src/paper-engine.mjs src/openai-intelligence.mjs app-server.mjs; do node --check "$f" >/dev/null; done

BACKUP=".memeflow-unified-core-v5-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/src"
for f in src/single-instance-lock.mjs src/evaluate.mjs src/enrich.mjs src/candidate-visibility.mjs src/store.mjs src/paper-engine.mjs src/openai-intelligence.mjs; do cp "$f" "$BACKUP/$f"; done
cp app-server.mjs "$BACKUP/app-server.mjs"; cp package.json "$BACKUP/package.json"
rollback(){ c=$?; log "Validation failed; restoring baseline..."; for f in src/single-instance-lock.mjs src/evaluate.mjs src/enrich.mjs src/candidate-visibility.mjs src/store.mjs src/paper-engine.mjs src/openai-intelligence.mjs; do cp "$BACKUP/$f" "$f" || true; done; cp "$BACKUP/app-server.mjs" app-server.mjs || true; cp "$BACKUP/package.json" package.json || true; rm -f src/unified-core.test.mjs; log "Rollback complete. Backup: $BACKUP"; exit "$c"; }
trap rollback ERR INT TERM

log "Applying unified-core changes..."
python3 - <<'PY'
from pathlib import Path
import json

def rep(path, old, new, label):
    p=Path(path); s=p.read_text(encoding='utf-8'); n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 anchor, found {n}')
    p.write_text(s.replace(old,new,1),encoding='utf-8')

rep('src/single-instance-lock.mjs',"const DATA=path.join(APP,'data');","const DATA=path.resolve(APP,process.env.DATA_DIR||'data');",'lock DATA_DIR')

rep('src/evaluate.mjs',"""function metadataKnown(t={}){
  return Boolean(t.metadataReady===true||t.metadataFetched===true||t.metadataResolved===true||t.name||t.symbol||t.uri||t.metadataUri);
}""","""function metadataKnown(t={}){
  const s=socials(t);
  return Boolean(t.metadataReady===true||t.metadataFetched===true||t.metadataResolved===true||(t.metadataFetchedAt&&!t.metadataError)||s.twitter||s.website||s.telegram);
}""",'metadataKnown')
rep('src/evaluate.mjs',"""  const addMin=(name,value,limit,reason,zeroDisables=true)=>{
    if(!finite(limit))return;const x=Number(limit);if(zeroDisables&&x<=0)return;
    addGate(name,value===null?null:value>=x,reason,{value,threshold:x,operator:'>='});
  };
  const addMax=(name,value,limit,reason)=>{
    if(!finite(limit))return;const x=Number(limit);
    addGate(name,value===null?null:value<=x,reason,{value,threshold:x,operator:'<='});
  };""","""  const addMin=(name,value,limit,reason,zeroDisables=true)=>{
    if(!finite(limit))return;const x=Number(limit);if(zeroDisables&&x<=0)return;
    const pending=`${name.replace(/^(Minimum|Maximum)\\s+/,'')} data pending`;
    addGate(name,value===null?null:value>=x,value===null?pending:reason,{value,threshold:x,operator:'>='});
  };
  const addMax=(name,value,limit,reason)=>{
    if(!finite(limit))return;const x=Number(limit);
    const pending=`${name.replace(/^(Minimum|Maximum)\\s+/,'')} data pending`;
    addGate(name,value===null?null:value<=x,value===null?pending:reason,{value,threshold:x,operator:'<='});
  };""",'pending diagnostics')
rep('src/evaluate.mjs',"addMax('Maximum holders',v.holders,s.maxHolders,`holders above ${s.maxHolders}`);","addMax('Maximum holders',v.holders,s.maxHolders,`holders above maximum ${s.maxHolders}`);",'max holders wording')
rep('src/evaluate.mjs',"if(s.requireTwitter===true)addGate('Twitter / X required',known?Boolean(soc.twitter):null,'Twitter / X is required');","if(s.requireTwitter===true)addGate('Twitter / X required',known?Boolean(soc.twitter):null,'Twitter/X required');",'twitter wording')
rep('src/evaluate.mjs',"addGate('Developer blacklist',creator?!bl.includes(creator):null,'developer wallet is blacklisted');","addGate('Developer blacklist',creator?!bl.includes(creator):null,'Developer wallet is blacklisted');",'developer wording')
rep('src/evaluate.mjs',"""  const minScore=finite(s.minScore)?Number(s.minScore):null;
  const minConfidence=finite(s.minConfidence)?Number(s.minConfidence):null;
  const scorePass=minScore===null||score>=minScore;
  const confPass=minConfidence===null||confidence>=minConfidence;
  gates.push({name:'Minimum AI score',status:scorePass?'PASS':'FAIL',pass:scorePass,value:score,threshold:minScore});
  if(!scorePass){blocked=true;reasons.push(`AI score ${score} below configured minimum ${minScore}`)}
  gates.push({name:'Minimum data confidence',status:confPass?'PASS':'FAIL',pass:confPass,value:confidence,threshold:minConfidence});
  if(!confPass){blocked=true;reasons.push(`data confidence ${confidence}% below configured minimum ${minConfidence}%`)}

  const state=blocked?'BLOCKED':waiting?'WAITING':scorePass&&confPass?'BUY READY':'WATCH';""","""  const minScore=finite(s.minScore)?Number(s.minScore):null;
  const minConfidence=finite(s.minConfidence)?Number(s.minConfidence):null;
  const scorePass=minScore===null||score>=minScore;
  const confPass=minConfidence===null||confidence>=minConfidence;
  const dexToken=String(token?.launchPlatform||'').toLowerCase()==='dex';
  const aiCore=dexToken?[v.holders,v.top10,v.pressure,v.price]:[v.holders,v.top10,v.developer,v.pressure,v.price];
  const aiCorePending=aiCore.some(x=>x===null)||(s.requireFreshHolderSnapshot===true&&token.holderFresh!==true);
  const deferAiThresholds=waiting||aiCorePending;
  const scoreStatus=scorePass?'PASS':deferAiThresholds?'WAITING':'FAIL';
  gates.push({name:'Minimum AI score',status:scoreStatus,pass:scoreStatus==='PASS',value:score,threshold:minScore});
  if(!scorePass){if(deferAiThresholds){waiting=true;reasons.push(`Waiting: AI score evidence incomplete (${score}/${minScore})`)}else{blocked=true;reasons.push(`AI score ${score} below configured minimum ${minScore}`)}}
  const confStatus=confPass?'PASS':deferAiThresholds?'WAITING':'FAIL';
  gates.push({name:'Minimum data confidence',status:confStatus,pass:confStatus==='PASS',value:confidence,threshold:minConfidence});
  if(!confPass){if(deferAiThresholds){waiting=true;reasons.push(`Waiting: data confidence evidence incomplete (${confidence}%/${minConfidence}%)`)}else{blocked=true;reasons.push(`data confidence ${confidence}% below configured minimum ${minConfidence}%`)}}

  const state=blocked?'BLOCKED':waiting?'WAITING':scorePass&&confPass?'BUY READY':'WATCH';""",'AI WAITING semantics')

rep('src/enrich.mjs',"""    return {
      metadataUrl,
      imageUrl:firstMetadataImage(metadata),
      metadataName:typeof metadata?.name === 'string' ? metadata.name.slice(0,160) : null,
      metadataSymbol:typeof metadata?.symbol === 'string' ? metadata.symbol.slice(0,40) : null
    };""","""    const firstText=(...values)=>{for(const value of values){if(typeof value==='string'&&value.trim())return value.trim().slice(0,500)}return null};
    return {
      metadataUrl,
      imageUrl:firstMetadataImage(metadata),
      metadataName:typeof metadata?.name === 'string' ? metadata.name.slice(0,160) : null,
      metadataSymbol:typeof metadata?.symbol === 'string' ? metadata.symbol.slice(0,40) : null,
      twitter:firstText(metadata?.twitter,metadata?.x,metadata?.extensions?.twitter,metadata?.links?.twitter,metadata?.socials?.twitter,metadata?.socials?.x),
      website:firstText(metadata?.website,metadata?.extensions?.website,metadata?.links?.website,metadata?.socials?.website),
      telegram:firstText(metadata?.telegram,metadata?.extensions?.telegram,metadata?.links?.telegram,metadata?.socials?.telegram)
    };""",'metadata socials')
rep('src/enrich.mjs','\n\n\n// ── Helpers','\n\nconst metadataJobs=new Map();\n\n// ── Helpers','metadata job map')
rep('src/enrich.mjs',"""    let metadataPatch = {};
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
    }


    const update = {
      ...metadataPatch,""","""    const metadataNeedsRefresh=Boolean(existingToken.uri&&!metadataJobs.has(mint)&&(existingToken.metadataReady!==true||!existingToken.metadataFetchedAt||Date.now()-Number(existingToken.metadataFetchedAt)>6*60*60*1000));

    const update = {
      metadataPending:metadataNeedsRefresh,""",'detach metadata')
rep('src/enrich.mjs',"""    publish(mint);
    if (ensurePriceTimer && token?.dexConfirmed !== true) ensurePriceTimer(mint, curve);

    // Success: token stored and published regardless of step failures""","""    publish(mint);
    if (ensurePriceTimer && token?.dexConfirmed !== true) ensurePriceTimer(mint, curve);

    if(metadataNeedsRefresh&&!metadataJobs.has(mint)){
      const metadataJob=fetchTokenMetadata(existingToken.uri)
        .then(async metadata=>{
          const previous=store.state.tokens[mint]||{};
          const socialPatch={twitter:metadata.twitter??previous.twitter??null,website:metadata.website??previous.website??null,telegram:metadata.telegram??previous.telegram??null};
          const next=store.setToken(mint,{metadataFetchedAt:Date.now(),metadataFetched:true,metadataReady:true,metadataPending:false,metadataError:null,metadataUrl:metadata.metadataUrl,imageUrl:metadata.imageUrl??previous.imageUrl??null,image:metadata.imageUrl??previous.image??previous.imageUrl??null,logoUrl:metadata.imageUrl??previous.logoUrl??previous.imageUrl??null,metadataName:metadata.metadataName,metadataSymbol:metadata.metadataSymbol,...socialPatch,socials:{...(previous.socials||{}),...socialPatch}});
          try{await evaluateAll(next)}catch(error){recordEnrichError(enrichDiag,mint,'evaluate(metadata)',error)}
          publish(mint);
        })
        .catch(error=>{store.setToken(mint,{metadataPending:false,metadataReady:false,metadataFetched:false,metadataFetchFailedAt:Date.now(),metadataError:sanitize(error?.message||String(error))});recordEnrichError(enrichDiag,mint,'metadata',error);publish(mint)})
        .finally(()=>metadataJobs.delete(mint));
      metadataJobs.set(mint,metadataJob);
    }

    // Success: token stored and published regardless of step failures""",'background metadata')

Path('src/candidate-visibility.mjs').write_text(r"""const terminalStates=new Set(['EXPIRED','BLOCKED','REJECTED','CLOSED','IGNORED']);
const FILTERED_LIVE_TTL_MS=Math.max(60000,Number(process.env.MEMEFLOW_FILTERED_LIVE_TTL_MS||15*60_000));
const PASSIVE_LIVE_TTL_MS=Math.max(FILTERED_LIVE_TTL_MS,Number(process.env.MEMEFLOW_PASSIVE_LIVE_TTL_MS||60*60_000));
function tsMs(v){if(v===null||v===undefined||v==='')return null;if(typeof v==='number'&&Number.isFinite(v))return v<1e12?v*1000:v;const n=Number(v);if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;const d=Date.parse(String(v));return Number.isFinite(d)?d:null}
function activityAt(token={},decision={}){for(const v of [token.lastMarketActivityAt,token.lastPriceChangeAt,token.discoveredAt,token.createdAt,token.firstSeenAt,decision.createdAt,decision.updatedAt]){const ms=tsMs(v);if(ms!==null)return ms}return null}
function lookup(tokenLookup,mint){if(typeof tokenLookup==='function')return tokenLookup(mint)||null;if(tokenLookup&&typeof tokenLookup==='object')return tokenLookup[mint]||null;return null}
export function isDecisionArchived(decision={},token=null,now=Date.now()){if(!token||typeof token!=='object')return false;const state=String(decision.state||'WAITING').trim().toUpperCase();if(state==='BUY READY')return false;const a=activityAt(token,decision);if(a===null)return false;const idle=Math.max(0,Number(now)-a);if(state==='WAITING'||state==='WATCH')return idle>=PASSIVE_LIVE_TTL_MS;if(terminalStates.has(state)||decision.terminal===true)return idle>=FILTERED_LIVE_TTL_MS;return false}
export function classifyDecisionVisibility(decision={},token=null,now=Date.now()){if(isDecisionArchived(decision,token,now))return 'archived';const state=String(decision.state||'WAITING').trim().toUpperCase();const closed=decision.terminal===true||String(decision.lifecycle||'').toLowerCase()==='closed'||terminalStates.has(state);if(state==='BUY READY'&&!closed)return 'candidate';if(state==='WAITING'&&!closed)return 'processing';if(state==='WATCH'&&!closed)return 'watch';return 'filtered'}
export function candidateFeed(decisions=[],scope='candidates',tokenLookup=null,now=Date.now()){const rows=Array.isArray(decisions)?decisions.filter(Boolean):[];const normalized=String(scope||'candidates').trim().toLowerCase();const kind=row=>classifyDecisionVisibility(row,lookup(tokenLookup,row?.mint),now);if(normalized==='audit')return rows;if(normalized==='archived')return rows.filter(x=>kind(x)==='archived');if(normalized==='all')return rows.filter(x=>kind(x)!=='archived');if(normalized==='processing')return rows.filter(x=>kind(x)==='processing');if(normalized==='watch')return rows.filter(x=>kind(x)==='watch');if(normalized==='filtered')return rows.filter(x=>kind(x)==='filtered');return rows.filter(x=>kind(x)==='candidate')}
export function candidateVisibilityCounts(decisions=[],tokenLookup=null,now=Date.now()){const c={candidates:0,processing:0,watch:0,filtered:0,archived:0,visible:0,totalEvaluated:0};for(const row of Array.isArray(decisions)?decisions:[]){if(!row)continue;c.totalEvaluated++;const k=classifyDecisionVisibility(row,lookup(tokenLookup,row?.mint),now);if(k==='archived'){c.archived++;continue}c.visible++;if(k==='candidate')c.candidates++;else if(k==='processing')c.processing++;else if(k==='watch')c.watch++;else c.filtered++}return c}
""",encoding='utf-8')

rep('app-server.mjs',"""  const _all=store.decisions(u.id);
  const _selected=candidateFeed(_all,_scope);
  const _counts=candidateVisibilityCounts(_all);""","""  const _all=store.decisions(u.id);
  const _tokenLookup=(mint)=>store.state.tokens?.[mint]||null;
  const _selected=candidateFeed(_all,_scope,_tokenLookup);
  const _counts=candidateVisibilityCounts(_all,_tokenLookup);""",'feed lookup')

rep('src/store.mjs',"  touchUser(id){this.user(id).lastActiveAt=Date.now();this.save();return this.user(id)}","""  touchUser(id){const u=this.user(id),now=Date.now(),previous=Number(u.lastActiveAt||0);u.lastActiveAt=now;if(!previous||now-previous>=60_000)this.save();return u}""",'touch throttle')
rep('src/store.mjs',"""    // Decisions are intentionally in-memory only; do not schedule a disk write.
  }
  decisions(uid){""","""    // Decisions are intentionally in-memory only; do not schedule a disk write.
  }
  deleteDecision(uid,mint){const key=uid+':'+mint,existed=Boolean(this.state.decisions[key]);delete this.state.decisions[key];const m=this._uidDec[uid];if(m){m.delete(key);if(!m.size)delete this._uidDec[uid]}return existed}
  decisions(uid){""",'deleteDecision')

rep('src/paper-engine.mjs',"""      dailySpendLimit: Math.max(0, num(settings.dailySpendLimit, 0)),
      tradingCapital: Math.max(0, num(settings.tradingCapital, 0)),
      dailyLossLimit: Math.max(0, num(settings.dailyLossLimit, 0)),""","""      dailySpendLimit: Math.max(0, num(settings.dailySpendLimit, 0)),
      tradingCapital: Math.max(0, num(settings.tradingCapital, 0)),
      feeReserve: Math.max(0, num(settings.feeReserve, 0)),
      dailyLossLimit: Math.max(0, num(settings.dailyLossLimit, 0)),""",'fee reserve setting')
rep('src/paper-engine.mjs',"""    const capitalAvailable =
      s.tradingCapital <= 0 ||
      deployed + s.positionSize <= s.tradingCapital;""","""    const spendableCapital=s.tradingCapital<=0?Infinity:Math.max(0,s.tradingCapital-s.feeReserve);
    const capitalAvailable=s.tradingCapital<=0||deployed+s.positionSize<=spendableCapital;""",'fee reserve gate')
rep('src/paper-engine.mjs',"""        deployed,
        tradingCapital: s.tradingCapital,
        dailyRealizedPnl,""","""        deployed,
        tradingCapital: s.tradingCapital,
        feeReserve: s.feeReserve,
        spendableCapital: Number.isFinite(spendableCapital)?spendableCapital:null,
        dailyRealizedPnl,""",'fee reserve metrics')

rep('src/openai-intelligence.mjs','enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:true,','enabled:true,analyze:true,assist:true,autoAi:true,learning:true,strategyCoach:true,autoOptimize:false,','AI default')
rep('src/openai-intelligence.mjs','u.ai.settings={...aiDefaults(),...(u.ai.settings||{})};','u.ai.settings={...aiDefaults(),...(u.ai.settings||{}),autoOptimize:false};','AI persisted')
rep('src/openai-intelligence.mjs',"if(url.pathname==='/api/openai/settings'&&req.method==='PUT'){const b=await readBody(req),ai=this.userState(uid),next={...ai.settings,...(b.settings||{}),updatedAt:now()};delete next.userId;ai.settings=next;this.save();return {status:200,body:{settings:ai.settings}}}","if(url.pathname==='/api/openai/settings'&&req.method==='PUT'){const b=await readBody(req),ai=this.userState(uid),next={...ai.settings,...(b.settings||{}),autoOptimize:false,updatedAt:now()};delete next.userId;ai.settings=next;this.save();return {status:200,body:{settings:ai.settings}}}",'AI PUT')
rep('src/openai-intelligence.mjs',"""  async applyProposal(uid,proposal){
    const ai=this.userState(uid),cfg=ai.settings;if(!cfg.autoOptimize)return {applied:false,reason:'AUTO_OPTIMIZE_DISABLED'};
    const allowed=cfg.allowedAutoTune?.[proposal.setting];if(!allowed)return {applied:false,reason:'SETTING_NOT_ALLOWED'};
    if((cfg.lockedSettings||[]).includes(proposal.setting))return {applied:false,reason:'SETTING_LOCKED'};
    if(Number(proposal.confidence)<80)return {applied:false,reason:'CONFIDENCE_BELOW_80'};
    const current=this.store.settings(uid),n=Number(proposal.proposed);if(!Number.isFinite(n))return {applied:false,reason:'NON_NUMERIC_PROPOSAL'};
    const next={...current,[proposal.setting]:clamp(n,Number(allowed.min),Number(allowed.max))};this.store.setSettings(uid,next);
    this.audit(uid,'auto_optimize',{setting:proposal.setting,from:current[proposal.setting],to:next[proposal.setting]});return {applied:true,setting:proposal.setting,value:next[proposal.setting]};
  }""","""  async applyProposal(uid,proposal){
    const ai=this.userState(uid),cfg=ai.settings;const allowed=cfg.allowedAutoTune?.[proposal.setting];if(!allowed)return {applied:false,reason:'SETTING_NOT_ALLOWED'};if((cfg.lockedSettings||[]).includes(proposal.setting))return {applied:false,reason:'SETTING_LOCKED'};if(Number(proposal.confidence)<80)return {applied:false,reason:'CONFIDENCE_BELOW_80'};const n=Number(proposal.proposed);if(!Number.isFinite(n))return {applied:false,reason:'NON_NUMERIC_PROPOSAL'};const value=clamp(n,Number(allowed.min),Number(allowed.max));return {applied:false,reason:'PROPOSAL_ONLY_POLICY',setting:proposal.setting,value,settingsPatch:{[proposal.setting]:value},applyVia:'/api/settings'};
  }""",'AI apply proposal')

Path('src/unified-core.test.mjs').write_text(r"""import test from 'node:test';import assert from 'node:assert/strict';import {defaultSettings,normalizeSettings} from './settings.mjs';import {evaluate} from './evaluate.mjs';import {candidateFeed,candidateVisibilityCounts,classifyDecisionVisibility} from './candidate-visibility.mjs';import {PaperEngine} from './paper-engine.mjs';import {OpenAIIntelligence} from './openai-intelligence.mjs';
const NOW=2_000_000_000_000,M=60_000;const base=(p={})=>({mint:'Mint111',launchPlatform:'pump',holderCount:50,holderFresh:true,priceSol:1,dataQuality:1,buyPressure:2,top10Pct:20,developerPct:10,metadataReady:true,discoveredAt:NOW-5*M,...p});
test('social waits for real metadata',()=>{const s=normalizeSettings({...defaultSettings(),requireAnySocial:true,minScore:0,minConfidence:0});assert.equal(evaluate(base({metadataReady:false,metadataFetched:false,metadataFetchedAt:null,twitter:null,website:null,telegram:null}),s).state,'WAITING')});
test('resolved missing social blocks',()=>{const s=normalizeSettings({...defaultSettings(),requireAnySocial:true,minScore:0,minConfidence:0});assert.equal(evaluate(base({metadataReady:true,twitter:null,website:null,telegram:null}),s).state,'BLOCKED')});
test('missing metric stays WAITING despite low AI thresholds',()=>{const s=normalizeSettings({...defaultSettings(),minVolume24hUsd:1000,minScore:95,minConfidence:95});assert.equal(evaluate(base({volume24hUsd:null}),s).state,'WAITING')});
test('known hard failure still BLOCKS',()=>{const s=normalizeSettings({...defaultSettings(),minVolume24hUsd:1000,maxTop10Pct:25,minScore:95,minConfidence:95});assert.equal(evaluate(base({top10Pct:80,volume24hUsd:null}),s).state,'BLOCKED')});
test('stale BLOCKED leaves live but stays audit',()=>{const d=[{mint:'dead',state:'BLOCKED'}],t={dead:{discoveredAt:NOW-20*M,lastMarketActivityAt:NOW-16*M}},lookup=m=>t[m];assert.equal(candidateFeed(d,'all',lookup,NOW).length,0);assert.equal(candidateFeed(d,'audit',lookup,NOW).length,1);assert.equal(candidateVisibilityCounts(d,lookup,NOW).archived,1)});
test('BUY READY is never housekeeping-hidden',()=>assert.equal(classifyDecisionVisibility({mint:'x',state:'BUY READY'},{discoveredAt:NOW-120*M,lastMarketActivityAt:NOW-120*M},NOW),'candidate'));
function store(){return{state:{users:{u:{id:'u',settings:defaultSettings(),killSwitch:false}},paperPositions:{},paperTrades:{},paperProposals:{},paperProcessed:{},paperMetrics:{entries:0,exits:0,errors:0},tokens:{}},save(){},user(id){return this.state.users[id]},settings(id){return this.state.users[id].settings},setSettings(){throw Error('OpenAI must not mutate settings')}}}
test('fee reserve protects capital',()=>{const st=store(),e=new PaperEngine(st,{clock:()=>NOW}),tok=base({updatedAt:NOW});const r=e.entryReadiness('u',tok,{...defaultSettings(),tradingCapital:1,feeReserve:.1,positionSize:.95,maxPositionSize:1});assert.equal(r.checks.find(x=>x.key==='paperCapital').pass,false)});
test('OpenAI apply is proposal-only',async()=>{const ai=new OpenAIIntelligence({store:store()}),r=await ai.applyProposal('u',{setting:'minScore',proposed:80,confidence:95});assert.equal(r.reason,'PROPOSAL_ONLY_POLICY');assert.deepEqual(r.settingsPatch,{minScore:80})});
""",encoding='utf-8')

p=Path('package.json'); data=json.loads(p.read_text()); data['scripts']['test']="node --test src/filter-upgrade.test.mjs src/unified-core.test.mjs && node tests/integration.mjs && node tests/billing-cycle.mjs && node tests/owner-live.mjs"; p.write_text(json.dumps(data,indent=2)+'\n')
PY

log "Post-patch syntax checks..."
for f in src/single-instance-lock.mjs src/evaluate.mjs src/enrich.mjs src/candidate-visibility.mjs src/store.mjs src/paper-engine.mjs src/openai-intelligence.mjs src/unified-core.test.mjs app-server.mjs; do node --check "$f"; done
if grep -q "await fetchTokenMetadata" src/enrich.mjs; then die "Hot-path guard failed: metadata still awaited"; fi
if grep -Eq "await .*openai|await .*archive|await .*candidateFeed" src/liveeval.mjs; then die "Hot-path guard failed in liveeval"; fi
log "Unified tests..."; node --test src/filter-upgrade.test.mjs src/unified-core.test.mjs
log "Full integration suite..."; npm test
trap - ERR INT TERM
log "SUCCESS — $PATCH_NAME installed and validated."
log "Backup: $BACKUP"
log "Missing data=>WAITING; known hard fail=>BLOCKED; metadata/social fetch detached; stale feed cleanup read-only; feeReserve enforced; OpenAI proposal-only; test lock fixed."
