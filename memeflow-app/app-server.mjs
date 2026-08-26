import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import zlib from 'node:zlib';import {fileURLToPath} from 'node:url';
import {JsonStore,sessionId,defaults} from './src/store.mjs';import {RpcPool,validPubkey,decodeCurve,decodeCreateData,decodePumpCreate,decodePumpCreateEventLog,shouldExcludeMayhemCreate} from './src/solana.mjs';import {evaluate,tokenAgeMinutes} from './src/evaluate.mjs';import {evaluateSettingsAdmission,evaluateEntryAdmission,settingsContextSignature} from './src/settings-gate.mjs';import {validateSettings,PROFILE_PRESETS} from './src/settings.mjs';import {StripeBilling} from './src/billing.mjs';
import {OpenAIIntelligence} from './src/openai-intelligence.mjs';import {PaperEngine} from './src/paper-engine.mjs';import {CopyTradingManager} from './src/copy-trading.mjs'; // MEMEFLOW_COPY_TRADING_V1
import {enrichToken,enrichHolders,makeEnrichDiag,makeHolderQueue,makeHolderMetrics} from './src/enrich.mjs';
import {makeRecoveryMetrics,startDecisionRecovery,lazyRecoverUser} from './src/recovery.mjs';
import {makeLiveEvalMetrics,makeEvaluateForActiveUsers} from './src/liveeval.mjs';
import {makeDiscoveryMetrics,makeDiscoveryQueue} from './src/discqueue.mjs';
import {candidateFeed,candidateVisibilityCounts} from './src/candidate-visibility.mjs';
import {createDexPaidVerifier} from './src/dex-paid.mjs'; // MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1
import { startPumpLiveTradeFeed } from './src/pump-live-trade-feed.mjs'; // MEMEFLOW_V12_21_LIVE_TRADE_STREAM_HOLDER_FEED
import { ChartHistoryArchive } from './src/chart-history-archive.mjs'; // MEMEFLOW_CHART_HISTORY_RESTORE_V1
import {createOpportunityEngine} from './src/opportunity-engine.mjs'; // MEMEFLOW_OPPORTUNITY_ENGINE_V1
import {createSolUsdOracle} from './src/sol-usd-oracle.mjs'; // MEMEFLOW_OPPORTUNITY_ENGINE_V1
import {rankCandidateViews} from './src/feed-ranking.mjs'; // MEMEFLOW_FEED_RELEVANCE_RANKING_V1

import { eventMarketLedger } from './src/event-market-ledger.mjs'; // MEMEFLOW_V12_18_EVENT_MARKET_LEDGER

import { eventHolderLedger } from './src/event-holder-ledger.mjs'; // MEMEFLOW_V12_17_EVENT_HOLDER_LEDGER

import {manualAnalyze} from './src/manual-scan.mjs';
// MEMEFLOW AI ASSISTANT HARD OFF: import disabled
const root=path.dirname(fileURLToPath(import.meta.url)),dataDir=path.resolve(root,process.env.DATA_DIR||'data'),store=new JsonStore(dataDir);
const opportunityEngine=createOpportunityEngine(); // MEMEFLOW_OPPORTUNITY_ENGINE_V1
const solUsdOracle=createSolUsdOracle(); // one shared quote, never per-token RPC
solUsdOracle.start();
const dexPaidVerifier=createDexPaidVerifier({
  minIntervalMs:Math.max(1000,Number(process.env.DEX_PAID_MIN_INTERVAL_MS||1100)),
  timeoutMs:Math.max(1000,Number(process.env.DEX_PAID_TIMEOUT_MS||6000))
}); // MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1

// MEMEFLOW_FRESH_SESSION_SCANNER_V1
// Live scanner data is session-scoped. A restart starts a clean scanner while
// OPEN-position token snapshots remain available for position continuity.
const __mfScannerRuntimeStartedAt=Date.now();
const __mfScannerTokenTtlMs=Math.max(
  5*60_000,
  Number(process.env.LIVE_SCANNER_TOKEN_TTL_MS||3*60*60_000)
);

function __mfOpenPositionMints(){
  const out=new Set();
  for(const p of Object.values(store.state.paperPositions||{})){
    if(String(p?.status||'').toUpperCase()==='OPEN'&&p?.mint)out.add(String(p.mint));
  }
  for(const p of Object.values(store.state.positions||{})){
    if(String(p?.status||'').toUpperCase()==='OPEN'&&p?.mint)out.add(String(p.mint));
  }
  return out;
}

{
  const keep=__mfOpenPositionMints();
  for(const mint of Object.keys(store.state.tokens||{})){
    if(!keep.has(String(mint)))delete store.state.tokens[mint];
  }
  store.state.decisions={};
  store._uidDec={};
  store.save();
}

function __mfIsCurrentScannerToken(token,now=Date.now()){
  if(!token||token.wsFirst!==true)return false;
  const discovered=Number(token.discoveredAt||0);
  if(!(discovered>=__mfScannerRuntimeStartedAt))return false;
  return token.dead!==true && now-discovered<=__mfScannerTokenTtlMs;
}

function __mfLiveScannerTokens(now=Date.now()){
  return store.tokens().filter(token=>__mfIsCurrentScannerToken(token,now));
}

function __mfActiveScannerUserIds(now=Date.now()){
  const cutoff=now-(Number(process.env.LIVE_EVALUATION_ACTIVE_USER_HOURS||24)*3600000);
  return Object.entries(store.state.users||{})
    .filter(([,u])=>u?.isOwner===true||(Number(u?.lastActiveAt||0)>0&&Number(u.lastActiveAt)>=cutoff))
    .map(([uid])=>uid);
}

function __mfAllActiveUsersStableBlocked(mint,now=Date.now()){
  const token=store.state.tokens?.[mint]||null;
  if(!token)return true;

  const uids=__mfActiveScannerUserIds(now);
  if(!uids.length)return false;

  for(const uid of uids){
    const admission=__mfEntryAdmissionForUser(token,uid,null,now);
    if(admission?.admitted===true)return false;
    if(admission?.hasStableFailure!==true)return false;
  }

  return true;
}

function __mfDropScannerToken(mint,reason='PRUNED'){
  mint=String(mint||'');
  if(!mint)return false;
  if(__mfOpenPositionMints().has(mint))return false;

  try{store.removeToken?.(mint)}catch{}
  try{eventHolderLedger?.dropMint?.(mint)}catch{}
  try{opportunityEngine?.dropMint?.(mint)}catch{}
  try{dexPaidVerifier?.drop?.(mint)}catch{}
  try{__pumpLiveTradeFeed?.dropMint?.(mint)}catch{}
  try{chartTradeHistory?.delete?.(mint)}catch{}
  try{
    const t=priceTimers?.get?.(mint);
    if(t)clearTimeout(t);
    priceTimers?.delete?.(mint);
  }catch{}
  try{tradeWindows?.delete?.(mint)}catch{}
  try{
    for(const key of __mfEntryAdmissionState?.keys?.()||[]){
      if(String(key).endsWith(':'+mint))__mfEntryAdmissionState.delete(key);
    }
  }catch{}
  try{__systemViewEmitV31('token_removed',{mint,reason,ts:Date.now()})}catch{}
  return true;
}

function __mfPruneScannerRuntimeState(now=Date.now()){
  const open=__mfOpenPositionMints();
  const liveMints=new Set();

  for(const token of Object.values(store.state.tokens||{})){
    const mint=String(token?.mint||'');
    if(!mint)continue;
    if(open.has(mint))continue;

    const lifecycleReason=
      token?.dead===true
        ? (token.deadReason||'DEAD')
        : opportunityEngine?.staleReason?.(token,now);

    if(lifecycleReason){
      __mfDropScannerToken(mint,lifecycleReason);
      continue;
    }

    if(!__mfIsCurrentScannerToken(token,now)){
      __mfDropScannerToken(mint,'SESSION_OR_TTL_EXPIRED');
      continue;
    }

    const age=Math.max(0,now-Number(token.discoveredAt||now));
    if(age>=15_000&&__mfAllActiveUsersStableBlocked(mint,now)){
      __mfDropScannerToken(mint,'STABLE_SETTINGS_REJECTED');
      continue;
    }

    liveMints.add(mint);
  }

  for(const [key,d] of Object.entries(store.state.decisions||{})){
    const mint=String(d?.mint||'');
    if(mint&&!liveMints.has(mint)&&!open.has(mint))delete store.state.decisions[key];
  }

  for(const [uid,index] of Object.entries(store._uidDec||{})){
    for(const key of [...index.keys()]){
      if(!store.state.decisions?.[key])index.delete(key);
    }
    if(!index.size)delete store._uidDec[uid];
  }
}

const __mfScannerPruneTimer=setInterval(
  ()=>__mfPruneScannerRuntimeState(),
  Math.max(1000,Number(process.env.LIVE_SCANNER_PRUNE_MS||5000))
);
__mfScannerPruneTimer.unref?.();

const paper=new PaperEngine(store);
const billing=new StripeBilling({store,secretKey:process.env.STRIPE_SECRET_KEY,priceId:process.env.STRIPE_PRICE_ID,webhookSecret:process.env.STRIPE_WEBHOOK_SECRET,apiBase:process.env.STRIPE_API_BASE});
const rpcUrls=(process.env.SOLANA_RPC_URLS||'').split(',').map(x=>x.trim()).filter(Boolean),wsUrls=(process.env.SOLANA_WS_URLS||'').split(',').map(x=>x.trim()).filter(Boolean);const rpc=new RpcPool(rpcUrls,process.env.SOLANA_COMMITMENT||'confirmed');

// MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
// Dedicated RPC pool for the FINAL BUY READY -> OPEN POSITION verification.
const __mfPreOpenRpcUrls=(
  process.env.PREOPEN_SOLANA_RPC_URLS ||
  process.env.SOLANA_RPC_URLS ||
  ''
).split(',').map(x=>x.trim()).filter(Boolean);

const __mfPreOpenRpc=
  new RpcPool(
    __mfPreOpenRpcUrls,
    process.env.SOLANA_COMMITMENT||'confirmed'
  );

const copyTrading=new CopyTradingManager({store,paper,rpc});
// MEMEFLOW_CHART_HISTORY_RESTORE_V1
const __mfChartHistoryRpcUrls=(process.env.CHART_HISTORY_RPC_URLS||process.env.SOLANA_RPC_URLS||'')
  .split(',').map(x=>x.trim()).filter(Boolean);
const __mfChartHistoryRpc=new RpcPool(
  __mfChartHistoryRpcUrls,
  process.env.SOLANA_COMMITMENT||'confirmed'
);
__mfChartHistoryRpc.minIntervalMs=Math.max(
  250,
  Number(process.env.CHART_HISTORY_RPC_MIN_INTERVAL_MS||450)
);
__mfChartHistoryRpc.methodMinIntervalMs.getTransaction=Math.max(
  250,
  Number(process.env.CHART_HISTORY_GET_TRANSACTION_MIN_INTERVAL_MS||350)
);
const __mfChartArchive=new ChartHistoryArchive({
  dataDir,
  rpc:__mfChartHistoryRpc,
  pageSize:Number(process.env.CHART_HISTORY_PAGE_SIZE||1000),
  txConcurrency:Number(process.env.CHART_HISTORY_TX_CONCURRENCY||3)
});
const PUMP='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',ALLOW_ANON=process.env.ALLOW_ANONYMOUS_PAPER!=='false';
const EXCLUDE_MAYHEM_MODE=process.env.EXCLUDE_MAYHEM_MODE!=='false';
const OWNER_ACCESS_KEY=process.env.OWNER_ACCESS_KEY||'';
const OWNER_USER_IDS=new Set((process.env.OWNER_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean));
const openaiAI=new OpenAIIntelligence({
  store,
  executeTrade:async({uid,mint,side,amountSol})=>({
    executed:false,
    error:'LIVE_EXECUTION_NOT_READY',
    message:'AUTO AI reached the execution adapter, but this MEMEFLOW build has no verified production wallet signing/execution engine yet.',
    uid,mint,side,amountSol
  })
});
let discovery={connected:false,url:null,lastEventAt:null,reconnects:0,error:null,lastError:null,startedAt:Date.now()},ws=null,wsTimer=null,wsReconnectAttempt=0;
const streams=new Map(),priceTimers=new Map(),tradeWindows=new Map();

// MEMEFLOW_LIVE_SYSTEM_SSE_BACKEND_V4
// Read-only System View event transport. No settings, decisions or positions are mutated here.
const __systemViewStreamsV31 = new Set();
let __systemViewSeqV31 = 0;
const __systemViewLastMintV31 = new Map();

function __systemViewEmitV31(type,payload={}){
  if(!__systemViewStreamsV31.size)return;

  const now=Date.now();
  if(type==='token'&&payload?.mint){
    const key=String(payload.mint);
    const previous=Number(__systemViewLastMintV31.get(key)||0);
    // publish() can fire multiple times in the same tick; keep the visual stream bounded.
    if(now-previous<18)return;
    __systemViewLastMintV31.set(key,now);
    if(__systemViewLastMintV31.size>1000){
      for(const [mint,ts] of __systemViewLastMintV31){
        if(now-ts>30000)__systemViewLastMintV31.delete(mint);
      }
    }
  }

  const eventType=String(type||'system').replace(/[^a-z0-9_-]/gi,'');
  const body=JSON.stringify({type:eventType,seq:++__systemViewSeqV31,ts:now,...payload});
  const frame=`event: ${eventType}\ndata: ${body}\n\n`;

  for(const res of [...__systemViewStreamsV31]){
    try{res.write(frame)}catch{__systemViewStreamsV31.delete(res)}
  }
}

const chartTradeStreams=new Map(),chartTradeHistory=new Map();

// MEMEFLOW_CHART_HISTORY_RESTORE_V1
// Trading chart source of truth:
//   persistent archive + bounded real-time Pump TradeEvent hot cache.
// This is display-only and does not change AI/risk/trading decisions.
const __mfChartBackfillJobs=new Map();

function __mfChartSnapshotPayload(mint){
  const hot=chartTradeHistory.get(mint)||[];
  let points=[];

  try{
    points=__mfChartArchive.mergePointsSync(mint,hot);
  }catch{
    points=Array.isArray(hot)?hot.slice():[];
  }

  // MEMEFLOW_CHART_TRADE_FEED_V2
  // REAL-TRADES-ONLY: do not manufacture a candle from a timer/current-price
  // mark. If history is empty we wait for a canonical BUY/SELL TradeEvent.
  let archiveStatus={
    running:false,
    oldestComplete:false,
    lastError:null
  };
  try{
    archiveStatus=__mfChartArchive.statusSync(mint);
  }catch{}

  const last=points[points.length-1]||null;

  return {
    points,
    status:{
      stale:points.length===0,
      source:last?.source||'pump-trade-event',
      historyPoints:points.length,
      historyStartAt:points[0]?.t||null,
      historyEndAt:last?.t||null,
      backfillRunning:
        archiveStatus.running===true ||
        __mfChartBackfillJobs.has(mint),
      fullHistoryReady:archiveStatus.oldestComplete===true,
      backfillError:archiveStatus.lastError||null
    },
    tokenAddress:mint
  };
}

function __mfBroadcastChartSnapshot(mint){
  const listeners=chartTradeStreams.get(mint);
  if(!listeners?.size)return;

  const frame=
    `event: snapshot\n`+
    `data: ${JSON.stringify(__mfChartSnapshotPayload(mint))}\n\n`;

  for(const res of [...listeners]){
    try{
      res.write(frame);
    }catch{
      listeners.delete(res);
    }
  }
}

function __mfEnsureChartBackfill(mint){
  if(!mint||__mfChartBackfillJobs.has(mint))return;

  try{
    const status=__mfChartArchive.statusSync(mint);
    if(status?.oldestComplete===true)return;
  }catch{}

  const job=__mfChartArchive.ensureBackfill(mint,{
    onProgress:()=>__mfBroadcastChartSnapshot(mint)
  })
    .then(()=>{
      __mfBroadcastChartSnapshot(mint);
    })
    .catch(error=>{
      console.warn(
        '[chart-history] backfill',
        mint,
        error?.message||error
      );
      __mfBroadcastChartSnapshot(mint);
    })
    .finally(()=>{
      if(__mfChartBackfillJobs.get(mint)===job){
        __mfChartBackfillJobs.delete(mint);
      }
      // MEMEFLOW_CHART_TRADE_FEED_V2
      // One final frame after deleting the job flips HISTORY SYNC to the
      // final status and exposes the last archived TradeEvents.
      queueMicrotask(()=>__mfBroadcastChartSnapshot(mint));
    });

  __mfChartBackfillJobs.set(mint,job);
}
const priceLifecycleDiag=new Map(); // V10 read-only lifecycle diagnostics

// MEMEFLOW_V12_24_CREATOR_GATE_RECOVERY
function __v1224CreatorFromToken(t){
  if(!t)return null;
  return t.creator || t.creatorWallet || t.developer || t.developerWallet || t.devWallet || null;
}
function __v1224LinkCreator(mint,token){
  try{
    const c=__v1224CreatorFromToken(token||__v1223Token(mint));
    if(c)eventHolderLedger?.setCreator?.(mint,c);
    return c||null;
  }catch{return null}
}
function __v1224HasEventHolder(mint){
  try{
    const s=eventHolderLedger?.inspect?.(mint);
    return !!(s && s.holderFresh===true && s.eventLedgerVersion);
  }catch{return false}
}
function __v1224GateForMint(mint,settings){
  try{
    const t=__v1223Token(mint);
    return __v1223Gate(t,settings);
  }catch{
    return {state:'WAITING',failed:[],waiting:['diagnostic'],checks:{}};
  }
}
// MEMEFLOW_V12_23_FRESH_WARMING_GATE_DIAGNOSTICS
const __V12_23_FRESH_EVENT_ONLY_MS=Math.max(30000,Number(process.env.FRESH_PUMP_EVENT_ONLY_MS||180000));

function __v1223Token(mint){
  try{
    return store?.getToken?.(mint) ||
      store?.state?.tokens?.[mint] ||
      (Array.isArray(store?.state?.tokens) ? store.state.tokens.find(x=>x?.mint===mint) : null) ||
      null;
  }catch{return null}
}
function __v1223Ts(t){
  for(const k of ['createdAt','discoveredAt','firstSeenAt','seenAt','created_at','discovered_at']){
    const v=t?.[k];
    if(v==null)continue;
    const n=typeof v==='number'?v:Date.parse(v);
    if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;
  }
  return null;
}
function __v1223IsPump(t){
  return !!t && (
    String(t.launchPlatform||'').toLowerCase()==='pump' ||
    String(t.protocol||'').toLowerCase()==='pump' ||
    String(t.source||'').toLowerCase().includes('pump')
  );
}
function __v1223FreshPump(mint){
  const t=__v1223Token(mint);
  if(!__v1223IsPump(t))return false;
  const ts=__v1223Ts(t);
  if(ts==null){
    // Pump CREATE tokens without a usable timestamp are treated as fresh only
    // while the fast-phase flag/lane says they are still in the fresh path.
    return t?.fastPhaseReady===true || t?.schedulerLane==='fresh-priority' || String(t?.source||'').toLowerCase().includes('pump create');
  }
  return (Date.now()-ts)<=__V12_23_FRESH_EVENT_ONLY_MS;
}
function __v1223Gate(t,settings){
  const h=Number(t?.holderCount ?? t?.holders ?? t?.holder?.count);
  const top=Number(t?.top10Pct ?? t?.holder?.top10Pct);
  const dev=Number(t?.developerPct ?? t?.developerSharePct ?? t?.holder?.developerPct);
  const bp=Number(t?.buyPressure ?? t?.market?.buyPressure);

  const minH=Number(settings?.minHolders);
  const maxT=Number(settings?.maxTop10Pct);
  const maxD=Number(settings?.maxDeveloperPct);
  const minB=Number(settings?.minBuyPressure);

  const check=(value,limit,op)=>{
    if(!Number.isFinite(limit))return {state:'N/A',value:Number.isFinite(value)?value:null,limit:null};
    if(!Number.isFinite(value))return {state:'WAITING',value:null,limit};
    const pass=op==='min'?value>=limit:value<=limit;
    return {state:pass?'PASS':'FAIL',value,limit};
  };

  const holders=check(h,minH,'min');
  const top10=check(top,maxT,'max');
  const developer=check(dev,maxD,'max');
  const buyPressure=check(bp,minB,'min');

  const checks={holders,top10,developer,buyPressure};
  const failed=Object.entries(checks).filter(([,v])=>v.state==='FAIL').map(([k])=>k);
  const waiting=Object.entries(checks).filter(([,v])=>v.state==='WAITING').map(([k])=>k);
  return {
    state: failed.length?'BLOCKED':(waiting.length?'WAITING':'PASS'),
    failed,
    waiting,
    checks
  };
}

function priceDiagRow(mint){
  let row=priceLifecycleDiag.get(mint);
  if(!row){
    row={mint,timerCreatedAt:null,pollAttempts:0,snapshotCount:0,lastPollAt:null,lastSnapshotAt:null,lastPollError:null,lastPollErrorAt:null};
    priceLifecycleDiag.set(mint,row);
  }
  return row;
}
function prunePriceDiag(){
  if(priceLifecycleDiag.size<=2000)return;
  const rows=[...priceLifecycleDiag.values()].sort((a,b)=>(b.lastPollAt||b.timerCreatedAt||0)-(a.lastPollAt||a.timerCreatedAt||0));
  priceLifecycleDiag.clear();
  for(const row of rows.slice(0,1000))priceLifecycleDiag.set(row.mint,row);
}

// ── Extended discovery metrics ────────────────────────────────────────────
const discMetrics=makeDiscoveryMetrics();
// ── Bounded concurrency queue ─────────────────────────────────────────────
const MAX_CONCURRENT=Math.max(6,Number(process.env.DISCOVERY_MAX_CONCURRENT||6)),QUEUE_MAX=Number(process.env.DISCOVERY_QUEUE_MAX||1000);
const SIG_MAX_AGE_MS=Number(process.env.DISCOVERY_SIGNATURE_MAX_AGE_MS||900000);
const HOLDER_MAX_CONCURRENT=Number(process.env.HOLDER_RPC_MAX_CONCURRENCY||1),HOLDER_QUEUE_MAX=Number(process.env.HOLDER_QUEUE_MAX||500),HOLDER_INITIAL_DELAY_MS=Number(process.env.HOLDER_INITIAL_DELAY_MS||750),HOLDER_RETRY_DELAY_MS=Number(process.env.HOLDER_RETRY_DELAY_MS||30000),HOLDER_MAX_RETRIES=Number(process.env.HOLDER_MAX_RETRIES||8);
// discQueue defined after processSignature below (forward ref via enqueue wrapper)
const enrichDiag=makeEnrichDiag();
const holderMetrics=makeHolderMetrics();

// MEMEFLOW_V12_5_1_FIRST_HOLDER_DELAY_FIX
// Only the FIRST holder-queue delay default is reduced: 8000ms -> 750ms.
// Retry delay (30000ms), max retries, queue concurrency and rate-limit protections remain unchanged.

/* MEMEFLOW_V12_8_ADMISSION_GATE
   Expensive holder RPC is admitted only when at least one active user can
   currently benefit from it. Missing/dynamic cheap data DEFER, never hard-drop.
   Hard drop is limited to stable platform/age incompatibility for every active
   user. No user settings are changed. */
const HOLDER_ADMISSION_RETRY_MS=Math.max(1000,Number(process.env.HOLDER_ADMISSION_RETRY_MS||3000));
const HOLDER_ADMISSION_ACTIVE_HOURS=Math.max(1,Number(process.env.HOLDER_ADMISSION_ACTIVE_USER_HOURS||24));

function v128Finite(v){
  return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
}
function v128Enabled(v){
  return v!==null&&v!==undefined&&v!=='';
}

/* MEMEFLOW_V13_SETTINGS_FIRST_ADMISSION
   CPU-only admission gate. It never performs RPC/network work. Missing facts
   remain WAITING; known user-setting failures outrank WAITING. Rejections are
   keyed to the active-user settings versions so a settings change reopens the
   token automatically. Retryable market failures get a short cooldown instead
   of a permanent drop, preserving quality while preventing hot-loop rescans. */
const SETTINGS_GATE_RECHECK_MS=Math.max(1000,Number(process.env.SETTINGS_GATE_RECHECK_MS||2000));
const SETTINGS_GATE_CONTEXT_CACHE_MS=Math.max(100,Number(process.env.SETTINGS_GATE_CONTEXT_CACHE_MS||250));
let settingsGateContextCache={at:0,entries:[],signature:'no-active-users'};
function settingsGateContext(now=Date.now()){
  if(now-settingsGateContextCache.at<SETTINGS_GATE_CONTEXT_CACHE_MS)return settingsGateContextCache;
  const cutoff=now-HOLDER_ADMISSION_ACTIVE_HOURS*3600000;
  const entries=Object.keys(store.state.users||{}).filter(uid=>{
    const u=store.state.users[uid]||{};
    return u.isOwner || (u.lastActiveAt&&u.lastActiveAt>=cutoff);
  }).map(uid=>{
    const u=store.state.users[uid]||{};
    return {uid,version:u.settingsVersion||u.updatedAt||0,settings:store.settings(uid)||{}};
  });
  settingsGateContextCache={at:now,entries,signature:settingsContextSignature(entries)};
  return settingsGateContextCache;
}
function settingsGateCachedRejection(token,context=settingsGateContext(),now=Date.now()){
  if(token?.pipelineGateState!=='SETTINGS_REJECTED')return false;
  if(String(token?.pipelineGateSignature||'')!==String(context?.signature||''))return false;
  const recheckAt=Number(token?.pipelineGateRecheckAt||0);
  return !(recheckAt>0&&now>=recheckAt);
}
function settingsGateMarkRejected(token,admission){
  if(!token?.mint||!admission)return token;
  const next={
    pipelineGateState:'SETTINGS_REJECTED',
    pipelineGateSignature:admission.signature||null,
    pipelineGateAt:Date.now(),
    pipelineGateRecheckAt:admission.recheckAt||null,
    pipelineGateRetryable:admission.retryable===true,
    pipelineGateReasons:Array.isArray(admission.reasons)?admission.reasons.slice(0,8):[],
    pipelineGateFailedKeys:Array.isArray(admission.failedKeys)?admission.failedKeys.slice(0,16):[]
  };
  return store.setToken(token.mint,next)||token;
}
function settingsGateClear(token){
  if(!token?.mint||token?.pipelineGateState!=='SETTINGS_REJECTED')return token;
  return store.setToken(token.mint,{
    pipelineGateState:null,pipelineGateSignature:null,pipelineGateAt:null,
    pipelineGateRecheckAt:null,pipelineGateRetryable:null,
    pipelineGateReasons:[],pipelineGateFailedKeys:[]
  })||token;
}
function settingsGateCheck(token){
  if(!token)return {allow:false,drop:true,reason:'token_missing',retryable:false};
  const now=Date.now();
  const context=settingsGateContext(now);
  if(settingsGateCachedRejection(token,context,now)){
    return {
      allow:false,drop:true,reason:'settings_rejected_cached',signature:context.signature,
      retryable:token.pipelineGateRetryable===true,
      recheckAt:token.pipelineGateRecheckAt||null,
      reasons:Array.isArray(token.pipelineGateReasons)?token.pipelineGateReasons:[],
      failedKeys:Array.isArray(token.pipelineGateFailedKeys)?token.pipelineGateFailedKeys:[]
    };
  }
  const admission=evaluateSettingsAdmission(token,context.entries,{now,recheckMs:SETTINGS_GATE_RECHECK_MS});
  if(admission.allow===false)settingsGateMarkRejected(token,admission);
  else settingsGateClear(token);
  return admission;
}

function holderAdmissionForActiveUsers(mint){
  // MEMEFLOW_V12_24_CREATOR_GATE_RECOVERY: event-holder snapshot remains authoritative even after fresh window.
  try{
    if(__v1224HasEventHolder(mint)){
      __v1224LinkCreator(mint,__v1223Token(mint));
      return {allow:false,drop:true,reason:'event_holder_authoritative',source:'ws-direct'};
    }
  }catch{}

  // MEMEFLOW_V12_23_FRESH_WARMING_GATE_DIAGNOSTICS: WS-direct V12.22 is authoritative for the fresh Pump hot path.
  // Never send a fresh Pump token to legacy getProgramAccounts holder RPC.
  try{
    if(__v1223FreshPump(mint)){
      const __eventHolder=eventHolderLedger?.inspect?.(mint)||null;
      if(__eventHolder){
        const __u=(__v1224LinkCreator(mint,__v1223Token(mint)),eventHolderLedger?.applyToStore?.(store,mint));
        if(__u){
          try{Promise.resolve(evaluateAI(__u)).catch(()=>{})}catch{}
          try{publish(mint)}catch{}
        }
        return {allow:false,drop:true,reason:'fresh_pump_event_holder_ready',source:'ws-direct'};
      }
      return {allow:false,drop:true,reason:'fresh_pump_holder_warming',source:'ws-direct'};
    }
  }catch(__e){}

  try{const __h=eventHolderLedger.inspect(mint);if(__h){const __u=eventHolderLedger.applyToStore(store,mint);if(__u){try{Promise.resolve(evaluateAI(__u)).catch(()=>{})}catch{}try{publish(mint)}catch{}}return {allow:false,drop:true,reason:'event_holder_ledger_ready',source:'event-ledger'}}}catch{}

  const token=store.state.tokens[mint];
  if(!token)return {allow:false,drop:true,reason:'token_missing'};

  const settingsAdmission=settingsGateCheck(token);
  if(settingsAdmission?.allow===false){
    const retryable=settingsAdmission.retryable===true;
    return {
      allow:false,
      drop:!retryable,
      retryInMs:retryable?Math.max(1000,Number(settingsAdmission.recheckAt||0)-Date.now()):undefined,
      reason:'settings_rejected',
      settingsReason:settingsAdmission.reason||null
    };
  }

  const now=Date.now();
  const cutoff=now-HOLDER_ADMISSION_ACTIVE_HOURS*3600000;
  const users=Object.keys(store.state.users||{}).filter(uid=>{
    const u=store.state.users[uid]||{};
    return u.isOwner || (u.lastActiveAt&&u.lastActiveAt>=cutoff);
  });

  // No active user context: fail open. Recovery/owner flows must not be broken.
  if(!users.length)return {allow:true,reason:'no_active_users_fail_open'};

  const platform=String(token.launchPlatform||token.protocol||token.source||'').toLowerCase();
  const discovered=Number(token.discoveredAt||token.createdAt||0);
  const ageMinutes=discovered>0?Math.max(0,(now-discovered)/60000):null;
  const price=v128Finite(token.priceSol);
  const pressure=v128Finite(token.buyPressure??token.momentum);
  const marketCapUsd=v128Finite(token.marketCapUsd??token.marketCapUSD);
  const liquidityUsd=v128Finite(token.liquidityUsd??token.liquidityUSD);

  let anyPotential=false;
  let anyReady=false;
  let lastReason='cheap_market_data_pending';

  for(const uid of users){
    /* MEMEFLOW_V12_12_HOLDER_ADMISSION_FIX
 * Admission-only settings view: minBuyPressure must not block holder enrichment.
 * The stored user setting remains unchanged and evaluateAll() still enforces it.
 */
const __holderAdmissionSettings = store.settings(uid) || {};
const s = {...__holderAdmissionSettings, minBuyPressure: null};

    // Stable hard filters: safe to rule this user out permanently.
    if(Array.isArray(s.launchPlatforms)&&s.launchPlatforms.length){
      if(!platform || !s.launchPlatforms.some(p=>platform.includes(String(p).replace('_',' ').toLowerCase()))){
        lastReason='launch_platform_mismatch';
        continue;
      }
    }
    if(ageMinutes!==null && v128Enabled(s.maxTokenAgeMinutes) &&
       ageMinutes>Number(s.maxTokenAgeMinutes)){
      lastReason='token_age_exceeded';
      continue;
    }

    anyPotential=true;

    // MEMEFLOW_V12_13_HOLDER_ADMISSION_PRICE_GATE_FIX
    // Do NOT require priceSol merely to admit holder enrichment.
    // Price-dependent user filters below remain authoritative:
    // market-cap/liquidity gates defer independently when enabled.
    // evaluateAll() continues to enforce the user's real trading settings.
    // Dynamic/cheap gates: DEFER only when an ENABLED user filter needs them.
    if(v128Enabled(s.minBuyPressure) && Number(s.minBuyPressure)>0){
      if(pressure===null){
        lastReason='buy_pressure_pending';
        continue;
      }
      if(pressure<Number(s.minBuyPressure)){
        lastReason='buy_pressure_below_user_min';
        continue;
      }
    }
    if(v128Enabled(s.minMarketCapUsd) && Number(s.minMarketCapUsd)>0){
      if(marketCapUsd===null){
        lastReason='market_cap_usd_pending';
        continue;
      }
      if(marketCapUsd<Number(s.minMarketCapUsd)){
        lastReason='market_cap_below_user_min';
        continue;
      }
    }
    if(v128Enabled(s.maxMarketCapUsd) && Number(s.maxMarketCapUsd)>0 &&
       marketCapUsd!==null && marketCapUsd>Number(s.maxMarketCapUsd)){
      lastReason='market_cap_above_user_max';
      continue;
    }
    if(v128Enabled(s.minLiquidityUsd) && Number(s.minLiquidityUsd)>0){
      if(liquidityUsd===null){
        lastReason='liquidity_usd_pending';
        continue;
      }
      if(liquidityUsd<Number(s.minLiquidityUsd)){
        lastReason='liquidity_below_user_min';
        continue;
      }
    }

    anyReady=true;
    break;
  }

  if(anyReady)return {allow:true,reason:'at_least_one_active_user_ready'};
  if(!anyPotential)return {allow:false,drop:true,reason:lastReason||'no_active_user_hard_match'};
  return {allow:false,drop:false,retryInMs:HOLDER_ADMISSION_RETRY_MS,reason:lastReason};
}

const holderQueue=makeHolderQueue({maxConcurrent:Math.max(1,Number(process.env.HOLDER_QUEUE_CONCURRENCY||2)),workerTimeoutMs:Math.max(5000,Number(process.env.HOLDER_WORKER_TIMEOUT_MS||11000)), /* MEMEFLOW_V12_14_HOLDER_CONCURRENCY */ queueMax:HOLDER_QUEUE_MAX,initialDelayMs:HOLDER_INITIAL_DELAY_MS,retryDelayMs:HOLDER_RETRY_DELAY_MS,maxRetries:HOLDER_MAX_RETRIES},{enrichHoldersFn:(mint)=>enrichHolders(mint,{rpc,store,evaluateAll,publish,enrichDiag}),holderMetrics,/* MEMEFLOW_V12_15_2_STALE_HOLDER_RECONCILIATION */
isHolderFreshFn:(mint)=>Boolean(store.state?.tokens?.[mint]?.holderFresh===true),
admissionFn:holderAdmissionForActiveUsers});
const recoveryMetrics=makeRecoveryMetrics();
const DECISION_RECOVERY_BATCH_SIZE=Number(process.env.DECISION_RECOVERY_BATCH_SIZE||25);
const DECISION_RECOVERY_DELAY_MS=Number(process.env.DECISION_RECOVERY_DELAY_MS||25);
const DECISION_RECOVERY_TOKEN_LIMIT=Number(process.env.DECISION_RECOVERY_TOKEN_LIMIT||200);
const DECISION_RECOVERY_ACTIVE_USER_HOURS=Number(process.env.DECISION_RECOVERY_ACTIVE_USER_HOURS||24);
// Thin wrapper so ws.onmessage can call enqueue() before discQueue is defined
function enqueue(sig){ discQueue.enqueue(sig); }
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').filter(Boolean).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))]}))}
function user(req,res){let id=cookies(req).mf_session;if(!id&&ALLOW_ANON){id=sessionId();res.setHeader('Set-Cookie',`mf_session=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`)}return id?store.user(id):null}
function json(res,status,obj){res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(obj))}
async function rawBody(req,limit=1e6){const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>limit)throw Error('body too large');chunks.push(c)}return Buffer.concat(chunks).toString('utf8')}
async function body(req){const s=await rawBody(req);return s?JSON.parse(s):{}}
function origin(req){if(process.env.APP_URL||process.env.APP_BASE_URL)return (process.env.APP_URL||process.env.APP_BASE_URL).replace(/\/$/,'');const proto=(req.headers['x-forwarded-proto']||'http').split(',')[0].trim();const host=(req.headers['x-forwarded-host']||req.headers.host||'localhost').split(',')[0].trim();return `${proto}://${host}`}
function hasLiveEntitlement(u){return Boolean(u?.isOwner||u?.liveEntitled)}
function billingStatus(u){const owner=Boolean(u.isOwner);const stripe=Boolean(u.liveEntitled);return {plan:owner?'owner':(u.plan||'free'),subscriptionStatus:owner?'owner_grant':(u.subscriptionStatus||'free'),liveEntitled:owner||stripe,entitlementSource:owner?'owner':(stripe?'stripe':'none'),isOwner:owner,price:49.99,currency:'USD',stripeCustomerId:u.stripeCustomerId||null,currentPeriodEnd:owner?null:(u.currentPeriodEnd||null),cancelAtPeriodEnd:owner?false:Boolean(u.cancelAtPeriodEnd)}}
/* MEMEFLOW_CANONICAL_CANDIDATE_PAYLOAD_V1 */
/* MEMEFLOW_ALL_TOKEN_MARKET_METRICS_V4
 * Read-only trailing 5 minute market snapshot for Token Flow cards.
 * Uses existing real Pump chartTradeHistory plus already stored token fields.
 */
function __mfCandidateMarket5mV4(mint,t){
  const finite=(v)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
    ? Number(v)
    : null;

  const now=Date.now();
  const cutoff=now-(5*60*1000);
  const rows=Array.isArray(chartTradeHistory.get(String(mint||'')))
    ? chartTradeHistory.get(String(mint||'')).slice()
    : [];

  const points=rows
    .filter((p)=>{
      const ts=Number(p?.t);
      return Number.isFinite(ts)&&ts>0&&ts<=now+30000;
    })
    .sort((a,b)=>Number(a.t)-Number(b.t));

  const recent=points.filter((p)=>Number(p.t)>=cutoff);
  const latest=points.length?points[points.length-1]:null;

  let base=null;
  for(let i=points.length-1;i>=0;i--){
    if(Number(points[i]?.t)<=cutoff){
      base=points[i];
      break;
    }
  }
  if(!base&&recent.length)base=recent[0];

  const pointPrice=(p)=>finite(p?.priceSol??p?.price);
  const latestPrice=
    finite(t?.priceSol) ??
    pointPrice(latest);

  const basePrice=pointPrice(base);

  const volume5mSol=recent.reduce(
    (sum,p)=>sum+Math.abs(finite(p?.solAmount)??0),
    0
  );

  const directVolumeUsd=
    finite(t?.volume5mUsd ?? t?.market?.volume5mUsd);

  const directTx=
    finite(t?.transactions5m ?? t?.tx5m) ??
    (()=>{
      const buys=finite(t?.buys5m);
      const sells=finite(t?.sells5m);
      return buys!==null||sells!==null
        ? (buys??0)+(sells??0)
        : null;
    })();

  const transactions5m=
    recent.length>0
      ? recent.length
      : directTx;

  let priceChange5mPct=
    finite(t?.priceChange5mPct ?? t?.change5mPct);

  if(
    recent.length &&
    latestPrice!==null &&
    latestPrice>0 &&
    basePrice!==null &&
    basePrice>0
  ){
    priceChange5mPct=((latestPrice/basePrice)-1)*100;
  }

  const supply=finite(t?.totalSupply);
  const storedMcSol=finite(t?.marketCapSol??t?.marketCap);
  const marketCapSol=
    latestPrice!==null&&latestPrice>0&&supply!==null&&supply>0
      ? latestPrice*supply
      : storedMcSol;

  const marketCapUsd=finite(t?.marketCapUsd);

  const impliedSolUsd=
    marketCapUsd!==null&&marketCapUsd>0&&marketCapSol!==null&&marketCapSol>0
      ? marketCapUsd/marketCapSol
      : null;

  const volume5mUsd=
    directVolumeUsd ??
    (
      impliedSolUsd!==null
        ? volume5mSol*impliedSolUsd
        : null
    );

  return {
    volume5mSol,
    volume5mUsd,
    transactions5m,
    marketCapSol,
    marketCapUsd,
    priceChange5mPct
  };
}

function candidateView(d){
  const t=store.state.tokens[d.mint]||{};
  const finite=(v)=>v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
  const marketCapSol=finite(t.marketCapSol);
  const liquiditySol=finite(t.liquiditySol);
  const top10Pct=finite(t.top10Pct);
  const developerPct=finite(t.developerPct??t.developerSharePct);
  const buyPressure=finite(t.buyPressure??t.momentum);
  const market5m=__mfCandidateMarket5mV4(d.mint,t);
  return {
    id:d.mint,
    mint:d.mint,
    tokenMint:d.mint,
    tokenAddress:d.mint,
    name:t.name||t.symbol||d.mint.slice(0,6),
    symbol:t.symbol||'TOKEN',
    /* MEMEFLOW_TOKEN_METADATA_IMAGE_V1 */
    uri:t.uri||null,
    metadataUri:t.metadataUrl||t.uri||null,
    imageUrl:t.imageUrl||t.image||t.logoUrl||null,
    image:t.imageUrl||t.image||t.logoUrl||null,
    logoUrl:t.logoUrl||t.imageUrl||t.image||null,
    state:d.state,
    score:d.score,
    /* confidence intentionally omitted: d.confidence = dataQuality×100 (data completeness),
       not an AI confidence score. Use candidate?.decision?.confidence or ai_confidence instead.
       Data completeness is already exposed as the `data` field below. */
    data:Math.round((t.dataQuality||0)*100),
    lane:d.state==='BUY READY'?'READY':'QUEUE',
    priority:d.score,
    meta:t.source||'Solana on-chain',
    source:t.source||'Solana on-chain',
    launchPlatform:t.launchPlatform||null,
    protocol:t.protocol||t.launchPlatform||null,
    price:t.priceSol??null,
    priceSol:finite(t.priceSol),
    marketCap:marketCapSol,
    marketCapSol,
    marketCapUsd:finite(t.marketCapUsd),
    liquidity:liquiditySol,
    liquiditySol,
    liquidityUsd:finite(t.liquidityUsd),
    holders:finite(t.holderCount),
    holderCount:finite(t.holderCount),
    top10:top10Pct,
    top10Pct,
    developer:developerPct,
    developerPct,
    developerSharePct:developerPct,
    buyPressure,
    momentum:buyPressure,
    qualityScore:finite(t.qualityScore),
    opportunityScore:finite(t.opportunityScore),
    opportunityEvidenceReady:t.opportunityEvidenceReady===true,
    opportunityTrendHealthy:t.opportunityTrendHealthy===true,
    dexPaidConfirmed:t.dexPaidConfirmed===true,
    dexPaidStatus:t.dexPaidStatus||null,
    dexPaidCheckedAt:t.dexPaidCheckedAt||null,
    uniqueBuyers:finite(t.uniqueBuyers),
    netFlowSol:finite(t.netFlowSol),
    recentNetFlowSol:finite(t.recentNetFlowSol),
    priceMomentumPct:finite(t.priceMomentumPct),
    drawdownFromPeakPct:finite(t.drawdownFromPeakPct),
    whaleDominancePct:finite(t.whaleDominancePct),
    dead:t.dead===true,
    deadReason:t.deadReason||null,
    ageMinutes:tokenAgeMinutes(t),
    volume5mSol:market5m.volume5mSol,
    volume5mUsd:market5m.volume5mUsd,
    transactions5m:market5m.transactions5m,
    priceChange5mPct:market5m.priceChange5mPct,
    evidence:{
      'Mint':d.mint,
      'Price (SOL)':finite(t.priceSol)??'—',
      'Market Cap (SOL)':marketCapSol??'—',
      'Liquidity (SOL)':liquiditySol??'—',
      'Holders':finite(t.holderCount)??'—',
      'Top 10':top10Pct!=null?top10Pct.toFixed(2)+'%':'—',
      'Developer':developerPct!=null?developerPct.toFixed(2)+'%':'—',
      'Buy pressure':buyPressure!=null?buyPressure.toFixed(2)+'×':'—',
      'Source':t.source||'Solana'
    },
    timeline:t.timeline||[],
    primaryReason:d.primaryReason,
    reasons:d.reasons,
    riskApproved:
      d.preOpenRiskVerified===true ||
      (
        d.state==='BUY READY' &&
        d.walletRiskPending===false
      ),
    walletRiskPending:d.walletRiskPending===true,
    preOpenRiskStatus:t.preOpenRiskStatus||null,
    routeApproved:t.priceSol!=null,
    holderFresh:t.holderFresh,
    positionSize:null,
    quoteAgeMs:t.lastPriceAt?Math.max(0,Date.now()-t.lastPriceAt):null,
    slippagePct:null
  };
}
// MEMEFLOW_STRICT_ENTRY_ADMISSION_V1
const __mfEntryAdmissionState=new Map();

function __mfEntryAdmissionForUser(
  token,
  uid,
  settingsOverride=null,
  now=Date.now()
){
  try{
    const settings=
      settingsOverride &&
      typeof settingsOverride==='object'
        ? settingsOverride
        : (store.settings(uid)||{});

    return evaluateEntryAdmission(token,settings,{now});
  }catch(error){
    return {
      admitted:false,
      state:'PENDING',
      failedGates:[],
      waitingGates:[],
      hasStableFailure:false,
      hasRetryableFailure:false,
      reasons:['entry admission evaluation error']
    };
  }
}

function __mfClearDecisionForUserMint(uid,mint){
  const key=String(uid||'')+':'+String(mint||'');
  if(!uid||!mint)return false;

  let removed=false;
  if(store.state.decisions?.[key]){
    delete store.state.decisions[key];
    removed=true;
  }

  try{
    if(store._uidDec?.[uid]?.has?.(key)){
      store._uidDec[uid].delete(key);
      removed=true;
    }
  }catch{}

  return removed;
}

function __mfLiveEvalAdmissionCheck(token,settings,uid){
  const admission=__mfEntryAdmissionForUser(token,uid,settings);
  const key=String(uid||'')+':'+String(token?.mint||'');

  if(uid&&token?.mint){
    __mfEntryAdmissionState.set(key,admission?.admitted===true);
  }

  return admission;
}

function __mfAdmittedScannerTokensForUser(uid,now=Date.now()){
  const settings=store.settings(uid)||{};
  return __mfLiveScannerTokens(now)
    .filter(token=>
      __mfEntryAdmissionForUser(token,uid,settings,now)?.admitted===true
    );
}

function __mfAnyActiveEntryAdmitted(token,now=Date.now()){
  if(!token)return false;
  const uids=__mfActiveScannerUserIds(now);
  if(!uids.length)return false;

  for(const uid of uids){
    if(__mfEntryAdmissionForUser(token,uid,null,now)?.admitted===true){
      return true;
    }
  }

  return false;
}

const liveEvalMetrics=makeLiveEvalMetrics();
const LIVE_EVAL_HOURS=Number(process.env.LIVE_EVALUATION_ACTIVE_USER_HOURS||24);
const LIVE_EVAL_BATCH=Number(process.env.LIVE_EVALUATION_BATCH_SIZE||25);
const LIVE_EVAL_DELAY=Number(process.env.LIVE_EVALUATION_DELAY_MS||0);
const evaluateAll=makeEvaluateForActiveUsers({
  store,
  metrics:liveEvalMetrics,
  activeUserHoursMs:LIVE_EVAL_HOURS*3600000,
  batchSize:LIVE_EVAL_BATCH,
  delayMs:LIVE_EVAL_DELAY,
  admissionCheck:__mfLiveEvalAdmissionCheck,
  onDecision:(uid,token,decision)=>{
    void __mfHandleDecision(uid,token,decision).catch(()=>{});
  }
});

// A TradeEvent causes immediate admission re-check. This sweep exists only for
// gates that can change without a trade event (most importantly minimum age).
// It triggers a full evaluation only on a hidden -> admitted transition.
const __mfPreAdmissionSweepMs=Math.max(
  1000,
  Number(process.env.PRE_ADMISSION_SWEEP_MS||2000)
);

const __mfPreAdmissionSweepTimer=setInterval(()=>{
  try{
    const now=Date.now();
    const tokens=__mfLiveScannerTokens(now);
    const uids=__mfActiveScannerUserIds(now);

    if(!tokens.length||!uids.length)return;

    const users=uids.map(uid=>({
      uid,
      settings:store.settings(uid)||{}
    }));

    for(const token of tokens){
      let promote=false;

      for(const row of users){
        const key=row.uid+':'+token.mint;
        const previous=__mfEntryAdmissionState.get(key);
        const admission=__mfEntryAdmissionForUser(
          token,
          row.uid,
          row.settings,
          now
        );
        const admitted=admission?.admitted===true;

        if(admitted&&previous!==true){
          promote=true;
        }else if(!admitted&&previous===true){
          __mfClearDecisionForUserMint(row.uid,token.mint);
        }

        __mfEntryAdmissionState.set(key,admitted);
      }

      if(promote){
        Promise.resolve(evaluateAll(token)).catch(()=>{});
      }
    }

    if(__mfEntryAdmissionState.size>50000){
      const active=new Set(uids);
      const live=new Set(tokens.map(t=>String(t?.mint||'')));
      for(const key of [...__mfEntryAdmissionState.keys()]){
        const cut=String(key).lastIndexOf(':');
        const uid=cut>=0?String(key).slice(0,cut):'';
        const mint=cut>=0?String(key).slice(cut+1):'';
        if(!active.has(uid)||!live.has(mint)){
          __mfEntryAdmissionState.delete(key);
        }
      }
    }
  }catch{}
},__mfPreAdmissionSweepMs);
__mfPreAdmissionSweepTimer.unref?.();
// MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1
// DEX Paid is a TRUE Entry Filter now:
//   OFF -> it has zero effect.
//   ON  -> token remains hidden until a paid DEX Screener order is confirmed.
// We only query DEX Screener after all OTHER Entry Filters pass, which keeps
// the official 60 req/min orders endpoint out of the raw Pump hot path.
const __mfDexPaidNextCheckAt=new Map();
let __mfDexPaidWorkerBusy=false;

function __mfDexPaidRequiredEntries(now=Date.now()){
  try{
    return settingsGateContext(now).entries
      .filter(entry=>entry?.settings?.requireDexPaid===true);
  }catch{
    return [];
  }
}

function __mfDexPaidPassesOtherEntryFilters(token,entry,now=Date.now()){
  if(!token||!entry)return false;

  const settings={
    ...(entry.settings||{}),
    requireDexPaid:false
  };

  return evaluateEntryAdmission(
    token,
    settings,
    {now}
  )?.admitted===true;
}

function __mfDexPaidCandidate(token,entries,now=Date.now()){
  if(!token?.mint)return false;
  if(token?.dead===true)return false;
  if(token?.dexPaidConfirmed===true)return false;

  const due=Number(
    __mfDexPaidNextCheckAt.get(token.mint) ||
    token.dexPaidNextCheckAt ||
    0
  );

  if(due>now)return false;

  return entries.some(
    entry=>__mfDexPaidPassesOtherEntryFilters(token,entry,now)
  );
}

async function __mfRunDexPaidCheck(){
  if(__mfDexPaidWorkerBusy)return;

  const now=Date.now();
  const entries=__mfDexPaidRequiredEntries(now);
  if(!entries.length)return;

  const candidates=__mfLiveScannerTokens(now)
    .filter(token=>__mfDexPaidCandidate(token,entries,now))
    .sort((a,b)=>{
      const aChecked=Number(a?.dexPaidCheckedAt||0);
      const bChecked=Number(b?.dexPaidCheckedAt||0);

      // Never-checked candidates first.
      if(Boolean(aChecked)!==Boolean(bChecked)){
        return aChecked?1:-1;
      }

      // Stronger live candidates first, then older unchecked candidate.
      const aOpp=Number(a?.opportunityScore||0);
      const bOpp=Number(b?.opportunityScore||0);
      if(aOpp!==bOpp)return bOpp-aOpp;

      return aChecked-bChecked;
    });

  const token=candidates[0];
  if(!token)return;

  __mfDexPaidWorkerBusy=true;

  try{
    const result=await dexPaidVerifier.check(token.mint);
    const confirmed=
      result?.confirmed===true
        ? true
        : result?.confirmed===false
          ? false
          : null;

    const nextAt=
      confirmed===true
        ? null
        : Number(result?.expiresAt||0) || (Date.now()+5000);

    if(nextAt){
      __mfDexPaidNextCheckAt.set(token.mint,nextAt);
    }else{
      __mfDexPaidNextCheckAt.delete(token.mint);
    }

    const updated=store.setToken(
      token.mint,
      {
        dexPaidConfirmed:confirmed,
        dexPaidStatus:result?.status||null,
        dexPaidPaymentTimestamp:result?.paymentTimestamp||null,
        dexPaidOrderType:result?.orderType||null,
        dexPaidCheckedAt:result?.checkedAt||Date.now(),
        dexPaidNextCheckAt:nextAt,
        dexPaidSource:'dexscreener-paid-orders',
        dexPaidError:result?.error||null
      }
    ) || token;

    if(confirmed===true){
      try{settingsGateClear(updated)}catch{}
    }

    try{
      await Promise.resolve(evaluateAll(updated));
    }catch{}

    try{publish(token.mint)}catch{}
  }finally{
    __mfDexPaidWorkerBusy=false;
  }
}

const __mfDexPaidSweepTimer=setInterval(
  ()=>{void __mfRunDexPaidCheck().catch(()=>{})},
  Math.max(500,Number(process.env.DEX_PAID_SWEEP_MS||1000))
);
__mfDexPaidSweepTimer.unref?.();

/* MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT */
const fastPhaseMetrics={
  starts:0,
  priceTimerStarted:0,
  holderQueued:0,
  initialEvaluationStarted:0,
  initialEvaluationSucceeded:0,
  initialEvaluationFailed:0,
  bootstrapErrors:0,
  fullEnrichBackgroundStarted:0,
  fullEnrichBackgroundSucceeded:0,
  fullEnrichBackgroundFailed:0,
  lastBootstrapAt:null,
  lastBootstrapMint:null,
  lastBootstrapError:null,
  lastFullEnrichError:null
};

function fastPhaseAStart(mint,curve){
  const token=store.state.tokens[mint];
  if(!token)return false;

  // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
  // Automatic WS-first Pump tokens never enter legacy RPC enrichment.
  if(token?.wsFirst===true){
    try{
      Promise.resolve(evaluateAll(token)).catch(()=>{});
    }catch{}
    try{publish(mint)}catch{}
    return true;
  }

  const settingsAdmission=settingsGateCheck(token);
  if(settingsAdmission?.allow===false&&settingsAdmission.retryable!==true){
    try{Promise.resolve(evaluateAll(token)).catch(()=>{})}catch{}
    try{publish(mint)}catch{}
    return false;
  }

  fastPhaseMetrics.starts++;
  fastPhaseMetrics.lastBootstrapAt=Date.now();
  fastPhaseMetrics.lastBootstrapMint=mint;

  // Critical rule: downstream lifecycles are created BEFORE any slow full enrich.
  try{
    const hadPrice=priceTimers.has(mint);
    ensurePriceTimer(mint,curve||token.curve);
    if(!hadPrice&&priceTimers.has(mint))fastPhaseMetrics.priceTimerStarted++;
  }catch(e){
    fastPhaseMetrics.bootstrapErrors++;
    fastPhaseMetrics.lastBootstrapError='price timer: '+String(e?.message||e);
  }

  try{
    const before=holderQueue.inspect?.(mint)||null;

    // MEMEFLOW_V12_9_PRE_QUEUE_ADMISSION_FAST
    const admission=holderAdmissionForActiveUsers(mint);

    if(admission?.allow!==false){
      holderQueue.enqueue(mint);

      const after=holderQueue.inspect?.(mint)||null;
      if(!before?.pending && (after?.pending||after?.active||Number(after?.attempts||0)>0)){
        fastPhaseMetrics.holderQueued++;
      }
    }
  }catch(e){
    fastPhaseMetrics.bootstrapErrors++;
    fastPhaseMetrics.lastBootstrapError='holder queue: '+String(e?.message||e);
  }

  // Initial WAITING/BLOCK evaluation must not wait for metadata/holder enrichment.
  try{
    fastPhaseMetrics.initialEvaluationStarted++;
    Promise.resolve(evaluateAll(token)).then(()=>{
      fastPhaseMetrics.initialEvaluationSucceeded++;
    }).catch(e=>{
      fastPhaseMetrics.initialEvaluationFailed++;
      fastPhaseMetrics.lastBootstrapError='initial evaluation: '+String(e?.message||e);
    });
  }catch(e){
    fastPhaseMetrics.initialEvaluationFailed++;
    fastPhaseMetrics.lastBootstrapError='initial evaluation: '+String(e?.message||e);
  }

  try{ publish(mint); }catch(_){}
  return true;
}

// Phase A (immediate) then schedules Phase B (delayed holder lookup) via holderQueue.
async function enrich(mint,curve){
  // V13: stable settings failures never enter full enrichment. Retryable
  // market failures continue the cheap lifecycle so they can become eligible.
  const fastStarted=fastPhaseAStart(mint,curve);
  if(fastStarted===false)return {settingsRejected:true,retryable:false};

  fastPhaseMetrics.fullEnrichBackgroundStarted++;
  try{
    await enrichToken(mint,curve,{rpc,store,tradeWindows,evaluateAll,publish,ensurePriceTimer,discMetrics,enrichDiag});
    const postToken=store.state.tokens[mint];
    const postAdmission=postToken?settingsGateCheck(postToken):{allow:false,drop:true,retryable:false};
    if(postAdmission?.allow===false&&postAdmission.retryable!==true){
      const timer=priceTimers.get(mint);
      if(timer){clearInterval(timer);priceTimers.delete(mint)}
    }
    fastPhaseMetrics.fullEnrichBackgroundSucceeded++;
  }catch(e){
    fastPhaseMetrics.fullEnrichBackgroundFailed++;
    fastPhaseMetrics.lastFullEnrichError=String(e?.message||e).slice(0,240);
    throw e;
  }

  try{paper.onTokenUpdate(mint,store.state.tokens[mint])}catch(_){}
}
function publishTrade(mint,event,tokenOverride=null){
  if(!mint||!event)return;

  // MEMEFLOW_COPY_TRADING_V1 — reuse the canonical, already-deduplicated Pump TradeEvent.
  try{Promise.resolve(copyTrading.onTradeEvent(event,tokenOverride||store.state.tokens[mint])).catch(e=>console.warn('[copy-trading]',e?.message||e))}catch(e){console.warn('[copy-trading]',e?.message||e)}

  // Keep a bounded rolling buffer of REAL Pump TradeEvents before
  // the token is opened in Trading Terminal. No synthetic/timer points.

  const token=tokenOverride||store.state.tokens[mint];

  // MEMEFLOW_STRICT_ENTRY_ADMISSION_V1
  if(!__mfAnyActiveEntryAdmitted(token))return;

  const price=Number(token?.priceSol);
  if(!(price>0))return;

  const isBuy=
    event.isBuy===true ? true :
    event.isBuy===false ? false :
    null;

  if(isBuy===null)return;

  const solAmount=
    typeof event.solAmount==='bigint'
      ? Number(event.solAmount)/1e9
      : Number(event.solAmount||0);

  const tokenAmount=
    typeof event.tokenAmount==='bigint'
      ? Number(event.tokenAmount)
      : Number(event.tokenAmount||0);

  if(!(solAmount>0||tokenAmount>0))return;

  let at=Number(event.timestamp);

  if(Number.isFinite(at)&&at>0){
    if(at<1e12)at*=1000;
  }else{
    at=Date.now();
  }

  const point={
    t:at,
    price,
    priceSol:price,
    source:'pump-trade-event',
    isBuy,
    solAmount,
    tokenAmount
  };

  const rows=chartTradeHistory.get(mint)||[];
  rows.push(point);

  // MEMEFLOW_CHART_HISTORY_RESTORE_V1
  // Persist accepted real chart ticks independently from the bounded RAM cache.
  try{
    __mfChartArchive.appendPoint(mint,point);
  }catch{}

  if(rows.length>1200){
    rows.splice(0,rows.length-1200);
  }

  // Refresh insertion order so this map behaves as a bounded LRU.
  chartTradeHistory.delete(mint);
  chartTradeHistory.set(mint,rows);

  // Bound memory while keeping recent real-trade history for active tokens.
  while(chartTradeHistory.size > 250){
    const oldest = chartTradeHistory.keys().next().value;
    if(oldest === undefined) break;
    chartTradeHistory.delete(oldest);
  }

  const listeners=chartTradeStreams.get(mint);
  if(!listeners||listeners.size===0)return;

  const payload=`event: update
data: ${JSON.stringify({
    point,
    status:{
      stale:false,
      source:'pump-trade-event'
    }
  })}

`;

  for(const res of listeners){
    try{res.write(payload)}catch{}
  }
}

function publish(mint){
  // V4 System View: actual backend publish cadence drives the 3D/token-flow impulse.
  if(__systemViewStreamsV31.size){
   try{
    const __v31t=store?.state?.tokens?.[mint]||{};
    __systemViewEmitV31('token',{
     mint:String(mint||''),
     updatedAt:Number(__v31t?.updatedAt||Date.now())
    });
   }catch{}
  }

  // Hot path: live Pump events can call publish many times per second.
  // Do absolutely no work unless this mint has active SSE subscribers.
  const listeners=streams.get(mint);
  if(!listeners||listeners.size===0)return;

  const t=store.state.tokens[mint];
  const payload=`event: update\ndata: ${JSON.stringify({
    point:t?.priceSol?{
      t:Date.now(),
      price:t.priceSol,
      source:'Solana'
    }:null,
    status:{
      stale:!t?.priceSol,
      error:t?.scanError||null,
      source:t?.source
    }
  })}\n\n`;

  for(const res of listeners){
    try{res.write(payload)}catch{}
  }
}

function curvePressure(mint,previousLiquidity,nextLiquidity){
  const now=Date.now();
  const old=tradeWindows.get(mint)||{events:[]};
  const events=Array.isArray(old.events)?old.events.filter(e=>now-e.t<=60000):[];
  const a=Number(previousLiquidity),b=Number(nextLiquidity);
  if(Number.isFinite(a)&&Number.isFinite(b)&&a>0){
    const eps=Math.max(1e-9,Math.abs(a)*0.000001);
    if(b>a+eps)events.push({t:now,side:'buy'});
    else if(b<a-eps)events.push({t:now,side:'sell'});
  }
  const buy=events.filter(e=>e.side==='buy').length;
  const sell=events.filter(e=>e.side==='sell').length;
  const buyPressure=sell>0?buy/sell:(buy>0?buy:null);
  tradeWindows.set(mint,{events,buy,sell,updatedAt:now});
  return buyPressure;
}

function ensurePriceTimer(mint,curve){
  if(priceTimers.has(mint)||!curve)return;
  const _settingsToken=store.state.tokens[mint];
  if(_settingsToken){
    const _settingsAdmission=settingsGateCheck(_settingsToken);
    if(_settingsAdmission?.allow===false&&_settingsAdmission.retryable!==true)return;
  }
  const _priceDiag=priceDiagRow(mint);
  _priceDiag.timerCreatedAt=Date.now();
  prunePriceDiag();
  let lastBackgroundPollAt=0;
  const baseTick=Math.max(1000,Number(process.env.POLL_ACTIVE_MS||2000));
  const maxBackgroundAgeMs=Math.max(60000,Number(process.env.BACKGROUND_TOKEN_MAX_AGE_MS||10800000));

  const timer=setInterval(async()=>{
    const t=store.state.tokens[mint];
    if(!t){clearInterval(timer);priceTimers.delete(mint);return}
    if(t.pipelineGateState==='SETTINGS_REJECTED'&&t.pipelineGateRetryable!==true){
      const _settingsAdmission=settingsGateCheck(t);
      if(_settingsAdmission?.allow===false){clearInterval(timer);priceTimers.delete(mint);return}
    }

    const now=Date.now();
    const hasStream=(streams.get(mint)?.size||0)>0;
    const discoveredAt=Number(t.discoveredAt||now);
    const ageMs=Math.max(0,now-discoveredAt);

    if(!hasStream&&ageMs>maxBackgroundAgeMs){
      clearInterval(timer);priceTimers.delete(mint);return;
    }

    let backgroundEveryMs=12000;
    /* MEMEFLOW_V11_PRICE_LOAD_SHED */
    if(ageMs>15*60_000)backgroundEveryMs=90000;
    else if(ageMs>3*60_000)backgroundEveryMs=30000;

    if(!hasStream&&now-lastBackgroundPollAt<backgroundEveryMs)return;

    const holderBacklog=(holderQueue.queueDepth||0)+(holderQueue.processing||0);
    const lastPriceAt=Number(t.lastPriceAt||0);
    const priceAgeMs=lastPriceAt>0?now-lastPriceAt:Infinity;

    // Reserve RPC capacity for holder scans, while still allowing a price
    // refresh roughly every 30s so anti-rug snapshots continue to progress.
    if(!hasStream&&holderBacklog>0&&priceAgeMs<30000)return;

    lastBackgroundPollAt=now;

    try{
      const _pd=priceDiagRow(mint);
      _pd.pollAttempts++;
      _pd.lastPollAt=Date.now();
      const info=await rpc.call('getAccountInfo',[curve,{encoding:'base64',commitment:'confirmed'}]);
      if(info?.value?.data?.[0]){
        const c=decodeCurve(info.value.data[0],t.decimals||6);
        const pressure=curvePressure(mint,t.liquiditySol,c.liquiditySol);
        const liveMarketCap=(c.priceSol&&t.totalSupply)?c.priceSol*t.totalSupply:null;
        const _pd2=priceDiagRow(mint);
        _pd2.snapshotCount++;
        _pd2.lastSnapshotAt=Date.now();
        _pd2.lastPollError=null;
        _pd2.lastPollErrorAt=null;
        const updated=store.setToken(mint,{
          priceSol:c.priceSol,
          liquiditySol:c.liquiditySol,
          marketCapSol:liveMarketCap,
          marketCap:liveMarketCap,
          liquidity:c.liquiditySol,
          buyPressure:pressure??t.buyPressure??null,
          momentum:pressure??t.buyPressure??null,
          complete:c.complete,
          scanError:null,
          launchPlatform:t.launchPlatform||'pump',
          protocol:t.protocol||'pump',
          source:'Solana bonding curve'
        });
  try{__v1224LinkCreator(mint,__v1223Token(mint))}catch{}
        /* MEMEFLOW_V12_10_MARKET_RECHECK_ADMISSION
           A token deferred by V12.9 gets another admission check immediately
           after cheap market data changes. Only ALLOW reaches holder RPC. */
        try{
          const holderState=holderQueue.inspect?.(mint)||null;
          const alreadyHandled=Boolean(
            holderState?.pending ||
            holderState?.active ||
            Number(holderState?.attempts||0)>0 ||
            updated?.holderFresh===true
          );

          if(!alreadyHandled){
            const admission=holderAdmissionForActiveUsers(mint);

            if(admission?.allow===true){
              const before=holderQueue.inspect?.(mint)||null;
              holderQueue.enqueue(mint);
              const after=holderQueue.inspect?.(mint)||null;

              if(!before?.pending &&
                 (after?.pending || after?.active || Number(after?.attempts||0)>0)){
                fastPhaseMetrics.holderQueued++;
              }
            }
          }
        }catch(e){
          fastPhaseMetrics.bootstrapErrors++;
          fastPhaseMetrics.lastBootstrapError=
            'market admission recheck: '+String(e?.message||e);
        }

        await evaluateAll(updated);
        publish(mint);
        try{paper.onTokenUpdate(mint,updated)}catch(_){}
      }
    }catch(e){
      const _pd=priceDiagRow(mint);
      _pd.lastPollError=String(e?.message||e).slice(0,200);
      _pd.lastPollErrorAt=Date.now();
      const updated=store.setToken(mint,{scanError:e.message});
  try{__v1224LinkCreator(mint,__v1223Token(mint))}catch{}
      await evaluateAll(updated);
    }
  },baseTick);
  priceTimers.set(mint,timer);
}
async function processSignature(sig){
  // Single attempt — discovery queue handles retries with correct policy
  let tx;
  try{tx=await rpc.callOnce('getTransaction',[sig,{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}])}
  catch(e){throw e} // queue will account for transactionFetchFailed on final failure
  if(!tx){discMetrics.transactionFetchFailed++;return}
  discMetrics.transactionFetchSucceeded++;

  const msg=tx.transaction.message;
  const keys=(msg.accountKeys||[]).map(x=>typeof x==='string'?x:x.pubkey);
    try{for(const __snap of eventHolderLedger.ingestTransaction(tx)){const __u=eventHolderLedger.applyToStore(store,__snap.mint);if(__u){try{publish(__snap.mint)}catch{}}}}catch{}
    try{for(const __ms of eventMarketLedger.ingestTransaction(tx)){const __mu=eventMarketLedger.applyToStore(store,__ms.mint);if(__mu){try{if(typeof evaluateAI==='function')Promise.resolve(evaluateAI(__mu)).catch(()=>{});else if(typeof evaluateAll==='function')Promise.resolve(evaluateAll(__mu)).catch(()=>{})}catch{}try{publish(__ms.mint)}catch{}}}}catch{}
  // Include both top-level and inner instructions; mark inner for diagnostic logging
  const topLvl=msg.instructions||[];
  const inner=(tx.meta?.innerInstructions||[]).flatMap(x=>(x.instructions||[]).map(ix=>({...ix,_isInner:true})));
  const all=[...topLvl,...inner];

  let pumpCount=0;
  const seenMints=new Set(); // dedup within this transaction by mint

  for(const ix of all){
    const pid=typeof ix.programId==='string'?ix.programId:keys[ix.programIdIndex];
    if(pid!==PUMP)continue;
    pumpCount++;

    const result=decodePumpCreate(ix,keys);
    if(result.ok){
      // Mayhem launches are rejected before storage, enrichment, AI, candidates and chart.
      if(shouldExcludeMayhemCreate(result,EXCLUDE_MAYHEM_MODE)){
        discMetrics.mayhemCreatesIgnored++;
        continue;
      }
      if(seenMints.has(result.mint))continue; // same mint in top-level and inner — add once
      seenMints.add(result.mint);
      discMetrics.createInstructionDecoded++;
      discMetrics.createsDecoded++;
      store.addToken({mint:result.mint,curve:result.curve,name:result.name,symbol:result.symbol,uri:result.uri,creator:result.creator,isMayhemMode:false,launchMode:'standard',launchPlatform:'pump',protocol:'pump',discoveredAt:Date.now(),slot:tx.slot,signature:sig,source:'Pump create'});
  try{__v1224LinkCreator(result.mint,__v1223Token(result.mint))}catch{}
        // MEMEFLOW_V12_20_USER_ONLY_HOLDER_LEDGER: preserve Pump creator separately from trade signers.
        try{
          const __created=store.state?.tokens?.[result.mint];
          const __creator=__created?.creator||null;
          if(__creator)eventHolderLedger.setCreator(mint,__creator);
        }catch{}
      // MEMEFLOW V12.4 immediate discovery bootstrap
      const settingsAdmitted=fastPhaseAStart(result.mint,result.curve);
      if(settingsAdmitted!==false){
        void enrich(result.mint,result.curve).catch(e=>{discMetrics.lastErrorAt=Date.now();discovery.lastError={message:'enrich: '+String(e?.message||e),at:Date.now()}});
      }
    }else if(result.reason==='knownNonCreate'){
      /* MEMEFLOW_V12_11_PUMP_TRADE_PRESSURE
         Use real Pump Buy/Sell activity as the primary cheap buy-pressure
         signal. This avoids leaving admission permanently DEFERRED when
         bonding-curve liquidity snapshots do not move enough. */
      discMetrics.knownNonCreateIgnored++;

      try{
        const logs=tx.meta?.logMessages||[];
        const isBuy=logs.some(x=>/Instruction:\s*(Buy|BuyExactSolIn)/i.test(String(x)));
        const isSell=logs.some(x=>/Instruction:\s*Sell/i.test(String(x)));

        if(isBuy||isSell){
          // Resolve only a mint already tracked by MEMEFLOW from transaction keys.
          // Avoid O(all tokens) scanning on every Pump transaction.
          const tradeMint=keys.find(k=>store.state.tokens[k]);

          if(tradeMint){
            const nowTrade=Date.now();
            const oldWindow=tradeWindows.get(tradeMint)||{events:[]};
            const events=Array.isArray(oldWindow.events)
              ? oldWindow.events.filter(e=>nowTrade-Number(e.t||0)<=60000)
              : [];

            if(isBuy)events.push({t:nowTrade,side:'buy'});
            if(isSell)events.push({t:nowTrade,side:'sell'});

            const buy=events.filter(e=>e.side==='buy').length;
            const sell=events.filter(e=>e.side==='sell').length;

            // Same semantics already expected by minBuyPressure:
            // buys=3,sells=1 => 3.0
            // buys>0,sells=0 => buy count as positive pressure
            // no buys => 0 when sells exist, otherwise null
            const pressure=sell>0
              ? buy/sell
              : (buy>0 ? buy : null);

            tradeWindows.set(tradeMint,{
              events,
              buy,
              sell,
              updatedAt:nowTrade,
              source:'pump_trade_logs'
            });

            const existing=store.state.tokens[tradeMint];
            if(existing){
              const updated=store.setToken(tradeMint,{
                buyPressure:pressure,
                momentum:pressure,
                lastMarketActivityAt:nowTrade
              });

              // Re-run V12.9/V12.10 admission immediately after real trade data.
              try{
                const hs=holderQueue.inspect?.(tradeMint)||null;
                const alreadyHandled=Boolean(
                  hs?.pending ||
                  hs?.active ||
                  Number(hs?.attempts||0)>0 ||
                  updated?.holderFresh===true
                );

                if(!alreadyHandled){
                  const admission=holderAdmissionForActiveUsers(tradeMint);

                  if(admission?.allow===true){
                    const before=holderQueue.inspect?.(tradeMint)||null;
                    holderQueue.enqueue(tradeMint);
                    const after=holderQueue.inspect?.(tradeMint)||null;

                    if(!before?.pending &&
                       (after?.pending ||
                        after?.active ||
                        Number(after?.attempts||0)>0)){
                      fastPhaseMetrics.holderQueued++;
                    }
                  }
                }
              }catch(e){
                fastPhaseMetrics.bootstrapErrors++;
                fastPhaseMetrics.lastBootstrapError=
                  'trade admission recheck: '+String(e?.message||e);
              }

              Promise.resolve(evaluateAll(updated)).catch(()=>{});
              try{publish(tradeMint)}catch(_){}
              try{paper.onTokenUpdate(tradeMint,updated)}catch(_){}
            }
          }
        }
      }catch(e){
        discMetrics.lastErrorAt=Date.now();
      }
    }else if(result.reason==='ignoredPumpEventPayload'){
      // Inner CPI event payload — not a decode failure
      discMetrics.ignoredPumpEventPayloads++;
    }else{
      // Actual create decode failure (bad layout, invalid mint, unknown disc, no data)
      discMetrics.decodeFailed++;
      discMetrics[result.reason]=(discMetrics[result.reason]||0)+1;
      if(result.reason==='unknownPumpDiscriminator'&&result.discBytes){
        const dKey=result.discBytes.join(',');
        discMetrics.unknownPumpDiscriminatorsByValue[dKey]=(discMetrics.unknownPumpDiscriminatorsByValue[dKey]||0)+1;
        // console.log is rate-limited inside decodePumpCreate (first occurrence only)
      }
    }
  }
  if(pumpCount===0)discMetrics.noPumpInstruction++;
}
const discQueue=makeDiscoveryQueue(
  {maxConcurrent:MAX_CONCURRENT,queueMax:QUEUE_MAX,maxSignatureAgeMs:SIG_MAX_AGE_MS,maxRetries:4,circuitBreakerPauseMs:15000,retryDelays:[1000,3000,8000,15000]},
  {processFn:processSignature,discMetrics,
   onSignatureProcessed:()=>{if(discovery.connected&&discovery.error)discovery.error=null;discovery.lastError=null},
   onSignatureFailed:(e)=>{discMetrics.lastErrorAt=Date.now();discovery.lastError={message:e.message,at:Date.now()}}}
);

/* MEMEFLOW_V12_DISCOVERY_ENRICHMENT_BRIDGE
   Self-healing bridge for fresh Pump tokens that reached store.tokens but
   missed Phase A enrichment / holder queue / price lifecycle / evaluation.
   Idempotent and bounded: it touches only very recent tokens and applies
   per-mint retry spacing so it cannot create an RPC storm. */
const bridgeMetrics={
  scans:0,
  freshPumpSeen:0,
  fullEnrichStarted:0,
  fullEnrichSucceeded:0,
  fullEnrichFailed:0,
  holderRescued:0,
  priceTimerRescued:0,
  evaluationRescued:0,
  skippedInflight:0,
  settingsRejectedSkipped:0,
  lastRunAt:null,
  lastMint:null,
  lastError:null,
  lastErrorAt:null
};
const bridgeInflight=new Set();
const bridgeState=new Map(); // mint -> {fullAt,holderAt,evalAt,fullAttempts}
const BRIDGE_TICK_MS=Math.max(1000,Number(process.env.DISCOVERY_BRIDGE_TICK_MS||2000));
const BRIDGE_MAX_AGE_MS=Math.max(60000,Number(process.env.DISCOVERY_BRIDGE_MAX_AGE_MS||300000));
const BRIDGE_FULL_RETRY_MS=Math.max(10000,Number(process.env.DISCOVERY_BRIDGE_FULL_RETRY_MS||20000));
const BRIDGE_HOLDER_RETRY_MS=Math.max(15000,Number(process.env.DISCOVERY_BRIDGE_HOLDER_RETRY_MS||45000));
const BRIDGE_MAX_FULL_ATTEMPTS=Math.max(1,Number(process.env.DISCOVERY_BRIDGE_MAX_FULL_ATTEMPTS||3));
/* MEMEFLOW_V12_1_PIPELINE_STABILITY */
const BRIDGE_MAX_PER_RUN=Math.max(1,Number(process.env.DISCOVERY_BRIDGE_MAX_PER_RUN||4));
const BRIDGE_MIN_TOKEN_AGE_MS=Math.max(1500,Number(process.env.DISCOVERY_BRIDGE_MIN_TOKEN_AGE_MS||3000));
/* MEMEFLOW_V12_2_FRESH_TOKEN_PRIORITY_SCHEDULER */
const FRESH_PRIORITY_MAX_AGE_MS=Math.max(10000,Number(process.env.FRESH_PRIORITY_MAX_AGE_MS||45000));
const FRESH_PRIORITY_BATCH=Math.max(1,Number(process.env.FRESH_PRIORITY_BATCH||3));
const RECOVERY_BATCH=Math.max(1,Number(process.env.RECOVERY_BATCH||2));
const BRIDGE_ITEM_TIMEOUT_MS=Math.max(3000,Number(process.env.BRIDGE_ITEM_TIMEOUT_MS||12000));
/* MEMEFLOW_V12_3_SLA_FAIR_SCHEDULER */
const FRESH_SLA_MS=Math.max(5000,Number(process.env.FRESH_SLA_MS||15000));
const FRESH_SLA_ESCALATE_MS=Math.max(FRESH_SLA_MS,Number(process.env.FRESH_SLA_ESCALATE_MS||12000));
bridgeMetrics.slaMs=FRESH_SLA_MS;
bridgeMetrics.currentFreshBacklog=0;
bridgeMetrics.currentUrgentFreshBacklog=0;
bridgeMetrics.oldestFreshUnprocessedAgeMs=0;
bridgeMetrics.slaMisses15s=bridgeMetrics.slaMisses15s||0;
bridgeMetrics.slaMissesCurrent=0;
bridgeMetrics.slaEscalations=bridgeMetrics.slaEscalations||0;

bridgeMetrics.freshPriorityRuns=bridgeMetrics.freshPriorityRuns||0;
bridgeMetrics.freshPriorityStarted=bridgeMetrics.freshPriorityStarted||0;
bridgeMetrics.freshPrioritySucceeded=bridgeMetrics.freshPrioritySucceeded||0;
bridgeMetrics.freshPriorityTimedOut=bridgeMetrics.freshPriorityTimedOut||0;
bridgeMetrics.recoveryStarted=bridgeMetrics.recoveryStarted||0;
bridgeMetrics.recoverySucceeded=bridgeMetrics.recoverySucceeded||0;
bridgeMetrics.itemTimeouts=bridgeMetrics.itemTimeouts||0;
bridgeMetrics.freshPriorityBatch=FRESH_PRIORITY_BATCH;
bridgeMetrics.recoveryBatch=RECOVERY_BATCH;

let bridgeRunActive=false;
let bridgeRunSequence=0;
bridgeMetrics.runsStarted=bridgeMetrics.runsStarted||0;
bridgeMetrics.runsCompleted=bridgeMetrics.runsCompleted||0;
bridgeMetrics.runsSkippedBusy=bridgeMetrics.runsSkippedBusy||0;
bridgeMetrics.tokensDeferred=bridgeMetrics.tokensDeferred||0;
bridgeMetrics.maxPerRun=BRIDGE_MAX_PER_RUN;


function bridgeMint(token){
  return String(token?.mint||token?.tokenMint||token?.tokenAddress||'').trim();
}
function bridgeIsPump(token){
  const mint=bridgeMint(token).toLowerCase();
  const lp=String(token?.launchPlatform||token?.protocol||'').toLowerCase();
  const src=String(token?.source||'').toLowerCase();
  return lp==='pump'||mint.endsWith('pump')||src.includes('pump create');
}
function bridgeAgeMs(token,now=Date.now()){
  const t=Number(token?.discoveredAt||token?.createdAt||token?.firstSeenAt||0);
  return t>0?Math.max(0,now-t):Infinity;
}
function bridgeHolderState(mint){
  try{return holderQueue.inspect?.(mint)||null}catch{return null}
}
async function bridgeRepairToken(token,now=Date.now()){
  const mint=bridgeMint(token);
  if(!mint||!bridgeIsPump(token)||bridgeAgeMs(token,now)>BRIDGE_MAX_AGE_MS)return;
  // Give the normal discovery path a short head start. The bridge is recovery,
  // not the primary pipeline.
  if(bridgeAgeMs(token,now)<BRIDGE_MIN_TOKEN_AGE_MS)return;

  // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
  // WS-first automatic Pump pipeline: evaluation/publish only.
  // Do NOT run supply/curve/holder RPC recovery.
  if(token?.wsFirst===true){
    try{
      const h=eventHolderLedger.inspect(mint);

      if(h){
        eventHolderLedger.applyToStore(
          store,
          mint
        );
      }
    }catch{}

    try{
      await Promise.resolve(
        evaluateAll(
          store.state.tokens[mint] ||
          token
        )
      );

      bridgeMetrics.evaluationRescued++;
    }catch{}

    try{publish(mint)}catch{}

    return;
  }

  const settingsAdmission=settingsGateCheck(token);
  if(settingsAdmission?.allow===false){
    bridgeMetrics.settingsRejectedSkipped++;
    return;
  }

  bridgeMetrics.freshPumpSeen++;
  bridgeMetrics.lastMint=mint;

  let st=bridgeState.get(mint);
  if(!st){
    st={fullAt:0,holderAt:0,evalAt:0,fullAttempts:0};
    bridgeState.set(mint,st);
  }

  const curve=token?.curve||token?.bondingCurve||token?.associatedBondingCurve||null;
  const phaseADone=Boolean(
  token?.totalSupply!=null &&
  token?.decimals!=null
);

  // A raw Pump-create row in store without Phase A is the exact V12 failure mode.
  if(!phaseADone && st.fullAttempts<BRIDGE_MAX_FULL_ATTEMPTS && now-st.fullAt>=BRIDGE_FULL_RETRY_MS){
    if(bridgeInflight.has(mint)){
      bridgeMetrics.skippedInflight++;
      return;
    }
    st.fullAt=now;
    st.fullAttempts++;
    bridgeInflight.add(mint);
    bridgeMetrics.fullEnrichStarted++;
    try{
      await enrich(mint,curve);
      bridgeMetrics.fullEnrichSucceeded++;
    }catch(e){
      bridgeMetrics.fullEnrichFailed++;
      bridgeMetrics.lastError=String(e?.message||e).slice(0,200);
      bridgeMetrics.lastErrorAt=Date.now();
    }finally{
      bridgeInflight.delete(mint);
    }
    return; // enrich() already evaluates, starts price timer and enqueues holders.
  }

  // Rescue price lifecycle independently when Phase A exists.
  if(curve && !priceTimers.has(mint)){
    try{
      ensurePriceTimer(mint,curve);
      bridgeMetrics.priceTimerRescued++;
    }catch(e){
      bridgeMetrics.lastError=String(e?.message||e).slice(0,200);
      bridgeMetrics.lastErrorAt=Date.now();
    }
  }

  // Rescue missing holder queue. Never requeue a pending/active job.
  if(!token?.holderFresh && now-st.holderAt>=BRIDGE_HOLDER_RETRY_MS){
    const hs=bridgeHolderState(mint);
    const busy=Boolean(hs?.pending||hs?.active);
    const alreadySucceeded=Boolean(hs?.lastSuccessAt);
    if(!busy&&!alreadySucceeded){
      try{
        // MEMEFLOW_V12_9_PRE_QUEUE_ADMISSION_BRIDGE
        const admission=holderAdmissionForActiveUsers(mint);

        if(admission?.allow!==false){
          const queued=holderQueue.enqueue(mint);
          if(queued!==false){
            st.holderAt=now;
            bridgeMetrics.holderRescued++;
          }
        }else{
          // throttle bridge retries while cheap market data is still developing
          st.holderAt=now;
        }
      }catch(e){
        bridgeMetrics.lastError=String(e?.message||e).slice(0,200);
        bridgeMetrics.lastErrorAt=Date.now();
      }
    }
  }

  // If token was enriched but somehow has no decision for any active user,
  // trigger one bounded evaluation pass. evaluateAll itself is user-aware.
  if(phaseADone && now-st.evalAt>=60000){
    let hasAnyDecision=false;
    try{
      for(const m of Object.values(store?._uidDec||{})){
        if(m?.has?.(mint)){hasAnyDecision=true;break}
      }
    }catch{}
    if(!hasAnyDecision){
      st.evalAt=now;
      try{
        await evaluateAll(store.state.tokens[mint]||token);
        bridgeMetrics.evaluationRescued++;
      }catch(e){
        bridgeMetrics.lastError=String(e?.message||e).slice(0,200);
        bridgeMetrics.lastErrorAt=Date.now();
      }
    }
  }
}

let bridgeTimer=null;

function bridgePhaseAStarted(token){
  return Boolean(
    token?.totalSupply!=null &&
    token?.decimals!=null
  );
}
function bridgePipelineStarted(token){
  const mint=bridgeMint(token);
  let holder=null;
  try{ holder=holderQueue.inspect?.(mint)||null; }catch{}
  const holderStarted=Boolean(
    holder?.pending ||
    holder?.active ||
    Number(holder?.attempts||0)>0 ||
    holder?.lastSuccessAt
  );
  const priceStarted=Boolean(priceTimers?.has?.(mint) || priceLifecycleDiag?.get?.(mint));
  return bridgePhaseAStarted(token) || holderStarted || priceStarted;
}
function bridgeNeedsFastStart(token){
  return !bridgePipelineStarted(token);
}
async function runDiscoveryBridge(){
  if(bridgeRunActive){
    bridgeMetrics.runsSkippedBusy++;
    return;
  }

  bridgeRunActive=true;
  const runId=++bridgeRunSequence;
  bridgeMetrics.runsStarted++;
  bridgeMetrics.scans++;
  bridgeMetrics.lastRunAt=Date.now();

  const now=Date.now();

  async function withItemTimeout(token,label){
    const mint=bridgeMint(token);
    let timer=null;
    try{
      const timeout=new Promise((_,reject)=>{
        timer=setTimeout(()=>{
          const e=new Error('V12.3 '+label+' timeout for '+mint);
          e.code='BRIDGE_ITEM_TIMEOUT';
          reject(e);
        },BRIDGE_ITEM_TIMEOUT_MS);
        timer.unref?.();
      });
      await Promise.race([bridgeRepairToken(token,now),timeout]);
      return true;
    }catch(e){
      if(e?.code==='BRIDGE_ITEM_TIMEOUT'){
        bridgeMetrics.itemTimeouts++;
        if(label==='fresh')bridgeMetrics.freshPriorityTimedOut++;
      }else{
        bridgeMetrics.lastError=String(e?.message||e).slice(0,200);
        bridgeMetrics.lastErrorAt=Date.now();
      }
      return false;
    }finally{
      if(timer)clearTimeout(timer);
    }
  }

  try{
    const settingsContext=settingsGateContext(now);
    const all=Object.values(store?.state?.tokens||{})
      .filter(t=>bridgeIsPump(t)&&bridgeAgeMs(t,now)<=BRIDGE_MAX_AGE_MS&&bridgeAgeMs(t,now)>=BRIDGE_MIN_TOKEN_AGE_MS)
      .filter(t=>!settingsGateCachedRejection(t,settingsContext,now));

    const freshWindow=all.filter(t=>bridgeAgeMs(t,now)<=FRESH_PRIORITY_MAX_AGE_MS);
    const freshUnprocessed=freshWindow
      .filter(bridgeNeedsFastStart)
      .sort((a,b)=>Number(a?.discoveredAt||0)-Number(b?.discoveredAt||0)); // OLDEST FIRST

    const urgent=freshUnprocessed.filter(t=>bridgeAgeMs(t,now)>=FRESH_SLA_ESCALATE_MS);

    bridgeMetrics.currentFreshBacklog=freshUnprocessed.length;
    bridgeMetrics.currentUrgentFreshBacklog=urgent.length;
    bridgeMetrics.oldestFreshUnprocessedAgeMs=freshUnprocessed.length
      ? Math.max(...freshUnprocessed.map(t=>bridgeAgeMs(t,now)))
      : 0;
    bridgeMetrics.slaMissesCurrent=freshUnprocessed.filter(t=>bridgeAgeMs(t,now)>FRESH_SLA_MS).length;
    if(bridgeMetrics.slaMissesCurrent>0){
      bridgeMetrics.slaMisses15s+=bridgeMetrics.slaMissesCurrent;
    }

    // SLA lane:
    // 1) oldest unprocessed tokens first;
    // 2) tokens nearing/missing SLA are automatically ahead of newer arrivals.
    const fresh=freshUnprocessed.slice(0,FRESH_PRIORITY_BATCH);
    if(fresh.some(t=>bridgeAgeMs(t,now)>=FRESH_SLA_ESCALATE_MS)){
      bridgeMetrics.slaEscalations++;
    }

    const freshMints=new Set(fresh.map(bridgeMint));

    // Recovery lane remains old-first, but never steals a slot from an
    // unprocessed fresh token selected above.
    const recovery=all
      .filter(t=>!freshMints.has(bridgeMint(t)))
      .filter(t=>!freshWindow.includes(t) || !bridgeNeedsFastStart(t))
      .sort((a,b)=>Number(a?.discoveredAt||0)-Number(b?.discoveredAt||0))
      .slice(0,RECOVERY_BATCH);

    bridgeMetrics.freshPriorityRuns++;
    bridgeMetrics.tokensDeferred+=Math.max(0,all.length-fresh.length-recovery.length);

    for(const token of fresh){
      bridgeMetrics.freshPriorityStarted++;
      const ok=await withItemTimeout(token,'fresh');
      if(ok)bridgeMetrics.freshPrioritySucceeded++;
      await new Promise(resolve=>setTimeout(resolve,15));
    }

    for(const token of recovery){
      bridgeMetrics.recoveryStarted++;
      const ok=await withItemTimeout(token,'recovery');
      if(ok)bridgeMetrics.recoverySucceeded++;
      await new Promise(resolve=>setTimeout(resolve,25));
    }

    if(bridgeState.size>2000){
      for(const [mint] of bridgeState){
        const t=store?.state?.tokens?.[mint];
        if(!t||bridgeAgeMs(t,now)>BRIDGE_MAX_AGE_MS*2)bridgeState.delete(mint);
        if(bridgeState.size<=1000)break;
      }
    }
  }catch(e){
    bridgeMetrics.lastError=String(e?.message||e).slice(0,200);
    bridgeMetrics.lastErrorAt=Date.now();
  }finally{
    bridgeRunActive=false;
    bridgeMetrics.runsCompleted++;
    bridgeMetrics.lastCompletedRunId=runId;
    bridgeMetrics.lastCompletedAt=Date.now();
  }
}
function startDiscoveryBridge(){
  if(bridgeTimer)return;
  void runDiscoveryBridge();
  bridgeTimer=setInterval(()=>void runDiscoveryBridge(),BRIDGE_TICK_MS);
  bridgeTimer.unref?.();
}
startDiscoveryBridge();


// MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
function __mfWsMetadataUrl(value){
  const raw=String(value||'').trim();

  if(!raw)return null;

  if(/^ipfs:\/\//i.test(raw)){
    return 'https://ipfs.io/ipfs/' +
      raw
        .replace(/^ipfs:\/\//i,'')
        .replace(/^ipfs\//i,'');
  }

  if(/^ar:\/\//i.test(raw)){
    return 'https://arweave.net/' +
      raw.replace(/^ar:\/\//i,'');
  }

  return /^https?:\/\//i.test(raw)
    ? raw
    : null;
}

async function __mfWsMetadataEnrich(mint,uri){
  const url=__mfWsMetadataUrl(uri);

  if(!url)return;

  const c=new AbortController();
  const timer=setTimeout(()=>c.abort(),4500);

  try{
    const r=await fetch(
      url,
      {
        signal:c.signal,
        headers:{
          accept:'application/json',
          'user-agent':'MEMEFLOW/1.0 token-metadata'
        }
      }
    );

    if(!r.ok)return;

    const m=await r.json().catch(()=>null);

    if(!m||typeof m!=='object')return;

    const image=__mfWsMetadataUrl(
      m.image ||
      m.image_url ||
      m.imageUrl ||
      m.logo ||
      m.logoUrl ||
      m?.properties?.files?.[0]?.uri
    );

    const txt=(...xs)=>
      xs
        .find(x=>typeof x==='string'&&x.trim())
        ?.trim()
        ?.slice(0,500) || null;

    const updated=store.setToken(
      mint,
      {
        metadataUrl:url,
        imageUrl:image||null,
        image:image||null,
        logoUrl:image||null,

        websiteUrl:txt(
          m.website,
          m.websiteUrl,
          m.external_url,
          m.externalUrl,
          m?.extensions?.website,
          m?.links?.website
        ),

        twitterUrl:txt(
          m.twitter,
          m.twitterUrl,
          m.x,
          m.xUrl,
          m?.extensions?.twitter,
          m?.extensions?.x,
          m?.links?.twitter,
          m?.links?.x
        ),

        telegramUrl:txt(
          m.telegram,
          m.telegramUrl,
          m?.extensions?.telegram,
          m?.links?.telegram
        ),

        metadataDescription:txt(m.description,m?.metadata?.description),
        socialsKnown:true
      }
    );

    try{
      await Promise.resolve(evaluateAll(updated));
    }catch{}

    try{publish(mint)}catch{}

  }catch{
  }finally{
    clearTimeout(timer);
  }
}

function __ingestPumpCreateEventDirect(
  logs,
  {
    signature=null,
    slot=null
  }={}
){
  const rows=
    Array.isArray(logs)
      ? logs
      : [];

  let e=null;

  for(const log of rows){
    e=decodePumpCreateEventLog(log);
    if(e)break;
  }

  if(!e){
    discMetrics.directCreateDecodeFailed++;
    return null;
  }

  if(
    EXCLUDE_MAYHEM_MODE &&
    e.isMayhemMode===true
  ){
    discMetrics.mayhemCreatesIgnored++;
    return null;
  }

  const decimals=6;

  const totalSupplyRaw=
    e.tokenTotalSupply;

  const totalSupply=
    typeof totalSupplyRaw==='bigint'
      ? Number(totalSupplyRaw)/(10**decimals)
      : null;

  const vt=
    typeof e.virtualTokenReserves==='bigint'
      ? Number(e.virtualTokenReserves)
      : NaN;

  const vs=
    typeof e.virtualSolReserves==='bigint'
      ? Number(e.virtualSolReserves)
      : NaN;

  const priceSol=
    Number.isFinite(vt) &&
    vt>0 &&
    Number.isFinite(vs) &&
    vs>0
      ? (vs/1e9)/(vt/(10**decimals))
      : null;

  const ts=
    typeof e.timestamp==='bigint'
      ? Number(e.timestamp)
      : Number(e.timestamp);

  const pumpCreatedAt=
    Number.isFinite(ts)&&ts>0
      ? (
          ts<1e12
            ? ts*1000
            : ts
        )
      : Date.now();

  const existing=
    store.state.tokens?.[e.mint] ||
    null;

  const patch={
    mint:e.mint,

    curve:e.bondingCurve,
    bondingCurve:e.bondingCurve,

    name:e.name,
    symbol:e.symbol,
    uri:e.uri,
    creator:e.creator,

    decimals,

    totalSupply:
      Number.isFinite(totalSupply)&&totalSupply>0
        ? totalSupply
        : undefined,

    priceSol:
      Number.isFinite(priceSol)&&priceSol>0
        ? priceSol
        : undefined,

    marketCapSol:
      Number.isFinite(priceSol)&&
      priceSol>0&&
      Number.isFinite(totalSupply)&&
      totalSupply>0
        ? priceSol*totalSupply
        : undefined,

    pumpCreatedAt,
    discoveredAt:
      existing?.discoveredAt ||
      Date.now(),

    slot,
    signature,

    isMayhemMode:false,
    launchMode:'standard',

    launchPlatform:'pump',
    protocol:'pump',

    source:'Pump CreateEvent WS',
    marketSource:'pump-create-event-ws',

    wsFirst:true,

    virtualTokenReservesRaw:
      e.virtualTokenReserves?.toString?.()||null,

    virtualSolReservesRaw:
      e.virtualSolReserves?.toString?.()||null,

    realTokenReservesRaw:
      e.realTokenReserves?.toString?.()||null,

    initialRealTokenReservesRaw:
      e.realTokenReserves?.toString?.()||null,

    tokenTotalSupplyRaw:
      e.tokenTotalSupply?.toString?.()||null,

    quoteMint:e.quoteMint||null,
    virtualQuoteReservesRaw:e.virtualQuoteReserves?.toString?.()||null,
    createSlot:slot,
    createSignature:signature,
    bondingCurvePct:0,
    buyTransactions:0,
    sellTransactions:0,
    totalTransactions:0,
    totalFeesSol:0,
    volume24hSol:0,
    opportunityScore:0,
    opportunityEvidenceReady:false,
    opportunityTrendHealthy:false,
    dead:false,
    deadReason:null,

    scanError:null,

    ...(
      existing
        ? {}
        : {
            holderFresh:false,
            holderCount:null,
            top10Pct:null,
            developerPct:null,
            buyPressure:null
          }
    )
  };

  for(const k of Object.keys(patch)){
    if(patch[k]===undefined){
      delete patch[k];
    }
  }

  const token=
    existing
      ? store.setToken(e.mint,patch)
      : store.addToken(patch);

  try{
    eventHolderLedger.setCreateState(
      e.mint,
      {
        creator:e.creator,
        totalSupplyRaw:e.tokenTotalSupply,
        decimals
      }
    );
  }catch{}

  discMetrics.directCreateEvents++;
  discMetrics.createsDecoded++;
  discMetrics.createInstructionDecoded++;
  discMetrics.lastSuccessfulScanAt=Date.now();

  try{
    Promise
      .resolve(evaluateAll(token))
      .catch(()=>{});
  }catch{}

  try{publish(e.mint)}catch{}

  // Plain HTTP metadata only. No Solana RPC.
  void __mfWsMetadataEnrich(
    e.mint,
    e.uri
  );

  return token;
}

function startDiscovery(i=0){
  if(process.env.DISCOVERY_ENABLED==='false'||!wsUrls.length){discovery.error='SOLANA_WS_URLS not configured';return}
  const url=wsUrls[i%wsUrls.length];
  try{
    ws=new WebSocket(url);
    discovery.url=url;
    ws.onopen=()=>{
      discovery.connected=true;discovery.error=null;wsReconnectAttempt=0;
      ws.send(JSON.stringify({jsonrpc:'2.0',id:1,method:'logsSubscribe',params:[{mentions:[PUMP]},{commitment:process.env.SOLANA_COMMITMENT||'confirmed'}]}));
    };
    // WS-first discovery: Pump CREATE is decoded directly from WebSocket logs.
    ws.onmessage=ev=>{
      try{
        const m=JSON.parse(ev.data);
        const sig=m.params?.result?.value?.signature;
        if(!sig)return;
        discMetrics.eventsReceived++;
        const logs=m.params?.result?.value?.logs;
        if(!Array.isArray(logs)){discMetrics.eventsWithoutLogs++;discMetrics.eventsFiltered++;return}

        const isCreate=logs.some(l=>/Instruction:\s*Create(?:V2|\s+V2|\s*$)/i.test(l));

        // MEMEFLOW_FRESH_SESSION_SCANNER_V1
        // CREATE establishes the mint before TradeEvents from the same tx are
        // applied. Unknown global Pump trades are not allowed to create rows.
        if(isCreate){
          try{__systemViewEmitV31('create',{signature:String(sig||''),ts:Date.now()})}catch{}
          discMetrics.createEventsAccepted++;
          discovery.lastEventAt=Date.now();
          __ingestPumpCreateEventDirect(
            logs,
            {
              signature:String(sig||''),
              slot:m.params?.result?.context?.slot??null
            }
          );
        }

        try{
          __pumpLiveTradeFeed?.ingestLogs?.(logs,{
            signature:String(sig||''),
            source:'discovery-ws',
            slot:m.params?.result?.context?.slot??null
          });
        }catch{}

        if(!isCreate){
          discMetrics.nonCreateEventsIgnored++;
          discMetrics.eventsFiltered++;
          return;
        }
      }catch{}
    };
    // WS errors stored as lastError; do not overwrite connection state here
    ws.onerror=e=>{discovery.lastError={message:'WebSocket error'+(e?.message?': '+e.message:''),at:Date.now()};setTimeout(()=>{try{ws?.close()}catch{}},250)};
    ws.onclose=()=>{discovery.connected=false;discovery.reconnects++;wsReconnectAttempt++;clearTimeout(wsTimer);wsTimer=setTimeout(()=>startDiscovery(i+1),Math.min(30000,1000*2**Math.min(wsReconnectAttempt,5)))};
  }catch(e){discovery.error=e.message;wsTimer=setTimeout(()=>startDiscovery(i+1),5000)}
}
function shadowValidateSettings(settings,limit=50){
  const rows=__mfLiveScannerTokens()
    .slice(0,Math.max(1,Math.min(200,limit)));

  const counts={
    WAITING:0,
    WATCH:0,
    'BUY READY':0,
    BLOCKED:0,
    EXPIRED:0
  };
  const admission={ADMITTED:0,PENDING:0,REJECTED:0};
  const errors=[];

  for(const token of rows){
    try{
      const gate=evaluateEntryAdmission(token,settings);
      admission[gate.state]=(admission[gate.state]||0)+1;

      if(gate.admitted!==true)continue;

      const d=evaluate(token,settings);
      counts[d.state]=(counts[d.state]||0)+1;
    }catch(e){
      errors.push({mint:token.mint||null,message:e.message});
    }
  }

  return {
    tested:rows.length,
    admitted:admission.ADMITTED||0,
    hidden:(admission.PENDING||0)+(admission.REJECTED||0),
    admission,
    counts,
    errors
  };
}

function reevaluateUser(uid){
  const settings=store.settings(uid);
  const tokens=__mfLiveScannerTokens();
  const settingsVersion=
    store.user(uid)?.settingsVersion||
    store.user(uid)?.updatedAt||
    Date.now();

  let count=0,errors=0,hidden=0;
  const states={WAITING:0,WATCH:0,BLOCKED:0,'BUY READY':0,EXPIRED:0};

  for(const token of tokens){
    try{
      const admission=__mfEntryAdmissionForUser(token,uid,settings);

      if(admission?.admitted!==true){
        __mfClearDecisionForUserMint(uid,token.mint);
        __mfEntryAdmissionState.set(uid+':'+token.mint,false);
        hidden++;
        continue;
      }

      __mfEntryAdmissionState.set(uid+':'+token.mint,true);

      const d=evaluate(token,settings);
      const saved={
        ...d,
        primaryReason:d.primaryReason,
        settingsVersion,
        reevaluatedAt:Date.now()
      };

      store.setDecision(uid,token.mint,saved);
      states[d.state]=(states[d.state]||0)+1;

      if(d.state==='BUY READY'){
        void __mfHandleDecision(uid,token,saved).catch(()=>{});
      }

      count++;
    }catch(_){
      errors++;
    }
  }

  return {count,hidden,errors,states,settingsVersion};
}

/* MEMEFLOW_NATIVE_AI_V46_BEGIN */
const OPENAI_RESPONSES_URL='https://api.openai.com/v1/responses';
const OPENAI_MODEL=process.env.OPENAI_MODEL||'gpt-5-mini';
function openAiText(data){
  if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
  const parts=[];
  for(const item of data?.output||[])for(const part of item?.content||[])if(typeof part?.text==='string')parts.push(part.text);
  return parts.join('\n').trim();
}
async function callMemeflowOpenAI(prompt,context,mode='ask'){
  const key=process.env.OPENAI_API_KEY||'';
  if(!key){const e=Error('OPENAI_API_KEY is not configured.');e.status=503;throw e}
  const compact=JSON.stringify(context||{}).slice(0,18000);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
    const r=await fetch(OPENAI_RESPONSES_URL,{
      method:'POST',
      headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},
      body:JSON.stringify({
        model:OPENAI_MODEL,
        instructions:'You are MEMEFLOW OpenAI, a read-only Solana memecoin analysis assistant. Use only the supplied MEMEFLOW context. Never claim to execute trades, change settings, bypass gates or access private keys. Keep answers concise, concrete and risk-aware.',
        input:`${prompt}\n\nMEMEFLOW CONTEXT:\n${compact}`
      }),
      signal:controller.signal
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok){const e=Error(data?.error?.message||`OpenAI HTTP ${r.status}`);e.status=r.status;throw e}
    const text=openAiText(data);
    if(!text){const e=Error('OpenAI returned no text.');e.status=502;throw e}
    return {text,model:data.model||OPENAI_MODEL,responseId:data.id||null};
  }catch(e){
    if(e?.name==='AbortError'){const x=Error('OpenAI request timed out.');x.status=504;throw x}
    throw e
  }finally{clearTimeout(timer)}
}
/* MEMEFLOW_NATIVE_AI_V46_END */


/* MEMEFLOW_AI_STANDALONE_V49_BEGIN */
const MF48_KEY_RE=/[1-9A-HJ-NP-Za-km-z]{32,44}/g;
const MF48_NATIVE_SYMBOLS=new Set(['SOL','WSOL','USDC','USDT']);
function mf49Num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function mf49Err(message,status=400,code='STANDALONE_SCAN_ERROR'){const e=Error(message);e.status=status;e.code=code;return e}
async function mf49FetchJson(url,timeoutMs=8000){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),timeoutMs);
 try{
  const r=await fetch(url,{headers:{accept:'application/json','user-agent':'MEMEFLOW/1.0'},signal:c.signal});
  const j=await r.json().catch(()=>null);
  if(!r.ok)throw mf49Err(`Market data HTTP ${r.status}`,502,'MARKET_DATA_ERROR');
  return j
 }catch(e){
  if(e?.name==='AbortError')throw mf49Err('Market data request timed out.',504,'MARKET_DATA_TIMEOUT');
  throw e
 }finally{clearTimeout(t)}
}
function mf49PairToken(pair,mint=null){
 const base=pair?.baseToken||{},quote=pair?.quoteToken||{};
 if(mint&&base.address===mint)return base;
 if(mint&&quote.address===mint)return quote;
 const bSym=String(base.symbol||'').toUpperCase(),qSym=String(quote.symbol||'').toUpperCase();
 if(MF48_NATIVE_SYMBOLS.has(bSym)&&!MF48_NATIVE_SYMBOLS.has(qSym))return quote;
 return base
}
async function mf49ResolveInput(raw){
 const input=String(raw||'').trim();
 if(!input)throw mf49Err('Paste a Solana mint, Pump.fun link or DexScreener link.',400,'TOKEN_INPUT_REQUIRED');

 try{
  const u=new URL(input);
  if(/(^|\.)dexscreener\.com$/i.test(u.hostname)){
   const parts=u.pathname.split('/').filter(Boolean);
   const pairId=(parts.at(-1)||'').match(MF48_KEY_RE)?.[0]||'';
   if(pairId&&validPubkey(pairId)){
    const d=await mf49FetchJson(`https://api.dexscreener.com/latest/dex/pairs/solana/${encodeURIComponent(pairId)}`);
    const pair=(d?.pairs||[]).find(x=>x?.chainId==='solana')||d?.pairs?.[0]||null;
    if(pair){
     const side=mf49PairToken(pair);
     if(side?.address&&validPubkey(side.address))return {mint:side.address,pair,inputKind:'dexscreener-pair'}
    }
   }
  }
 }catch(e){
  if(e?.code&&e.code!=='ERR_INVALID_URL')throw e
 }

 const matches=input.match(MF48_KEY_RE)||[];
 const mint=matches.find(x=>validPubkey(x));
 if(!mint)throw mf49Err('A valid Solana mint address was not found in that value.',400,'INVALID_SOLANA_MINT');
 return {mint,pair:null,inputKind:/pump\.fun/i.test(input)?'pump-fun':'mint'}
}
async function mf49DexPairForMint(mint){
 const rows=await mf49FetchJson(`https://api.dexscreener.com/token-pairs/v1/solana/${encodeURIComponent(mint)}`);
 const pairs=Array.isArray(rows)?rows:[];
 const exact=pairs.filter(p=>p?.baseToken?.address===mint||p?.quoteToken?.address===mint);
 const pool=exact.length?exact:pairs;
 return pool.sort((a,b)=>(mf49Num(b?.liquidity?.usd)||0)-(mf49Num(a?.liquidity?.usd)||0))[0]||null
}
function mf49TxnWindow(pair){
 const tx=pair?.txns||{};
 for(const key of ['m5','h1','h6','h24']){
  const x=tx[key];
  if(x&&(mf49Num(x.buys)!=null||mf49Num(x.sells)!=null))return {key,buys:mf49Num(x.buys)||0,sells:mf49Num(x.sells)||0}
 }
 return {key:null,buys:null,sells:null}
}
async function mf49DeveloperPct(creator,mint,total){
 if(!creator||!validPubkey(creator)||!total)return null;
 try{
  const r=await rpc.call('getTokenAccountsByOwner',[creator,{mint},{encoding:'jsonParsed',commitment:'confirmed'}]);
  let held=0;
  for(const row of r?.value||[]){
   const v=row?.account?.data?.parsed?.info?.tokenAmount?.uiAmountString;
   const n=Number(v);if(Number.isFinite(n))held+=n
  }
  return total?held/total*100:null
 }catch{return null}
}
async function mf49StandaloneScan(raw,u){
 const resolved=await mf49ResolveInput(raw),mint=resolved.mint;
 const known=store.state.tokens[mint]||{};
 const warnings=[],sources=new Set();

 let supplyInfo=null,largestInfo=null,mintInfo=null;
 const rpcJobs=await Promise.allSettled([
  rpc.call('getTokenSupply',[mint,{commitment:'confirmed'}]),
  rpc.call('getTokenLargestAccounts',[mint,{commitment:'confirmed'}]),
  rpc.call('getAccountInfo',[mint,{encoding:'jsonParsed',commitment:'confirmed'}])
 ]);
 if(rpcJobs[0].status==='fulfilled'){supplyInfo=rpcJobs[0].value;sources.add('Solana RPC')}else warnings.push(`Supply: ${rpcJobs[0].reason?.message||'unavailable'}`);
 if(rpcJobs[1].status==='fulfilled'){largestInfo=rpcJobs[1].value;sources.add('Solana RPC')}else warnings.push(`Holders: ${rpcJobs[1].reason?.message||'unavailable'}`);
 if(rpcJobs[2].status==='fulfilled')mintInfo=rpcJobs[2].value;

 const decimals=supplyInfo?.value?.decimals??known.decimals??null;
 const total=mf49Num(supplyInfo?.value?.uiAmountString)??mf49Num(known.totalSupply);
 const vals=(largestInfo?.value||[]).map(x=>mf49Num(x.uiAmountString)).filter(x=>x!=null&&x>0);
 const top10=total&&vals.length?vals.slice(0,10).reduce((a,b)=>a+b,0)/total*100:(mf49Num(known.top10Pct));
 const holderFresh=Boolean(largestInfo);
 const holderCountKnown=mf49Num(known.holderCount);
 const holderCount=holderCountKnown!=null?holderCountKnown:(vals.length&&vals.length<20?vals.length:null);
 const holderCountDisplay=holderCount!=null?String(Math.round(holderCount)):(vals.length>=20?'20+':null);

 let pair=resolved.pair||null;
 if(!pair){
  try{pair=await mf49DexPairForMint(mint);if(pair)sources.add('DexScreener')}
  catch(e){warnings.push(`DEX: ${e.message}`)}
 }else sources.add('DexScreener');

 const side=pair?mf49PairToken(pair,mint):null;
 const name=side?.name||known.name||null,symbol=side?.symbol||known.symbol||null;
 const priceUsd=mf49Num(pair?.priceUsd);
 const liquidityUsd=mf49Num(pair?.liquidity?.usd);
 const marketCapUsd=mf49Num(pair?.marketCap)??mf49Num(pair?.fdv)??(priceUsd!=null&&total!=null?priceUsd*total:null);
 const volume5mUsd=mf49Num(pair?.volume?.m5);
 const tx5=pair?.txns?.m5||null;
 const buys5m=mf49Num(tx5?.buys),sells5m=mf49Num(tx5?.sells);

 let priceSol=mf49Num(known.priceSol),liquiditySol=mf49Num(known.liquiditySol);
 if(known.curve&&validPubkey(known.curve)){
  try{
   const r=await rpc.call('getAccountInfo',[known.curve,{encoding:'base64',commitment:'confirmed'}]);
   if(r?.value?.data?.[0]){
    const c=decodeCurve(r.value.data[0],decimals||6);
    priceSol=mf49Num(c.priceSol)??priceSol;
    liquiditySol=mf49Num(c.liquiditySol)??liquiditySol;
    sources.add('Pump curve')
   }
  }catch(e){warnings.push(`Curve: ${e.message}`)}
 }

 let buyPressure=mf49Num(known.buyPressure);
 const tw=tradeWindows.get(mint);
 if(tw&&(tw.buy||tw.sell)){
  buyPressure=tw.sell?tw.buy/tw.sell:(tw.buy||null);
  sources.add('Live flow')
 }else if(buyPressure==null&&pair){
  const w=mf49TxnWindow(pair);
  if(w.buys!=null||w.sells!=null){
   buyPressure=w.sells?w.buys/w.sells:(w.buys||null)
  }
 }

 const creator=known.creator||null;
 let developerPct=mf49Num(known.developerPct);
 if(developerPct==null&&creator&&total)developerPct=await mf49DeveloperPct(creator,mint,total);

 const mintParsed=mintInfo?.value?.data?.parsed?.info||{};
 const mintAuthority=mintParsed.mintAuthority??null,freezeAuthority=mintParsed.freezeAuthority??null;

 const priceAvailable=priceSol!=null||priceUsd!=null;
 const dataQuality=[total,top10,priceAvailable?1:null].filter(x=>x!=null).length/3;
 const evalToken={
  ...known,
  holderCount,
  top10Pct:top10,
  developerPct,
  buyPressure,
  liquidityUsd,
  marketCapUsd,
  volume24hUsd:mf49Num(pair?.volume?.h24),
  buyTransactions:mf49Num(pair?.txns?.h24?.buys)??buys5m,
  sellTransactions:mf49Num(pair?.txns?.h24?.sells)??sells5m,
  totalTransactions:(()=>{const b=mf49Num(pair?.txns?.h24?.buys)??buys5m,s=mf49Num(pair?.txns?.h24?.sells)??sells5m;return b!=null&&s!=null?b+s:null})(),
  // evaluate() requires a positive SOL price. Do not fake 0 from a USD-only quote;
  // USD-only data remains WAITING for the verified-price execution gate.
  priceSol,
  priceUsd,
  holderFresh,
  dataQuality
 };
 const evaluatorModule=await import('./src/evaluate.mjs');
 const mf49Evaluate=evaluatorModule?.evaluate;
 if(typeof mf49Evaluate!=='function')throw mf49Err('src/evaluate.mjs does not export evaluate().',500,'EVALUATOR_NOT_AVAILABLE');
 const evaluation=mf49Evaluate(evalToken,u.settings);

 if(holderCount==null&&holderCountDisplay==='20+')warnings.push('Exact holder count is not available from standard Solana RPC; evaluator keeps the holder gate waiting.');
 if(developerPct==null)warnings.push('Developer holding is unavailable unless the creator is known.');
 if(!pair&&priceSol==null)warnings.push('No DEX or bonding-curve price was available.');

 return {
  mint,name,symbol,inputKind:resolved.inputKind,
  evaluation,
  market:{
   priceUsd,priceSol,
   marketCapUsd,
   marketCapSol:priceSol!=null&&total!=null?priceSol*total:null,
   liquidityUsd,liquiditySol,
   buyPressure,volume5mUsd,buys5m,sells5m,
   priceChange5mPct:mf49Num(pair?.priceChange?.m5),
   pairAddress:pair?.pairAddress||null,
   dexId:pair?.dexId||null,
   pairUrl:pair?.url||null
  },
  onchain:{
   decimals,totalSupply:total,holderCount,holderCountDisplay,top10Pct:top10,
   developerPct,creator,mintAuthority,freezeAuthority,holderFresh
  },
  settingsApplied:{
   minScore:u.settings?.minScore,maxTop10Pct:u.settings?.maxTop10Pct,
   maxDeveloperPct:u.settings?.maxDeveloperPct,minBuyPressure:u.settings?.minBuyPressure,
   minHolders:u.settings?.minHolders,minConfidence:u.settings?.minConfidence
  },
  sources:[...sources],warnings,
  independent:true,
  candidateFeedTouched:false,
  manualAiScanTouched:false,
  scannedAt:new Date().toISOString()
 }
}
/* MEMEFLOW_AI_STANDALONE_V49_END */


// MEMEFLOW_TERMINAL_SOL_USD_V1
const MF_SOL_USD_TTL_MS=30000;
let mfSolUsdCache={
  priceUsd:null,
  updatedAt:0,
  source:null
};

async function mfFetchJsonTimeout(url,timeoutMs=1800){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);

  try{
    const response=await fetch(url,{
      headers:{
        accept:'application/json',
        'user-agent':'MEMEFLOW/1.0'
      },
      signal:controller.signal
    });

    const data=await response.json().catch(()=>null);

    if(!response.ok){
      throw new Error(`HTTP ${response.status}`);
    }

    return data;
  }finally{
    clearTimeout(timer);
  }
}

async function mfGetSolUsd(){
  const now=Date.now();

  if(
    Number(mfSolUsdCache.priceUsd)>0 &&
    now-Number(mfSolUsdCache.updatedAt)<MF_SOL_USD_TTL_MS
  ){
    return {...mfSolUsdCache,stale:false};
  }

  try{
    const result=await Promise.any([
      mfFetchJsonTimeout(
        'https://api.coinbase.com/v2/prices/SOL-USD/spot'
      ).then(data=>{
        const priceUsd=Number(data?.data?.amount);
        if(!(priceUsd>0))throw new Error('Coinbase returned no SOL/USD price');
        return {priceUsd,source:'coinbase'};
      }),

      mfFetchJsonTimeout(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
      ).then(data=>{
        const priceUsd=Number(data?.solana?.usd);
        if(!(priceUsd>0))throw new Error('CoinGecko returned no SOL/USD price');
        return {priceUsd,source:'coingecko'};
      })
    ]);

    mfSolUsdCache={
      priceUsd:result.priceUsd,
      updatedAt:Date.now(),
      source:result.source
    };

    return {...mfSolUsdCache,stale:false};
  }catch(error){
    // Last known valid quote is safer than blocking Trading Terminal.
    if(Number(mfSolUsdCache.priceUsd)>0){
      return {...mfSolUsdCache,stale:true};
    }

    throw new Error('SOL/USD providers temporarily unavailable');
  }
}

async function handler(req,res){const url=new URL(req.url,'http://x');
 if(url.pathname==='/api/billing/webhook'&&req.method==='POST'){const raw=await rawBody(req);try{billing.verify(raw,req.headers['stripe-signature']);const result=billing.processEvent(JSON.parse(raw));return json(res,200,{received:true,...result})}catch(e){return json(res,e.code==='BAD_SIGNATURE'?400:500,{error:e.code||'WEBHOOK_ERROR',message:e.message})}}
 // Health check — no session or store needed; must respond immediately
 if(url.pathname==='/api/healthz'||url.pathname==='/api/health')return json(res,200,{ok:true,server:'online',version:'1.0.1-clean',timestamp:new Date().toISOString()});
 // Static files — served before session creation to avoid blocking store.save() on new users
 if(url.pathname==='/api/market/sol-usd'&&req.method==='GET'){
   try{
     const quote=await mfGetSolUsd();
     return json(res,200,{
       priceUsd:quote.priceUsd,
       updatedAt:quote.updatedAt,
       source:quote.source,
       stale:quote.stale===true
     });
   }catch(error){
     return json(res,503,{
       error:'SOL_USD_UNAVAILABLE',
       message:error.message
     });
   }
 }

 if(req.method==='GET'&&!url.pathname.startsWith('/api/')){
   const p=url.pathname==='/'?'index.html':url.pathname.slice(1);const f=path.resolve(root,p);
   if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){console.log('[STATIC] 404',url.pathname);return json(res,404,{error:'NOT_FOUND'})}
    const _stt=url.pathname==='/'?Date.now():0;if(_stt)res.on('finish',()=>console.log('[STATIC] GET / '+res.statusCode+' in '+(Date.now()-_stt)+'ms'));
   const ext=path.extname(f).toLowerCase();
   const MIME={'':' text/plain','html':'text/html; charset=utf-8','htm':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','mjs':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','json':'application/json; charset=utf-8','svg':'image/svg+xml','ico':'image/x-icon','png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','webp':'image/webp','woff':'font/woff','woff2':'font/woff2','ttf':'font/ttf'};
   const mime=MIME[ext.slice(1)]||'application/octet-stream';
   const isText=mime.startsWith('text/')||mime.includes('javascript')||mime.includes('json')||mime.includes('svg');
   const isHTML=ext==='.html'||ext==='.htm';
   res.setHeader('content-type',mime);res.setHeader('cache-control',isHTML?'no-store, no-cache, must-revalidate':'public, max-age=3600, stale-while-revalidate=86400');
   if(isHTML){res.setHeader('pragma','no-cache');res.setHeader('expires','0')}
   const ae=req.headers['accept-encoding']||'',stat=fs.statSync(f);
   if(!isHTML&&isText&&stat.size>512){
     if(ae.includes('br')){res.setHeader('content-encoding','br');res.setHeader('vary','Accept-Encoding');fs.createReadStream(f).pipe(zlib.createBrotliCompress({params:{[zlib.constants.BROTLI_PARAM_QUALITY]:4}})).pipe(res);}
     else if(ae.includes('gzip')){res.setHeader('content-encoding','gzip');res.setHeader('vary','Accept-Encoding');fs.createReadStream(f).pipe(zlib.createGzip({level:6})).pipe(res);}
     else{fs.createReadStream(f).pipe(res);}
   }else{fs.createReadStream(f).pipe(res);}
   return;
 }
 const u=user(req,res);if(u){store.touchUser(u.id);if(OWNER_USER_IDS.has(u.id)&&!u.isOwner)store.grantOwner(u.id,'owner_user_ids');}

 /* MEMEFLOW_NATIVE_AI_V46_ROUTES_BEGIN */
 if(url.pathname==='/api/openai/status'&&req.method==='GET')return json(res,200,{ok:true,configured:Boolean(process.env.OPENAI_API_KEY),model:OPENAI_MODEL,mode:'read-only'});
 if(url.pathname==='/api/openai/analyze'&&req.method==='POST'){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   try{
     const b=await body(req),ctx=b.context||{},c=ctx.candidate||{};
     const prompt=`Analyze the current MEMEFLOW candidate ${c.symbol||c.name||c.mint||''}. Explain the decision, strongest evidence, blockers, concentration/holder risk, buy pressure and the next safe action.`;
     const out=await callMemeflowOpenAI(prompt,ctx,'analyze');
     return json(res,200,{ok:true,...out});
   }catch(e){return json(res,e.status||500,{error:'OPENAI_ERROR',message:e.message})}
 }
 if(url.pathname==='/api/openai/ask'&&req.method==='POST'){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   try{
     const b=await body(req),prompt=String(b.prompt||'').trim();
     if(!prompt)return json(res,400,{error:'PROMPT_REQUIRED',message:'Prompt is required.'});
     const out=await callMemeflowOpenAI(prompt,b.context||{},'ask');
     return json(res,200,{ok:true,...out});
   }catch(e){return json(res,e.status||500,{error:'OPENAI_ERROR',message:e.message})}
 }
 /* MEMEFLOW_NATIVE_AI_V46_ROUTES_END */

 if(url.pathname==='/api/health')return json(res,200,{ok:true,server:'online',version:'1.0.1-clean',timestamp:new Date().toISOString()});
 if(url.pathname==='/api/market/status')return json(res,200,{ok:true,backend:'online',database:'online',rpc:rpc.last.ok?'online':(rpcUrls.length?'temporarily_unavailable':'not_configured'),discovery:discovery.connected?'online':(wsUrls.length?'connecting':'not_configured'),decisionEngine:'online',billing:billing.configured?'configured':'not_configured',updatedAt:new Date().toISOString()});/* MEMEFLOW_HEALTH_SECURITY_FIX_V1 */
if(url.pathname==='/api/system/health'){
  // Do not make extra RPC probe calls here: polling the health panel
  // must never increase RPC pressure or create additional 429 responses.
  const now=Date.now();
  const rpcConfigured=rpcUrls.length>0;
  const wsConfigured=wsUrls.length>0;
  const httpOk=rpc.metrics.lastHttpStatus===200||rpc.last.ok===true;
  const wsLive=discovery.connected===true;
  const eventFresh=Boolean(discovery.lastEventAt&&now-discovery.lastEventAt<120000);
  const rateLimited=Boolean(
    discMetrics.rpcCircuitOpen ||
    (enrichDiag.lastEnrichErrorAt&&now-enrichDiag.lastEnrichErrorAt<60000&&/rate limit/i.test(enrichDiag.lastEnrichError||''))
  );
  const primaryOk=rpcConfigured&&httpOk;
  const operational=primaryOk&&wsLive;
  const overall=!rpcConfigured||!wsConfigured||!operational
    ? 'unavailable'
    : rateLimited||!eventFresh
      ? 'degraded'
      : 'healthy';
  const hostname=rpc.activeHostname||null;
  const primary={
    role:'primary',
    ok:primaryOk,
    hostname,
    latencyMs:Number.isFinite(rpc.last.latency)?rpc.last.latency:null,
    lastHttpStatus:rpc.metrics.lastHttpStatus||null,
    error:primaryOk?null:(rpc.last.error||(!rpcConfigured?'Not configured':'Temporarily unavailable'))
  };
  const backups=rpcUrls.slice(1).map((raw,i)=>{
    let host=null;try{host=new URL(raw).hostname}catch{}
    return {role:'backup',ok:false,hostname:host,index:i+1,status:'standby'};
  });
  return json(res,200,{
    status:overall,
    checkedAt:new Date().toISOString(),
    solana:{
      ok:primaryOk,
      discoveryConnected:wsLive,
      commitment:process.env.SOLANA_COMMITMENT||'confirmed',
      connected:wsLive,
      lastEventAt:discovery.lastEventAt,
      circuitOpen:Boolean(discMetrics.rpcCircuitOpen),
      circuitOpenUntil:discMetrics.rpcCircuitOpenUntil||null,
      httpStatus:rpc.metrics.lastHttpStatus||null,
      hostname,
      nodes:[primary,...backups]
    },
    components:{
      pumpListener:{
        status:wsLive?(eventFresh?'healthy':'degraded'):'unavailable',
        source:wsLive?(hostname||'Solana WebSocket'):(wsConfigured?'Connecting':'Not configured'),
        lastEventAt:discovery.lastEventAt
      },
      pumpSwapListener:{
        status:primaryOk?(rateLimited?'degraded':'healthy'):'unavailable',
        source:hostname||'Solana RPC'
      },
      marketIndexer:{
        status:primaryOk?(rateLimited?'degraded':'healthy'):'unavailable',
        activeStreams:[...streams.values()].reduce((n,s)=>n+s.size,0),
        scanned:store.state.metrics.scanned
      },
      candleBuilder:{
        status:primaryOk?'healthy':'unavailable'
      },
      decisionEngine:{
        status:'healthy',
        decisionsInMemory:Object.values(store._uidDec).reduce((s,m)=>s+m.size,0),
    bridgeMetrics:bridgeMetrics
      }
    },
    protectionActive:overall!=='healthy',
    rateLimits:{
      circuitOpen:Boolean(discMetrics.rpcCircuitOpen),
      http429:rpc.metrics.http429,
      holderRateLimited:holderMetrics.holderRateLimited,
      lastEnrichError:/rate limit/i.test(enrichDiag.lastEnrichError||'')?'rate limited':null
    }
  });
}
 if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
 if(url.pathname.startsWith('/api/openai/')){
   const aiRoute=await openaiAI.route({req,url,user:u,readBody:async()=>body(req)});
   if(aiRoute)return json(res,aiRoute.status,aiRoute.body);
 }

 
 if(url.pathname==='/api/manual/analyze'&&req.method==='POST'){
   try{
     const b=await body(req);
     const mint=String(b?.mint||'').trim();

     if(!validPubkey(mint)){
       return json(res,400,{
         error:'INVALID_MINT',
         message:'Enter a valid Solana mint address.'
       });
     }

     const result=await manualAnalyze({
       mint,
       rpc,
       existing:store.state.tokens[mint]||{},
       settings:store.settings(u.id),
       evaluate
     });

     return json(res,200,result);
   }catch(e){
     return json(res,500,{
       error:'MANUAL_ANALYSIS_FAILED',
       message:e?.message||'Manual analysis failed'
     });
   }
 }

 
 if(url.pathname==='/api/ai/chat'&&req.method==='POST'){
   try{
     const b=await body(req);

     const message=String(b?.message||'').trim();

     if(!message){
       return json(res,400,{
         error:'EMPTY_MESSAGE'
       });
     }

     const mint=String(b?.mint||'').trim();

     const candidate=
       (mint && store.state.tokens[mint])
         ? store.state.tokens[mint]
         : {};

     const result=await askMemeflowAssistant({
       message,
       candidate,
       settings:store.settings(u.id),
       recentMessages:Array.isArray(b?.messages)
         ? b.messages
         : []
     });

     return json(res,200,{
       ok:true,
       ...result
     });

   }catch(e){
     return json(res,500,{
       error:'AI_CHAT_FAILED',
       message:e?.message||'AI Assistant failed'
     });
   }
 }

 
if(false && url.pathname==='/api/ai/assistant' &&req.method==='POST'){
  try{
    const payload=await readAssistantBody(req);
    const result=await askMemeflowAssistant(payload);

    return json(
      res,
      result.ok ? 200 :
      result.code==='EMPTY_MESSAGE' ? 400 :
      result.code==='OPENAI_QUOTA' ? 503 : 500,
      result
    );
  }catch(e){
    return json(res,400,{
      ok:false,
      code:'AI_ASSISTANT_REQUEST_ERROR',
      message:String(e?.message||'Invalid request').slice(0,300)
    });
  }
}



/* MEMEFLOW_AI_STANDALONE_V49_ROUTE_BEGIN */
 if(url.pathname==='/api/ai/standalone-scan'&&req.method==='POST'){
  try{
   const b=await body(req);
   const scan=await mf49StandaloneScan(b.input,u);
   return json(res,200,{ok:true,scan})
  }catch(e){
   return json(res,e.status||500,{error:e.code||'STANDALONE_SCAN_ERROR',message:e.message||'Token scan failed.'})
  }
 }
 /* MEMEFLOW_AI_STANDALONE_V49_ROUTE_END */

  // MEMEFLOW_LIVE_TOKEN_STATES_V7
 if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){
  const _lim=Math.min(200,Math.max(1,Number(url.searchParams.get('limit')||200)));
  const _settings=store.settings(u.id);
  const _rawTokens=__mfLiveScannerTokens();
  const _admittedAll=_rawTokens.filter(
    _token=>
      __mfEntryAdmissionForUser(_token,u.id,_settings)?.admitted===true
  );
  const _tokens=_admittedAll.slice(0,_lim);
  let _recovered=0,_reindexed=0,_evalErrors=0,_viewErrors=0;
  let _index=store._uidDec[u.id]||null;

  for(const _token of _tokens){
    const _mint=String(_token?.mint||'').trim();
    if(!_mint)continue;

    const _key=u.id+':'+_mint;
    const _existing=store.state.decisions?.[_key]||null;

    if(_existing){
      if(!_index?.has(_key)){
        try{
          store.setDecision(u.id,_mint,_existing);
          _index=store._uidDec[u.id]||_index;
          _reindexed++;
        }catch(_error){
          _evalErrors++;
        }
      }
      continue;
    }

    try{
      const _decision=evaluate(_token,_settings);
      store.setDecision(u.id,_mint,{..._decision,primaryReason:_decision.primaryReason});
      _index=store._uidDec[u.id]||_index;
      _recovered++;
    }catch(_error){
      _evalErrors++;
    }
  }

  const _mintSet=new Set(_tokens.map(_token=>String(_token?.mint||'')).filter(Boolean));
  const _all=store.decisions(u.id).filter(_decision=>_mintSet.has(String(_decision?.mint||'')));
  const _selected=candidateFeed(_all,'all');
  const _counts=candidateVisibilityCounts(_all);
  const _stateCounts={};

  for(const _decision of _selected){
    const _state=String(_decision?.state||'WAITING').trim().toUpperCase()||'WAITING';
    _stateCounts[_state]=(_stateCounts[_state]||0)+1;
  }

  const _unrankedViews=[];
  for(const _decision of _selected){
    try{
      _unrankedViews.push(candidateView(_decision));
    }catch(_error){
      _viewErrors++;
    }
  }
  // MEMEFLOW_FEED_RELEVANCE_RANKING_V1
  // State priority is strict. Relevance only reorders cards inside a state.
  const _rankedViews=rankCandidateViews(_unrankedViews);
  const _views=_rankedViews.slice(0,_lim);

  return json(res,200,{
    decisions:_views,
    total:_rankedViews.length,
    limit:_lim,
    source:'system-live-token-states-v7',
    persistedTokens:_tokens.length,
    rawScannerTokens:_rawTokens.length,
    preAdmissionAdmitted:_admittedAll.length,
    preAdmissionHidden:Math.max(0,_rawTokens.length-_admittedAll.length),
    recovered:_recovered,
    reindexed:_reindexed,
    evaluationErrors:_evalErrors,
    viewErrors:_viewErrors,
    stateCounts:_stateCounts,
    counts:_counts
  });
 }
if(url.pathname==='/api/ai/decisions'){
  const _lim=Math.min(200,Math.max(1,Number(url.searchParams.get('limit')||50)));
  const _off=Math.max(0,Number(url.searchParams.get('offset')||0));
  const _scope=String(url.searchParams.get('scope')||'candidates').toLowerCase();
  // MEMEFLOW_FRESH_SESSION_SCANNER_V1
  // Never rebuild the live candidate feed from persisted pre-restart tokens.
  if(!store._uidDec[u.id]?.size){
    const _fresh=__mfAdmittedScannerTokensForUser(u.id)
      .slice(0,DECISION_RECOVERY_TOKEN_LIMIT);
    const _settings=store.settings(u.id);
    for(const _token of _fresh){
      try{
        const _decision=evaluate(_token,_settings);
        store.setDecision(u.id,_token.mint,{..._decision,primaryReason:_decision.primaryReason});
      }catch{}
    }
  }
  const _liveMintSet=new Set(
    __mfAdmittedScannerTokensForUser(u.id)
      .map(t=>String(t?.mint||''))
  );
  const _raw=store.decisions(u.id).filter(d=>_liveMintSet.has(String(d?.mint||'')));
  const _all=_raw;
  const _selected=candidateFeed(_all,_scope);
  const _counts=candidateVisibilityCounts(_all);
  // MEMEFLOW_FEED_RELEVANCE_RANKING_V1
  const _rankedViews=rankCandidateViews(_selected.map(candidateView));
  return json(res,200,{
    decisions:_rankedViews.slice(_off,_off+_lim),
    total:_rankedViews.length,
    limit:_lim,
    offset:_off,
    scope:_scope,
    counts:_counts
  });
}
 if(url.pathname==='/api/debug/filter-pipeline'){
    const rows=store.tokens().slice(0,50);
    const decisions=store.decisions(u.id);
    const pumpTagged=rows.filter(t=>String(t.launchPlatform||t.protocol||'').toLowerCase()==='pump').length;
    const byState={};for(const d of decisions.slice(0,200))byState[d.state]=(byState[d.state]||0)+1;
    return json(res,200,{
      settingsVersion:store.user(u.id)?.settingsVersion||store.user(u.id)?.updatedAt||null,
      settings:{minLiquidityUsd:store.settings(u.id).minLiquidityUsd,minHolders:store.settings(u.id).minHolders,launchPlatforms:store.settings(u.id).launchPlatforms},
      recentTokens:rows.length,
      recentPumpTagged:pumpTagged,
      decisionStates:byState,
      sample:rows.slice(0,10).map(t=>({mint:t.mint,launchPlatform:t.launchPlatform||null,protocol:t.protocol||null,source:t.source||null}))
    });
  }
 if(url.pathname==='/api/debug/token-lifecycle'){
    const mint=String(url.searchParams.get('mint')||'').trim();
    if(!mint)return json(res,400,{error:'MINT_REQUIRED',usage:'/api/debug/token-lifecycle?mint=<token-mint>'});
    const token=store.state.tokens[mint]||null;
    const now=Date.now();
    const decision=
      store?._uidDec?.[u.id]?.get?.(mint) ??
      store?.state?.decisions?.[u.id]?.[mint] ??
      null;
    const holder=holderQueue.inspect?.(mint)||null;
      const queuedAt=Number(holder?.queuedAt||0);
      const nextDueAt=Number(holder?.nextDueAt||0);
      const holderStallReason=
        holder?.pending&&!holder?.active&&Number(holder?.attempts||0)===0&&
        nextDueAt>0&&nextDueAt<=now&&queuedAt>0&&now-queuedAt>10000
          ?'READY_BUT_NOT_STARTED_10S'
          :null;
    const price=priceLifecycleDiag.get(mint)||null;
    return json(res,200,{
      diagnosticVersion:'V10.1-fast',
      mint,
      found:Boolean(token),
      now,
      token:token?{
        ageMinutes:(()=>{const t=Number(token.discoveredAt||token.createdAt||0);return t>0?Math.max(0,(now-t)/60000):null})(),
        launchPlatform:token.launchPlatform||null,
        protocol:token.protocol||null,
        source:token.source||null,
        discoveredAt:token.discoveredAt||null,
        lastScannedAt:token.lastScannedAt||null,
        holderFresh:Boolean(token.holderFresh),
        holderCount:token.holderCount??null,
        top10Pct:token.top10Pct??null,
        developerPct:token.developerPct??token.developerSharePct??null,
        holderScannedAt:token.holderScannedAt||null,
        priceSol:token.priceSol??null,
        liquiditySol:token.liquiditySol??null,
        buyPressure:token.buyPressure??token.momentum??null,
        lastPriceAt:token.lastPriceAt||null,
        lastPriceChangeAt:token.lastPriceChangeAt||null,
        lastMarketActivityAt:token.lastMarketActivityAt||null,
        scanError:token.scanError||null,
        pipelineGateState:token.pipelineGateState||null,
        pipelineGateRetryable:token.pipelineGateRetryable??null,
        pipelineGateRecheckAt:token.pipelineGateRecheckAt||null,
        pipelineGateReasons:Array.isArray(token.pipelineGateReasons)?token.pipelineGateReasons:[]
      }:null,
      holderQueue:holder,
        holderStallReason,
      pricePolling:price?{
        ...price,
        lastSnapshotAgeMs:price.lastSnapshotAt?now-price.lastSnapshotAt:null,
        lastPollAgeMs:price.lastPollAt?now-price.lastPollAt:null
      }:null,
      decision:decision?{
        state:decision.state,
        score:decision.score,
        confidence:decision.confidence??null,
        primaryReason:decision.primaryReason||null,
        reasons:decision.reasons||[],
        settingsVersion:decision.settingsVersion??null,
        reevaluatedAt:decision.reevaluatedAt??null
      }:null,
      effectiveSettings:{
        minHolders:store.settings(u.id).minHolders,
        maxTop10Pct:store.settings(u.id).maxTop10Pct,
        maxDeveloperPct:store.settings(u.id).maxDeveloperPct,
        minBuyPressure:store.settings(u.id).minBuyPressure,
        minLiquidityUsd:store.settings(u.id).minLiquidityUsd,
        minMarketCapUsd:store.settings(u.id).minMarketCapUsd,
        launchPlatforms:store.settings(u.id).launchPlatforms
      }
    });
  }
 if(url.pathname==='/api/debug/filter-pipeline-lifecycle'){
    const now=Date.now();
    const limit=Math.max(1,Math.min(25,Number(url.searchParams.get('limit')||10)));

    const allTokens=Object.values(store?.state?.tokens||{});
    let pumpTokens=allTokens
      .filter(t=>{
        const lp=String(t?.launchPlatform||t?.protocol||'').toLowerCase();
        const mint=String(t?.mint||t?.tokenMint||t?.tokenAddress||'');
        return lp==='pump'||mint.toLowerCase().endsWith('pump');
      })
      .sort((a,b)=>Number(b?.discoveredAt||b?.createdAt||0)-Number(a?.discoveredAt||a?.createdAt||0));
    pumpTokens=pumpTokens.slice(0,limit);

    const settings=store.settings(u.id);

    const sample=pumpTokens.map(token=>{
      const mint=String(token?.mint||token?.tokenMint||token?.tokenAddress||'');
      const holder=holderQueue.inspect?.(mint)||null;
      const price=priceLifecycleDiag.get(mint)||null;
      const decision=store?.state?.decisions?.[u.id+':'+mint]??null;
      const discovered=Number(token?.discoveredAt||token?.createdAt||0);
      return {
        mint,
        ageMinutes:discovered>0?Math.max(0,(now-discovered)/60000):null,
        schedulerLane:
          discovered>0 && now-discovered<=FRESH_PRIORITY_MAX_AGE_MS
            ?'fresh-priority'
            :'recovery',
        slaState:
          discovered<=0 ? 'unknown' :
          bridgePipelineStarted(token) ? 'started' :
          (now-discovered)>FRESH_SLA_MS ? 'missed' :
          (now-discovered)>=FRESH_SLA_ESCALATE_MS ? 'urgent' :
          'pending',
        pipelineStarted:bridgePipelineStarted(token),
        fastPhaseReady:Boolean(
          (holderQueue.inspect?.(mint)||null)?.pending ||
          (holderQueue.inspect?.(mint)||null)?.active ||
          Number((holderQueue.inspect?.(mint)||null)?.attempts||0)>0 ||
          priceTimers.has(mint)
        ),
        launchPlatform:token?.launchPlatform||null,
        protocol:token?.protocol||null,
        source:token?.source||null,
        holder:{
          fresh:Boolean(token?.holderFresh),
          count:token?.holderCount??token?.holders??null,
          top10Pct:token?.top10Pct??token?.top10??null,
          developerPct:token?.developerPct??token?.developerSharePct??token?.developer??null,
          scannedAt:token?.holderScannedAt||null
        },
        holderQueue:holder,
        pricePolling:price?{
          ...price,
          lastSnapshotAgeMs:price.lastSnapshotAt?now-price.lastSnapshotAt:null,
          lastPollAgeMs:price.lastPollAt?now-price.lastPollAt:null
        }:null,
        market:{
          priceSol:token?.priceSol??token?.price??null,
          liquiditySol:token?.liquiditySol??token?.liquidity??null,
          buyPressure:token?.buyPressure??token?.momentum??null,
          lastPriceAt:token?.lastPriceAt||null,
          scanError:token?.scanError||null
        },
        decision:decision?{
          state:decision.state??null,
          score:decision.score??null,
          confidence:decision.confidence??null,
          primaryReason:decision.primaryReason||null,
          reasons:decision.reasons||[],
          settingsVersion:decision.settingsVersion??null,
          reevaluatedAt:decision.reevaluatedAt??null
        }:null
      };
    });

    return json(res,200,{
      diagnosticVersion:'V10.2-same-instance',
      v12_26:{
        version:'V12.26',
        diagnosticsOnly:true,
        tradingLogicChanged:false,
        eventReevaluationAlreadyPresent:true,
        note:'Captures evaluateAI call/result lifecycle from the existing V12.22 holder+market event re-evaluation hot path.'
      },
      v12_25:{
        version:'V12.25.1',
        diagnosticsOnly:true,
        tradingLogicChanged:false,
        note:'Gate sample diagnostics only; evaluator and execution paths are unchanged.'
      },
      evaluationLifecycleDiagnostics:sample.map((row)=>{
        const d=row?.decision||null;
        const h=row?.holder||{};
        const m=row?.market||{};
        return {
          mint:row?.mint??null,
          ageMinutes:row?.ageMinutes??null,
          holderFresh:h.fresh===true,
          holderKnown:h.count!=null,
          marketKnown:(m.priceSol!=null||m.buyPressure!=null||m.liquiditySol!=null),
          decisionAttached:!!d,
          decisionState:d?.state??null,
          decisionReason:d?.primaryReason??(Array.isArray(d?.reasons)&&d.reasons.length?d.reasons[0]:null),
          settingsVersion:d?.settingsVersion??null,
          reevaluatedAt:d?.reevaluatedAt??null,
            decisionReasons:Array.isArray(d?.reasons)?d.reasons:[],
        };
      }),
      gateSampleDiagnostics:sample.map((row)=>{
        const holder=row?.holder||{};
        const market=row?.market||{};
        const decision=row?.decision||null;
        const holdersValue=holder.count??null;
        const top10Value=holder.top10Pct??null;
        const developerValue=holder.developerPct??null;
        const buyPressureValue=market.buyPressure??null;
        const holdersPass=holdersValue!=null?holdersValue>=settings.minHolders:null;
        const top10Pass=top10Value!=null?top10Value<=settings.maxTop10Pct:null;
        const developerPass=developerValue!=null?developerValue<=settings.maxDeveloperPct:null;
        const buyPressurePass=buyPressureValue!=null?buyPressureValue>=settings.minBuyPressure:null;
        const failed=[];
        if(holdersPass===false)failed.push('MIN_HOLDERS');
        if(top10Pass===false)failed.push('MAX_TOP10');
        if(developerPass===false)failed.push('MAX_DEVELOPER');
        if(buyPressurePass===false)failed.push('MIN_BUY_PRESSURE');
        return {
          mint:row?.mint??null,
          ageMinutes:row?.ageMinutes??null,
          gates:{
            holders:{value:holdersValue,threshold:settings.minHolders,operator:'>=',pass:holdersPass},
            top10Pct:{value:top10Value,threshold:settings.maxTop10Pct,operator:'<=',pass:top10Pass},
            developerPct:{value:developerValue,threshold:settings.maxDeveloperPct,operator:'<=',pass:developerPass},
            buyPressure:{value:buyPressureValue,threshold:settings.minBuyPressure,operator:'>=',pass:buyPressurePass}
          },
          failedGates:failed,
          decisionState:decision?.state??null,
          decisionReason:decision?.primaryReason??(Array.isArray(decision?.reasons)&&decision.reasons.length?decision.reasons[0]:null)
        };
      }),
      v12_24:{
        version:'V12.24',
        creatorLinkGuaranteed:true,
        legacyRepairSkipsEventHolder:true
      },
      v12_23:{
        version:'V12.23',
        freshEventOnlyMs:__V12_23_FRESH_EVENT_ONLY_MS,
        legacyHolderRpcForFreshPump:false
      },
      liveTradeFeed:__pumpLiveTradeFeed?.metrics?.()||null,eventHolderLedger:eventHolderLedger.diagnostics(),eventMarketLedger:eventMarketLedger.diagnostics(),
      now,
      bridge:bridgeMetrics,fastPhase:fastPhaseMetrics,
      instance:{
        pid:process.pid,
        hostname:process.env.REPL_SLUG||process.env.HOSTNAME||'unknown'
      },
      counts:{
        tokensInThisInstance:allTokens.length,
        pumpTokensInThisInstance:pumpTokens.length,
        returned:sample.length
      },
      effectiveSettings:{
        minHolders:settings.minHolders,
        maxTop10Pct:settings.maxTop10Pct,
        maxDeveloperPct:settings.maxDeveloperPct,
        minBuyPressure:settings.minBuyPressure,
        minLiquidityUsd:settings.minLiquidityUsd,
        minMarketCapUsd:settings.minMarketCapUsd,
        launchPlatforms:settings.launchPlatforms
      },
      sample
    });
  }
 if(url.pathname==='/api/copy-trading/status'&&req.method==='GET')return json(res,200,copyTrading.status(u.id));
 if(url.pathname==='/api/settings'&&req.method==='GET'){const settings=store.settings(u.id);return json(res,200,{settings,version:u.settingsVersion||1,killSwitchActive:u.killSwitch,capabilities:{liveAutomation:hasLiveEntitlement(u),paperAutomation:true,discoveryPlatforms:['pump'],adaptiveProfile:false},profilePresets:PROFILE_PRESETS})}
 if(url.pathname==='/api/settings/audit'&&req.method==='GET')return json(res,200,{history:store.settingsHistory(u.id,Number(url.searchParams.get('limit')||100))});
 if(url.pathname==='/api/settings'&&req.method==='PUT'){const b=await body(req);const checked=validateSettings(b.settings||{});if(!checked.ok)return json(res,400,{error:'INVALID_SETTINGS',message:checked.errors.join(' '),errors:checked.errors});if(checked.settings.tradingEnvironment==='live'&&!hasLiveEntitlement(u))return json(res,403,{error:'LIVE_ENTITLEMENT_REQUIRED',message:'LIVE trading environment requires an active Pro subscription or owner entitlement.'});if(b.version!=null&&Number(b.version)!==Number(u.settingsVersion||1))return json(res,409,{error:'SETTINGS_VERSION_CONFLICT',message:'Settings changed on the server. Reload before saving again.',version:u.settingsVersion||1});const before=JSON.parse(JSON.stringify(store.settings(u.id)));const shadow=checked.settings.shadowValidation?shadowValidateSettings(checked.settings,50):null;if(shadow?.errors?.length)return json(res,400,{error:'SHADOW_VALIDATION_FAILED',message:'Proposed settings could not be evaluated safely.',shadowValidation:shadow});const saved=store.setSettings(u.id,checked.settings);if(saved.changeLog!==false)store.recordSettingsChange(u.id,before,saved,{actor:u.id,source:'settings_put'});const decisionsReevaluated=reevaluateUser(u.id);return json(res,200,{settings:saved,version:u.settingsVersion,decisionsReevaluated,shadowValidation:shadow})}
 if(url.pathname==='/api/settings/defaults'&&req.method==='POST'){const before=JSON.parse(JSON.stringify(store.settings(u.id)));const saved=store.setSettings(u.id,defaults());if(saved.changeLog!==false)store.recordSettingsChange(u.id,before,saved,{actor:u.id,source:'restore_defaults'});const decisionsReevaluated=reevaluateUser(u.id);return json(res,200,{settings:saved,version:u.settingsVersion,decisionsReevaluated})}
 if(url.pathname==='/api/settings/kill-switch'&&req.method==='POST'){u.killSwitch=true;store.save();return json(res,200,{active:true})}
 if(url.pathname==='/api/owner/status')return json(res,200,{isOwner:Boolean(u.isOwner),entitlementSource:u.isOwner?'owner':'none'});
 if(url.pathname==='/api/owner/claim'&&req.method==='POST'){console.log('[OWNER_CLAIM_ROUTE_HIT] method=POST content-type='+req.headers['content-type']);if(!OWNER_ACCESS_KEY){console.log('[OWNER_CLAIM] status=503 reason=not_configured');return json(res,503,{error:'OWNER_ACCESS_NOT_CONFIGURED'});}const b=await body(req);const supplied=String(b.ownerAccessKey||b.accessKey||'').trim();const configured=String(process.env.OWNER_ACCESS_KEY||'').trim();console.log('[OWNER_CLAIM] supplied_len='+supplied.length+' configured_len='+configured.length);if(!supplied){console.log('[OWNER_CLAIM] status=400 reason=missing');return json(res,400,{error:'OWNER_KEY_MISSING'});}const a=Buffer.from(configured),c=Buffer.from(supplied);if(a.length!==c.length||!crypto.timingSafeEqual(a,c)){console.log('[OWNER_CLAIM] status=403 reason=invalid');return json(res,403,{error:'INVALID_OWNER_ACCESS_KEY'});}store.grantOwner(u.id,'owner_access_key');console.log('[OWNER_CLAIM] status=200 uid='+u.id);return json(res,200,{ok:true,code:'OWNER_ACCESS_ACTIVATED',isOwner:true,liveEntitled:true,entitlementSource:'owner'});}
 if(url.pathname==='/api/billing/status')return json(res,200,billingStatus(u));
 if(url.pathname==='/api/billing/checkout'&&req.method==='POST'){if(!billing.configured)return json(res,503,{error:'BILLING_NOT_CONFIGURED',message:'Configure STRIPE_SECRET_KEY, STRIPE_PRICE_ID and STRIPE_WEBHOOK_SECRET.'});try{const session=await billing.createCheckout(u,origin(req));return json(res,200,{url:session.url,id:session.id})}catch(e){return json(res,e.status||502,{error:e.code||'STRIPE_ERROR',message:e.message})}}
 if(url.pathname==='/api/billing/portal'&&req.method==='POST'){if(!billing.configured)return json(res,503,{error:'BILLING_NOT_CONFIGURED'});try{const session=await billing.createPortal(u,origin(req));return json(res,200,{url:session.url})}catch(e){return json(res,e.status||502,{error:e.code||'STRIPE_ERROR',message:e.message})}}
 if(url.pathname==='/api/discovery/status'){
  let wsHostname=null;try{wsHostname=discovery.url?new URL(discovery.url).hostname:null}catch{}
  return json(res,200,{
    connected:discovery.connected,
    url:wsHostname,
    wsHostname,
    lastEventAt:discovery.lastEventAt,
    reconnects:discovery.reconnects,
    error:discovery.error,
    lastError:discovery.lastError,
    startedAt:discovery.startedAt,
    ...discMetrics,...enrichDiag,...holderMetrics,...recoveryMetrics,...liveEvalMetrics,
    liveTradeFeed:__pumpLiveTradeFeed?.metrics?.()||null,
    queueDepth:discMetrics.freshQueueDepth+discMetrics.retryQueueDepth,
    holderQueueDepth:holderQueue.queueDepth,
    holderProcessing:holderQueue.processing,
    holderOldestQueuedAgeMs:holderQueue.oldestAgeMs,
    holderNextDueInMs:holderQueue.nextDueInMs,
    rpcRetries:rpc.metrics.retries,
    rpcTimeouts:rpc.metrics.timeouts,
    rpcHttp429:rpc.metrics.http429,
    rpcNonJsonResponses:rpc.metrics.nonJsonResponses,
    rpcEndpointFailovers:rpc.metrics.endpointFailovers,
    rpcLastHttpStatus:rpc.metrics.lastHttpStatus,
    rpcActiveHostname:rpc.activeHostname,
    processing:discQueue.processing,
    metrics:store.state.metrics,
    tokens:store.tokens().length,
    freshScannerTokens:__mfLiveScannerTokens().length,
    admittedScannerTokensForUser:__mfAdmittedScannerTokensForUser(u.id).length,
    preAdmissionHiddenForUser:Math.max(
      0,
      __mfLiveScannerTokens().length-__mfAdmittedScannerTokensForUser(u.id).length
    ),
    scannerSessionStartedAt:__mfScannerRuntimeStartedAt,
    scannerTokenTtlMs:__mfScannerTokenTtlMs,
    opportunityEngine:opportunityEngine.diagnostics(),
    solUsdOracle:solUsdOracle.diagnostics(),
    users:Object.keys(store.state.users).length,
    decisionsInMemory:Object.values(store._uidDec).reduce((s,m)=>s+m.size,0)
  });
}
 if(url.pathname==='/api/chart/config'){const qualified=rankCandidateViews(candidateFeed(store.decisions(u.id),'candidates').map(candidateView));return json(res,200,{chainId:'solana',tokenAddress:qualified[0]?.mint||''});}
 if(url.pathname==='/api/chart/history'){const mint=url.searchParams.get('tokenAddress'),t=store.state.tokens[mint];const pts=t?.priceSol?[{t:t.updatedAt,price:t.priceSol,source:t.source}]:[];return json(res,200,{points:pts,status:{stale:!pts.length,source:t?.source||null,error:t?.scanError||null},tokenAddress:mint})}
 if(url.pathname==='/api/chart/trade-stream'){
  const mint=String(url.searchParams.get('tokenAddress')||'').trim();

  if(!validPubkey(mint)){
    return json(res,400,{error:'INVALID_TOKEN_ADDRESS'});
  }

  if(!chartTradeStreams.has(mint)){
    chartTradeStreams.set(mint,new Set());
  }
  if(!chartTradeHistory.has(mint)){
    chartTradeHistory.set(mint,[]);
  }

  res.writeHead(200,{
    'content-type':'text/event-stream; charset=utf-8',
    'cache-control':'no-cache, no-store, no-transform',
    'connection':'keep-alive',
    'x-accel-buffering':'no'
  });
  try{res.flushHeaders?.()}catch{}

  res.write('retry: 1000\n');
  res.write(
    `event: snapshot\n`+
    `data: ${JSON.stringify(__mfChartSnapshotPayload(mint))}\n\n`
  );

  const listeners=chartTradeStreams.get(mint);
  listeners.add(res);

  // History sync must never block opening Trading Terminal.
  queueMicrotask(()=>__mfEnsureChartBackfill(mint));

  const heartbeat=setInterval(()=>{
    try{
      res.write(`: chart ${Date.now()}\n\n`);
    }catch{}
  },15000);
  heartbeat.unref?.();

  let closed=false;
  const closeChartTradeStream=()=>{
    if(closed)return;
    closed=true;
    clearInterval(heartbeat);
    listeners.delete(res);
  };

  req.on('close',closeChartTradeStream);
  res.on('close',closeChartTradeStream);
  return
}

 // MEMEFLOW_LIVE_SYSTEM_SSE_BACKEND_V4_ROUTE
 if(url.pathname==='/api/system/stream'&&req.method==='GET'){
  res.writeHead(200,{
   'content-type':'text/event-stream; charset=utf-8',
   'cache-control':'no-cache, no-store, no-transform',
   'connection':'keep-alive',
   'x-accel-buffering':'no'
  });
  try{res.flushHeaders?.()}catch{}
  __systemViewStreamsV31.add(res);

  try{
   res.write(`retry: 1000\nevent: hello\ndata: ${JSON.stringify({type:'hello',seq:__systemViewSeqV31,ts:Date.now()})}\n\n`);
  }catch{}

  const heartbeat=setInterval(()=>{
   try{res.write(`: v31 ${Date.now()}\n\n`)}catch{}
  },15000);
  heartbeat.unref?.();

  let closed=false;
  const closeSystemStream=()=>{
   if(closed)return;
   closed=true;
   clearInterval(heartbeat);
   __systemViewStreamsV31.delete(res);
  };
  req.on('close',closeSystemStream);
  res.on('close',closeSystemStream);
  return;
 }

 if(url.pathname==='/api/chart/stream'){const mint=url.searchParams.get('tokenAddress');res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});res.write(`event: snapshot\ndata: ${JSON.stringify({points:[],status:{stale:true,source:'Solana'}})}\n\n`);if(!streams.has(mint))streams.set(mint,new Set());streams.get(mint).add(res);req.on('close',()=>streams.get(mint)?.delete(res));return}
 if(url.pathname==='/api/live/execute'){if(!hasLiveEntitlement(u))return json(res,402,{error:'LIVE_ENTITLEMENT_REQUIRED',message:'An active MEMEFLOW Pro subscription or verified owner entitlement is required.'});return json(res,423,{error:'LIVE_EXECUTION_NOT_READY',message:u.isOwner?'Owner LIVE entitlement is active, but verified wallet and production execution engine are still required.':'Pro is active, but verified wallet and production execution engine are still required.'});}
 // ── PAPER API routes ──────────────────────────────────────────────────────
 // MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3
 if(url.pathname==='/api/paper/positions'&&req.method==='GET'){
  const _now=Date.now();
  const _cutoff=_now-(5*60*1000);
  const _finite=(value)=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))
    ? Number(value)
    : null;

  const _positions=paper.userPositions(u.id).map((_position)=>{
    if(String(_position?.status||'').toUpperCase()!=='OPEN'||!_position?.mint){
      return _position;
    }

    const _mint=String(_position.mint);
    const _token=store.state.tokens?.[_mint]||{};
    let _points=Array.isArray(chartTradeHistory.get(_mint))
      ? chartTradeHistory.get(_mint).slice()
      : [];

    if(!_points.length){
      try{
        _points=__mfChartArchive.mergePointsSync(_mint,[])||[];
      }catch{
        _points=[];
      }
    }

    _points=_points
      .filter((_point)=>{
        const _t=Number(_point?.t);
        return Number.isFinite(_t)&&_t>0&&_t<=_now+30000;
      })
      .sort((a,b)=>Number(a.t)-Number(b.t));

    const _recent=_points.filter((_point)=>Number(_point.t)>=_cutoff);
    const _latest=_points.length?_points[_points.length-1]:null;
    let _base=null;

    for(let _i=_points.length-1;_i>=0;_i--){
      if(Number(_points[_i]?.t)<=_cutoff){
        _base=_points[_i];
        break;
      }
    }
    if(!_base&&_recent.length){
      _base=_recent[0];
    }

    // MEMEFLOW_OPEN_PNL_LIVE_MARK_V5
    const _pointPrice=(point)=>_finite(point?.priceSol??point?.price);
    const _entryPrice=_finite(_position.entryPriceSol);
    const _openedAt=_finite(_position.openedAtMs);

    const _tradePrice=_pointPrice(_latest);
    const _tradeAt=_finite(_latest?.t);

    const _tokenPrice=_finite(_token.priceSol);
    const _tokenMarkAt=_finite(
      _token.lastPriceAt ??
      _token.marketScannedAt ??
      _token.updatedAt ??
      _token.lastScannedAt
    );

    const _enginePrice=_finite(_position.currentPriceSol);

    let _latestPrice=null;
    let _pnlMarkAt=null;
    let _pnlMarkSource=null;

    const _isPostEntry=(timestamp)=>(
      _openedAt===null ||
      (timestamp!==null && timestamp>=_openedAt)
    );

    // Prefer a real Pump trade mark when it exists after the position opened.
    if(
      _tradePrice!==null &&
      _tradePrice>0 &&
      _isPostEntry(_tradeAt)
    ){
      _latestPrice=_tradePrice;
      _pnlMarkAt=_tradeAt;
      _pnlMarkSource='pump-trade-event';
    }
    // Otherwise use token telemetry only when it is known to be post-entry,
    // or when the price itself proves it is not the untouched entry placeholder.
    else if(
      _tokenPrice!==null &&
      _tokenPrice>0 &&
      (
        _isPostEntry(_tokenMarkAt) ||
        (
          _entryPrice!==null &&
          Math.abs(_tokenPrice-_entryPrice) >
            Math.max(1e-18,Math.abs(_entryPrice)*1e-12)
        )
      )
    ){
      _latestPrice=_tokenPrice;
      _pnlMarkAt=_tokenMarkAt;
      _pnlMarkSource='token-market';
    }
    // Engine currentPriceSol has no timestamp. It is trustworthy for display
    // only after it differs from entry; equality may simply be initialization.
    else if(
      _enginePrice!==null &&
      _enginePrice>0 &&
      _entryPrice!==null &&
      Math.abs(_enginePrice-_entryPrice) >
        Math.max(1e-18,Math.abs(_entryPrice)*1e-12)
    ){
      _latestPrice=_enginePrice;
      _pnlMarkAt=null;
      _pnlMarkSource='paper-engine-mark';
    }

    const _basePrice=_pointPrice(_base);

    const _initialSize=_finite(_position.initialSizeSol);
    const _remainingQty=_finite(_position.remainingTokenQuantity);
    const _realizedPnl=_finite(_position.realizedPnlSol)??0;

    const _pnlReady=Boolean(
      _latestPrice!==null &&
      _latestPrice>0 &&
      _entryPrice!==null &&
      _entryPrice>0 &&
      _initialSize!==null &&
      _initialSize>0 &&
      _remainingQty!==null &&
      _remainingQty>=0
    );

    const _liveUnrealizedPnlSol=
      _pnlReady
        ? _remainingQty*(_latestPrice-_entryPrice)
        : null;

    const _livePnlPct=
      _pnlReady
        ? (
            (_realizedPnl+_liveUnrealizedPnlSol) /
            _initialSize
          )*100
        : null;

    const _volume5mSol=_recent.reduce(
      (sum,_point)=>sum+Math.abs(_finite(_point?.solAmount)??0),
      0
    );

    const _transactions5m=_recent.length;

    let _priceChange5mPct=null;
    if(
      _recent.length &&
      _latestPrice!==null &&
      _latestPrice>0 &&
      _basePrice!==null &&
      _basePrice>0
    ){
      _priceChange5mPct=((_latestPrice/_basePrice)-1)*100;
    }

    const _supply=_finite(_token.totalSupply);
    const _storedMcSol=_finite(_token.marketCapSol??_token.marketCap);
    const _marketCapSol=
      _latestPrice!==null&&_latestPrice>0&&_supply!==null&&_supply>0
        ? _latestPrice*_supply
        : _storedMcSol;

    const _marketCapUsd=_finite(_token.marketCapUsd);
    const _impliedSolUsd=
      _marketCapUsd!==null&&
      _marketCapUsd>0&&
      _marketCapSol!==null&&
      _marketCapSol>0
        ? _marketCapUsd/_marketCapSol
        : null;

    const _volume5mUsd=
      _impliedSolUsd!==null
        ? _volume5mSol*_impliedSolUsd
        : null;

    let _ageMinutes=null;
    try{
      _ageMinutes=tokenAgeMinutes(_token);
      if(!Number.isFinite(Number(_ageMinutes)))_ageMinutes=null;
      else _ageMinutes=Number(_ageMinutes);
    }catch{
      _ageMinutes=null;
    }

    return {
      ..._position,
      tokenMetrics:{
        ageMinutes:_ageMinutes,
        holderCount:_finite(_token.holderCount),
        volume5mSol:_volume5mSol,
        volume5mUsd:_volume5mUsd,
        transactions5m:_transactions5m,
        marketCapSol:_marketCapSol,
        marketCapUsd:_marketCapUsd,
        priceChange5mPct:_priceChange5mPct,
        pnlReady:_pnlReady,
        pnlPct:_livePnlPct,
        pnlUnrealizedSol:_liveUnrealizedPnlSol,
        pnlMarkPriceSol:_latestPrice,
        pnlMarkAt:_pnlMarkAt,
        pnlMarkSource:_pnlMarkSource,
        windowMinutes:5,
        source:'pump-trade-history'
      }
    };
  });

  return json(res,200,{positions:_positions});
 }
 if(url.pathname==='/api/paper/trades'&&req.method==='GET')return json(res,200,{trades:paper.userTrades(u.id)});
 if(url.pathname==='/api/paper/proposals'&&req.method==='GET')return json(res,200,{proposals:paper.userProposals(u.id)});
 if(url.pathname==='/api/paper/readiness'&&req.method==='GET'){
  const mint=String(url.searchParams.get('mint')||'').trim();
  if(!mint)return json(res,400,{error:'MINT_REQUIRED'});

  const token=store.state.tokens?.[mint]||null;
  if(!token)return json(res,404,{error:'TOKEN_NOT_FOUND'});

  const settings=store.settings(u.id);
  const readiness=paper.entryReadiness(u.id,token,settings);

  return json(res,200,{
    environment:paper.environment(settings),
    operatingMode:paper.mode(settings),
    mint,
    ok:readiness.ok,
    checks:readiness.checks,
    metrics:readiness.metrics
  });
 }
 if(url.pathname==='/api/paper/status'&&req.method==='GET')return json(res,200,paper.status(u.id));
 {const m=url.pathname.match(/^\/api\/paper\/proposals\/([^/]+)\/approve$/);if(m&&req.method==='POST'){const r=await __mfApprovePaperProposalWithRisk(u.id,m[1]);return json(res,r.ok?200:r.code==='NOT_FOUND'?404:409,r);}}
 {const m=url.pathname.match(/^\/api\/paper\/proposals\/([^/]+)\/reject$/);if(m&&req.method==='POST'){const r=paper.rejectProposal(u.id,m[1]);return json(res,r.ok?200:r.code==='NOT_FOUND'?404:409,r);}}
 {const m=url.pathname.match(/^\/api\/paper\/positions\/([^/]+)\/close$/);if(m&&req.method==='POST'){const r=paper.closePosition(u.id,m[1]);return json(res,r.ok?200:r.code==='NOT_FOUND'?404:409,r);}}
}
process.on('uncaughtException',e=>{console.error('[MEMEFLOW] uncaughtException',e.message,(e.stack||'').split('\n')[1]||'')});
process.on('unhandledRejection',r=>{console.error('[MEMEFLOW] unhandledRejection',(r instanceof Error?r.message:String(r)))});
const server=http.createServer((req,res)=>handler(req,res).catch(e=>json(res,500,{error:'SERVER_ERROR',message:e.message})));server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>{
  const listenAt=Date.now();
  console.log(`MEMEFLOW listening on ${process.env.PORT||3000}`);
  startDiscovery();
  startDecisionRecovery({store,metrics:recoveryMetrics,getLiveState:()=>({queueDepth:discQueue.freshQueueDepth+discQueue.retryQueueDepth,processing:discQueue.processing}),batchSize:DECISION_RECOVERY_BATCH_SIZE,delayMs:DECISION_RECOVERY_DELAY_MS,tokenLimit:DECISION_RECOVERY_TOKEN_LIMIT,activeUserHoursMs:DECISION_RECOVERY_ACTIVE_USER_HOURS*3600000})
    .then(()=>{const ms=recoveryMetrics.decisionRecoveryCompletedAt-listenAt;console.log(`[RECOVERY] complete in ${ms}ms — ${recoveryMetrics.decisionRecoveryTokensProcessed} tokens, ${recoveryMetrics.decisionRecoveryDecisionsCreated} decisions, ${recoveryMetrics.decisionRecoveryErrors} errors`)})
    .catch(e=>console.error('[RECOVERY] error',e.message));
});


// MEMEFLOW_V12_21_LIVE_TRADE_STREAM_HOLDER_FEED
const __pumpLiveTradeFeed=startPumpLiveTradeFeed({
  eventHolderLedger: typeof eventHolderLedger!=='undefined'?eventHolderLedger:null,
  eventMarketLedger: typeof eventMarketLedger!=='undefined'?eventMarketLedger:null,
  store: typeof store!=='undefined'?store:null,
  publish: typeof publish==='function'?publish:null,
  publishTrade: typeof publishTrade==='function'?publishTrade:null,
  evaluateAI: typeof evaluateAll==='function'?evaluateAll:null,
  opportunityEngine,
  getSolUsd:()=>solUsdOracle.get(),
  onDead:(mint,reason)=>__mfDropScannerToken(mint,reason)
});

// MEMEFLOW_V12_22_WS_DIRECT_TRADE_EVENT: live feed module now decodes Pump TradeEvent directly from logsSubscribe; no per-signature HTTP getTransaction.

// MEMEFLOW_V12_23_FRESH_WARMING_GATE_DIAGNOSTICS: diagnostic helper available for token-level inspection.
globalThis.__MEMEFLOW_V12_23_GATE__=(token,settings)=>__v1223Gate(token,settings);

// MEMEFLOW_V12_24_CREATOR_GATE_RECOVERY: deterministic gate endpoint/helper support.
globalThis.__MEMEFLOW_V12_24_GATE_FOR_MINT__=(mint,settings)=>__v1224GateForMint(mint,settings);

// MEMEFLOW_V12_26_EVALUATION_LIFECYCLE_DIAGNOSTICS

// MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
// Solana HTTP RPC enters the automatic trading pipeline ONLY HERE:
// BUY READY -> FINAL WALLET VERIFY -> OPEN POSITION.
let __mfWalletRiskModulePromise=null;

const __mfWalletRiskModule=()=>
  __mfWalletRiskModulePromise||=
    import('./src/wallet-cluster-risk.mjs');

const __mfPreOpenRiskInflight=
  new Map();

function __mfWalletRiskSettingEnabled(value){
  return (
    value!==null &&
    value!==undefined &&
    value!=='' &&
    Number.isFinite(Number(value))
  );
}

function __mfWalletRiskRequired(settings={}){
  return (
    __mfWalletRiskSettingEnabled(
      settings.maxSuspectedRiskyWalletsPct
    ) ||
    __mfWalletRiskSettingEnabled(
      settings.maxInsidersPct
    )
  );
}

function __mfWalletRiskSampleKey(token={}){
  if(token.holderRiskWalletsKey){
    return String(
      token.holderRiskWalletsKey
    );
  }

  return (
    Array.isArray(token.holderRiskWallets)
      ? token.holderRiskWallets
      : []
  )
    .map(
      x=>
        String(
          x?.wallet ||
          x?.address ||
          x ||
          ''
        ).trim()
    )
    .filter(Boolean)
    .slice(0,8)
    .join('|');
}

function __mfWalletRiskCacheFresh(
  token={},
  sampleKey=''
){
  const scannedAt=
    Number(
      token.walletClusterRiskScannedAt ||
      0
    );

  const ttl=
    Math.max(
      30_000,
      Number(
        process.env.PREOPEN_WALLET_RISK_TTL_MS ||
        300_000
      )
    );

  return Boolean(
    scannedAt>0 &&
    Date.now()-scannedAt<ttl &&
    sampleKey &&
    String(
      token.walletClusterRiskSampleKey ||
      ''
    )===sampleKey
  );
}

async function __mfRunPreOpenRiskScan(token){
  const mint=
    String(token?.mint||'');

  const sampleKey=
    __mfWalletRiskSampleKey(token);

  try{
    store.setToken(
      mint,
      {
        preOpenRiskStatus:'RPC_VERIFYING',
        walletClusterRiskLastAttemptAt:Date.now(),
        walletClusterRiskLastError:null
      }
    );
  }catch{}

  try{
    const {
      scanWalletClusterRisk
    }=
      await __mfWalletRiskModule();

    const result=
      await scanWalletClusterRisk({
        rpc:__mfPreOpenRpc,
        token
      });

    if(!result?.ok){
      const updated=
        store.setToken(
          mint,
          {
            preOpenRiskStatus:'RPC_ERROR',
            walletClusterRiskLastAttemptAt:Date.now(),
            walletClusterRiskLastError:
              String(
                result?.reason ||
                'scan-failed'
              ).slice(0,180)
          }
        );

      try{publish(mint)}catch{}

      return {
        ok:false,
        code:'WALLET_RISK_RPC_UNAVAILABLE',
        token:updated||token
      };
    }

    const updated=
      store.setToken(
        mint,
        {
          suspectedRiskyWalletsPct:
            Number(
              result.suspectedRiskyWalletsPct
            )||0,

          insidersPct:
            Number(
              result.insidersPct
            )||0,

          walletClusterRiskScannedAt:
            Number(
              result.scannedAt
            )||Date.now(),

          walletClusterRiskLastAttemptAt:
            Date.now(),

          walletClusterRiskSampleKey:
            sampleKey,

          walletClusterRiskVersion:
            String(
              result.version ||
              'V3'
            ),

          walletClusterRiskSampledWallets:
            Number(
              result.sampledWallets
            )||0,

          walletClusterRiskFundingRecords:
            Number(
              result.fundingRecords
            )||0,

          walletClusterRiskLinkedWallets:
            Number(
              result.linkedWallets
            )||0,

          walletClusterRiskInsiderWallets:
            Number(
              result.insiderWallets
            )||0,

          walletClusterRiskCommonFunders:
            Number(
              result.commonFunders
            )||0,

          walletClusterRiskEvidence:
            Array.isArray(result.evidence)
              ? result.evidence.slice(0,8)
              : [],

          walletClusterRiskLastError:null,

          preOpenRiskStatus:
            'RPC_SCANNED'
        }
      );

    try{publish(mint)}catch{}

    return {
      ok:true,
      token:updated||token
    };

  }catch(error){

    const updated=
      store.setToken(
        mint,
        {
          preOpenRiskStatus:'RPC_ERROR',
          walletClusterRiskLastAttemptAt:Date.now(),
          walletClusterRiskLastError:
            String(
              error?.message ||
              error
            ).slice(0,180)
        }
      );

    try{publish(mint)}catch{}

    return {
      ok:false,
      code:'WALLET_RISK_RPC_UNAVAILABLE',
      token:updated||token
    };
  }
}

async function __mfVerifyPreOpenRisk(
  uid,
  token,
  decision,
  settings
){
  // User disabled both wallet-risk gates.
  if(!__mfWalletRiskRequired(settings)){
    return {
      ok:true,
      token,
      decision:{
        ...decision,
        preOpenRiskVerified:true
      }
    };
  }

  const wallets=
    Array.isArray(token?.holderRiskWallets)
      ? token.holderRiskWallets
      : [];

  // BUY READY can remain visible while the WS ledger builds the wallet sample,
  // but no position may open yet.
  if(wallets.length<3){
    try{
      store.setToken(
        token.mint,
        {
          preOpenRiskStatus:
            'WAITING_HOLDER_SAMPLE'
        }
      );
    }catch{}

    return {
      ok:false,
      code:'WALLET_RISK_SAMPLE_PENDING',
      token,
      decision
    };
  }

  const sampleKey=
    __mfWalletRiskSampleKey(token);

  let updated=
    store.state.tokens?.[token.mint] ||
    token;

  if(
    !__mfWalletRiskCacheFresh(
      updated,
      sampleKey
    )
  ){
    const lastAttempt=
      Number(
        updated.walletClusterRiskLastAttemptAt ||
        0
      );

    const retryMs=
      Math.max(
        3000,
        Number(
          process.env.PREOPEN_WALLET_RISK_RETRY_MS ||
          10_000
        )
      );

    if(
      updated.preOpenRiskStatus==='RPC_ERROR' &&
      lastAttempt>0 &&
      Date.now()-lastAttempt<retryMs
    ){
      return {
        ok:false,
        code:'WALLET_RISK_RETRY_COOLDOWN',
        token:updated,
        decision
      };
    }

    let job=
      __mfPreOpenRiskInflight.get(
        token.mint
      );

    if(!job){
      job=
        __mfRunPreOpenRiskScan(
          updated
        ).finally(
          ()=>
            __mfPreOpenRiskInflight.delete(
              token.mint
            )
        );

      __mfPreOpenRiskInflight.set(
        token.mint,
        job
      );
    }

    const scanned=
      await job;

    if(!scanned?.ok){
      return {
        ok:false,
        code:
          scanned?.code ||
          'WALLET_RISK_RPC_UNAVAILABLE',
        token:
          scanned?.token ||
          updated,
        decision
      };
    }

    updated=
      scanned.token;
  }

  // MEMEFLOW_OPPORTUNITY_ENGINE_V1
  // RPC may take seconds. Re-read the newest WS snapshot before entry.
  const latest=store.state.tokens?.[updated.mint]||null;
  if(!latest||latest.dead===true){
    return {ok:false,code:'PREOPEN_TOKEN_DEAD_OR_REMOVED',token:latest||updated,decision};
  }
  const currentSampleKey=__mfWalletRiskSampleKey(latest);
  if(latest.walletClusterRiskSampleKey&&currentSampleKey&&latest.walletClusterRiskSampleKey!==currentSampleKey){
    try{store.setToken(latest.mint,{preOpenRiskStatus:'HOLDER_SAMPLE_CHANGED'})}catch{}
    return {ok:false,code:'WALLET_RISK_SAMPLE_CHANGED',token:latest,decision};
  }
  updated=latest;
  const finalDecision=evaluate(updated,settings);

  const settingsVersion=
    store.state.users?.[uid]?.settingsVersion ||
    store.state.users?.[uid]?.updatedAt ||
    Date.now();

  const saved={
    ...finalDecision,

    primaryReason:
      finalDecision.primaryReason,

    settingsVersion,

    reevaluatedAt:
      Date.now(),

    preOpenRiskVerified:
      finalDecision.state==='BUY READY',

    preOpenRiskCheckedAt:
      updated.walletClusterRiskScannedAt ||
      Date.now()
  };

  store.setDecision(
    uid,
    updated.mint,
    saved
  );

  if(
    finalDecision.state!=='BUY READY'
  ){
    return {
      ok:false,
      code:'WALLET_RISK_BLOCKED',
      token:updated,
      decision:saved
    };
  }

  return {
    ok:true,
    token:updated,
    decision:saved
  };
}

async function __mfHandleDecision(
  uid,
  token,
  decision
){
  if(
    !uid ||
    !token?.mint ||
    decision?.state!=='BUY READY'
  ){
    return {
      action:'NONE'
    };
  }

  const settings=
    store.settings(uid) ||
    {};

  if(
    paper.environment(settings)!=='paper'
  ){
    return {
      action:'NONE',
      reason:'NOT_PAPER'
    };
  }

  const mode=
    paper.mode(settings);

  // OBSERVE does not open anything.
  // ASSIST only builds a proposal; RPC is deferred until approval/open.
  if(
    mode==='observe' ||
    mode==='assist'
  ){
    return paper.onDecision(
      uid,
      token,
      decision,
      settings
    );
  }

  if(mode!=='automate'){
    return {
      action:'NONE',
      reason:'UNKNOWN_MODE'
    };
  }

  if(
    paper.openForMint(
      uid,
      token.mint
    )
  ){
    return {
      action:'NONE',
      reason:'POSITION_EXISTS'
    };
  }

  // No expensive RPC if normal execution rules already forbid an entry.
  const readiness=
    paper.canEnter(
      uid,
      token,
      settings
    );

  if(!readiness?.ok){
    return {
      action:'NONE',
      reason:
        readiness?.code ||
        'ENTRY_NOT_READY'
    };
  }

  // THIS is the first automatic Solana HTTP RPC stage.
  const verified=
    await __mfVerifyPreOpenRisk(
      uid,
      token,
      decision,
      settings
    );

  if(!verified.ok){
    return {
      action:'NONE',
      reason:verified.code
    };
  }

  return paper.onDecision(
    uid,
    verified.token,
    verified.decision,
    settings
  );
}

async function __mfApprovePaperProposalWithRisk(
  uid,
  proposalId
){
  const proposal=
    store.state.paperProposals?.[
      proposalId
    ];

  if(
    !proposal ||
    proposal.userId!==uid
  ){
    return {
      ok:false,
      code:'NOT_FOUND'
    };
  }

  const token=
    store.state.tokens?.[
      proposal.mint
    ] ||
    null;

  if(!token){
    return {
      ok:false,
      code:'TOKEN_NOT_FOUND'
    };
  }

  const settings=
    store.settings(uid) ||
    {};

  const readiness=
    paper.canEnter(
      uid,
      token,
      settings
    );

  if(!readiness?.ok){
    return readiness;
  }

  const decision={
    state:'BUY READY',
    score:proposal.decisionScore,
    confidence:proposal.decisionConfidence,
    primaryReason:proposal.primaryReason
  };

  const verified=
    await __mfVerifyPreOpenRisk(
      uid,
      token,
      decision,
      settings
    );

  if(!verified.ok){
    return {
      ok:false,
      code:verified.code
    };
  }

  return paper.approveProposal(
    uid,
    proposalId,
    verified.token
  );
}
