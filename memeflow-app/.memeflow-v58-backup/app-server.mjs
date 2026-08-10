import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import zlib from 'node:zlib';import {fileURLToPath} from 'node:url';
import {JsonStore,sessionId,defaults} from './src/store.mjs';import {RpcPool,validPubkey,decodeCurve,decodeCreateData,decodePumpCreate,shouldExcludeMayhemCreate} from './src/solana.mjs';import {evaluate,tokenAgeMinutes} from './src/evaluate.mjs';import {validateSettings} from './src/settings.mjs';import {StripeBilling} from './src/billing.mjs';
import {OpenAIIntelligence} from './src/openai-intelligence.mjs';import {PaperEngine} from './src/paper-engine.mjs';
import {enrichToken,enrichHolders,makeEnrichDiag,makeHolderQueue,makeHolderMetrics} from './src/enrich.mjs';
import {makeRecoveryMetrics,startDecisionRecovery,lazyRecoverUser} from './src/recovery.mjs';
import {makeLiveEvalMetrics,makeEvaluateForActiveUsers} from './src/liveeval.mjs';
import {makeDiscoveryMetrics,makeDiscoveryQueue} from './src/discqueue.mjs';
import {candidateFeed,candidateVisibilityCounts} from './src/candidate-visibility.mjs';
import { startPumpLiveTradeFeed } from './src/pump-live-trade-feed.mjs'; // MEMEFLOW_V12_21_LIVE_TRADE_STREAM_HOLDER_FEED

import { eventMarketLedger } from './src/event-market-ledger.mjs'; // MEMEFLOW_V12_18_EVENT_MARKET_LEDGER

import { eventHolderLedger } from './src/event-holder-ledger.mjs'; // MEMEFLOW_V12_17_EVENT_HOLDER_LEDGER

import {manualAnalyze} from './src/manual-scan.mjs';
// MEMEFLOW AI ASSISTANT HARD OFF: import disabled
const root=path.dirname(fileURLToPath(import.meta.url)),dataDir=path.resolve(root,process.env.DATA_DIR||'data'),store=new JsonStore(dataDir);
const paper=new PaperEngine(store);
const billing=new StripeBilling({store,secretKey:process.env.STRIPE_SECRET_KEY,priceId:process.env.STRIPE_PRICE_ID,webhookSecret:process.env.STRIPE_WEBHOOK_SECRET,apiBase:process.env.STRIPE_API_BASE});
const rpcUrls=(process.env.SOLANA_RPC_URLS||'').split(',').map(x=>x.trim()).filter(Boolean),wsUrls=(process.env.SOLANA_WS_URLS||'').split(',').map(x=>x.trim()).filter(Boolean);const rpc=new RpcPool(rpcUrls,process.env.SOLANA_COMMITMENT||'confirmed');
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
function candidateView(d){
  const t=store.state.tokens[d.mint]||{};
  const finite=(v)=>v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
  const marketCapSol=finite(t.marketCapSol);
  const liquiditySol=finite(t.liquiditySol);
  const top10Pct=finite(t.top10Pct);
  const developerPct=finite(t.developerPct??t.developerSharePct);
  const buyPressure=finite(t.buyPressure??t.momentum);
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
    ageMinutes:tokenAgeMinutes(t),
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
    riskApproved:d.state==='BUY READY',
    routeApproved:t.priceSol!=null,
    holderFresh:t.holderFresh,
    positionSize:null,
    quoteAgeMs:t.lastPriceAt?Math.max(0,Date.now()-t.lastPriceAt):null,
    slippagePct:null
  };
}
const liveEvalMetrics=makeLiveEvalMetrics();
const LIVE_EVAL_HOURS=Number(process.env.LIVE_EVALUATION_ACTIVE_USER_HOURS||24);
const LIVE_EVAL_BATCH=Number(process.env.LIVE_EVALUATION_BATCH_SIZE||25);
const LIVE_EVAL_DELAY=Number(process.env.LIVE_EVALUATION_DELAY_MS||0);
const evaluateAll=makeEvaluateForActiveUsers({store,metrics:liveEvalMetrics,activeUserHoursMs:LIVE_EVAL_HOURS*3600000,batchSize:LIVE_EVAL_BATCH,delayMs:LIVE_EVAL_DELAY,onDecision:(uid,token,decision)=>{try{paper.onDecision(uid,token,decision,store.settings(uid))}catch(_){}}});
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
  // V12.4: start holder + price + initial decision immediately.
  fastPhaseAStart(mint,curve);

  fastPhaseMetrics.fullEnrichBackgroundStarted++;
  try{
    await enrichToken(mint,curve,{rpc,store,tradeWindows,evaluateAll,publish,ensurePriceTimer,discMetrics,enrichDiag});
    fastPhaseMetrics.fullEnrichBackgroundSucceeded++;
  }catch(e){
    fastPhaseMetrics.fullEnrichBackgroundFailed++;
    fastPhaseMetrics.lastFullEnrichError=String(e?.message||e).slice(0,240);
    throw e;
  }

  try{paper.onTokenUpdate(mint,store.state.tokens[mint])}catch(_){}
}
function publish(mint){
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
  const _priceDiag=priceDiagRow(mint);
  _priceDiag.timerCreatedAt=Date.now();
  prunePriceDiag();
  let lastBackgroundPollAt=0;
  const baseTick=Math.max(1000,Number(process.env.POLL_ACTIVE_MS||2000));
  const maxBackgroundAgeMs=Math.max(60000,Number(process.env.BACKGROUND_TOKEN_MAX_AGE_MS||10800000));

  const timer=setInterval(async()=>{
    const t=store.state.tokens[mint];
    if(!t){clearInterval(timer);priceTimers.delete(mint);return}

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
  try{__v1224LinkCreator(mint,__v1223Token(mint))}catch{}
        // MEMEFLOW_V12_20_USER_ONLY_HOLDER_LEDGER: preserve Pump creator separately from trade signers.
        try{
          const __created=store.state?.tokens?.[mint];
          const __creator=__created?.creator||null;
          if(__creator)eventHolderLedger.setCreator(mint,__creator);
        }catch{}
      // MEMEFLOW V12.4 immediate discovery bootstrap
      fastPhaseAStart(result.mint,result.curve);
      
      void enrich(result.mint,result.curve).catch(e=>{discMetrics.lastErrorAt=Date.now();discovery.lastError={message:'enrich: '+String(e?.message||e),at:Date.now()}});
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
    const all=Object.values(store?.state?.tokens||{})
      .filter(t=>bridgeIsPump(t)&&bridgeAgeMs(t,now)<=BRIDGE_MAX_AGE_MS&&bridgeAgeMs(t,now)>=BRIDGE_MIN_TOKEN_AGE_MS);

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
    // Filter: only create instructions are worth a getTransaction call
    ws.onmessage=ev=>{
      try{
        const m=JSON.parse(ev.data);
        const sig=m.params?.result?.value?.signature;
        if(!sig)return;
        discMetrics.eventsReceived++;
        const logs=m.params?.result?.value?.logs;
        if(!Array.isArray(logs)){discMetrics.eventsWithoutLogs++;discMetrics.eventsFiltered++;return}
        // Accept only Pump.fun token creation instructions; drop Buy/Sell/Withdraw/Migrate/etc.
        const isCreate=logs.some(l=>/Instruction:\s*Create(?:V2|\s+V2|\s*$)/i.test(l));
        if(!isCreate){discMetrics.nonCreateEventsIgnored++;discMetrics.eventsFiltered++;return}
        discMetrics.createEventsAccepted++;
        discovery.lastEventAt=Date.now();
        enqueue(sig);
      }catch{}
    };
    // WS errors stored as lastError; do not overwrite connection state here
    ws.onerror=e=>{discovery.lastError={message:'WebSocket error'+(e?.message?': '+e.message:''),at:Date.now()};setTimeout(()=>{try{ws?.close()}catch{}},250)};
    ws.onclose=()=>{discovery.connected=false;discovery.reconnects++;wsReconnectAttempt++;clearTimeout(wsTimer);wsTimer=setTimeout(()=>startDiscovery(i+1),Math.min(30000,1000*2**Math.min(wsReconnectAttempt,5)))};
  }catch(e){discovery.error=e.message;wsTimer=setTimeout(()=>startDiscovery(i+1),5000)}
}
function shadowValidateSettings(settings,limit=50){const rows=store.tokens().slice(0,Math.max(1,Math.min(200,limit)));const counts={WAITING:0,WATCH:0,'BUY READY':0,BLOCKED:0,EXPIRED:0};const errors=[];for(const token of rows){try{const d=evaluate(token,settings);counts[d.state]=(counts[d.state]||0)+1}catch(e){errors.push({mint:token.mint||null,message:e.message})}}return {tested:rows.length,counts,errors};}
function reevaluateUser(uid){
  const settings=store.settings(uid);
  const tokens=store.tokens();
  const settingsVersion=store.user(uid)?.settingsVersion||store.user(uid)?.updatedAt||Date.now();
  let count=0,errors=0;
  const states={WAITING:0,WATCH:0,BLOCKED:0,'BUY READY':0,EXPIRED:0};

  for(const token of tokens){
    try{
      const d=evaluate(token,settings);
      const saved={...d,primaryReason:d.primaryReason,settingsVersion,reevaluatedAt:Date.now()};
      store.setDecision(uid,token.mint,saved);
      states[d.state]=(states[d.state]||0)+1;
      // PAPER receives only the fresh current decision. It still applies owner approval,
      // capital and execution gates internally.
      if(d.state==='BUY READY'){
        try{paper.onDecision(uid,token,saved,settings)}catch(_){}
      }
      count++;
    }catch(_){errors++}
  }
  return {count,errors,states,settingsVersion};
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
  holderCount,
  top10Pct:top10,
  developerPct,
  buyPressure,
  // evaluate() only checks that priceSol is non-null; use a sentinel when a verified USD price exists.
  priceSol:priceSol!=null?priceSol:(priceUsd!=null?0:null),
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

async function handler(req,res){const url=new URL(req.url,'http://x');
 if(url.pathname==='/api/billing/webhook'&&req.method==='POST'){const raw=await rawBody(req);try{billing.verify(raw,req.headers['stripe-signature']);const result=billing.processEvent(JSON.parse(raw));return json(res,200,{received:true,...result})}catch(e){return json(res,e.code==='BAD_SIGNATURE'?400:500,{error:e.code||'WEBHOOK_ERROR',message:e.message})}}
 // Health check — no session or store needed; must respond immediately
 if(url.pathname==='/api/healthz'||url.pathname==='/api/health')return json(res,200,{ok:true,server:'online',version:'1.0.1-clean',timestamp:new Date().toISOString()});
 // Static files — served before session creation to avoid blocking store.save() on new users
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

 if(url.pathname==='/api/ai/decisions'){
  const _lim=Math.min(200,Math.max(1,Number(url.searchParams.get('limit')||50)));
  const _off=Math.max(0,Number(url.searchParams.get('offset')||0));
  const _scope=String(url.searchParams.get('scope')||'candidates').toLowerCase();
  if(!store._uidDec[u.id]?.size)await lazyRecoverUser({store,uid:u.id,metrics:recoveryMetrics,tokenLimit:DECISION_RECOVERY_TOKEN_LIMIT});
  const _all=store.decisions(u.id);
  const _selected=candidateFeed(_all,_scope);
  const _counts=candidateVisibilityCounts(_all);
  return json(res,200,{
    decisions:_selected.slice(_off,_off+_lim).map(candidateView),
    total:_selected.length,
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
        scanError:token.scanError||null
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
    const pumpTokens=allTokens
      .filter(t=>{
        const lp=String(t?.launchPlatform||t?.protocol||'').toLowerCase();
        const mint=String(t?.mint||t?.tokenMint||t?.tokenAddress||'');
        return lp==='pump'||mint.toLowerCase().endsWith('pump');
      })
      .sort((a,b)=>Number(b?.discoveredAt||b?.createdAt||0)-Number(a?.discoveredAt||a?.createdAt||0))
      .slice(0,limit);

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
 if(url.pathname==='/api/settings'&&req.method==='GET'){const settings=store.settings(u.id);return json(res,200,{settings,version:u.settingsVersion||1,killSwitchActive:u.killSwitch,capabilities:{liveAutomation:hasLiveEntitlement(u),paperAutomation:true,discoveryPlatforms:['pump'],adaptiveProfile:false}})}
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
    users:Object.keys(store.state.users).length,
    decisionsInMemory:Object.values(store._uidDec).reduce((s,m)=>s+m.size,0)
  });
}
 if(url.pathname==='/api/chart/config'){const qualified=candidateFeed(store.decisions(u.id),'candidates');return json(res,200,{chainId:'solana',tokenAddress:qualified[0]?.mint||''});}
 if(url.pathname==='/api/chart/history'){const mint=url.searchParams.get('tokenAddress'),t=store.state.tokens[mint];const pts=t?.priceSol?[{t:t.updatedAt,price:t.priceSol,source:t.source}]:[];return json(res,200,{points:pts,status:{stale:!pts.length,source:t?.source||null,error:t?.scanError||null},tokenAddress:mint})}
 if(url.pathname==='/api/chart/stream'){const mint=url.searchParams.get('tokenAddress');res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});res.write(`event: snapshot\ndata: ${JSON.stringify({points:[],status:{stale:true,source:'Solana'}})}\n\n`);if(!streams.has(mint))streams.set(mint,new Set());streams.get(mint).add(res);req.on('close',()=>streams.get(mint)?.delete(res));return}
 if(url.pathname==='/api/live/execute'){if(!hasLiveEntitlement(u))return json(res,402,{error:'LIVE_ENTITLEMENT_REQUIRED',message:'An active MEMEFLOW Pro subscription or verified owner entitlement is required.'});return json(res,423,{error:'LIVE_EXECUTION_NOT_READY',message:u.isOwner?'Owner LIVE entitlement is active, but verified wallet and production execution engine are still required.':'Pro is active, but verified wallet and production execution engine are still required.'});}
 // ── PAPER API routes ──────────────────────────────────────────────────────
 if(url.pathname==='/api/paper/positions'&&req.method==='GET')return json(res,200,{positions:paper.userPositions(u.id)});
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
 {const m=url.pathname.match(/^\/api\/paper\/proposals\/([^/]+)\/approve$/);if(m&&req.method==='POST'){const token=store.state.tokens[store.state.paperProposals[m[1]]?.mint]||null;const r=paper.approveProposal(u.id,m[1],token);return json(res,r.ok?200:r.code==='NOT_FOUND'?404:409,r);}}
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
  evaluateAI: typeof evaluateAll==='function'?evaluateAll:null
});

// MEMEFLOW_V12_22_WS_DIRECT_TRADE_EVENT: live feed module now decodes Pump TradeEvent directly from logsSubscribe; no per-signature HTTP getTransaction.

// MEMEFLOW_V12_23_FRESH_WARMING_GATE_DIAGNOSTICS: diagnostic helper available for token-level inspection.
globalThis.__MEMEFLOW_V12_23_GATE__=(token,settings)=>__v1223Gate(token,settings);

// MEMEFLOW_V12_24_CREATOR_GATE_RECOVERY: deterministic gate endpoint/helper support.
globalThis.__MEMEFLOW_V12_24_GATE_FOR_MINT__=(mint,settings)=>__v1224GateForMint(mint,settings);

// MEMEFLOW_V12_26_EVALUATION_LIFECYCLE_DIAGNOSTICS
