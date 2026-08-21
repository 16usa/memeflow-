/**
 * Per-step token enrichment with partial-result preservation.
 * Phase A (enrichToken)  — immediate: supply, curve, store, evaluate, publish.
 * Phase B (enrichHolders) — delayed: canonical getProgramAccounts wallet census.
 * makeHolderQueue — bounded, deduplicating holder enrichment queue (dep-injected).
 *
 * Imported by app-server.mjs.
 */
import {decodeCurve,b58encode} from './solana.mjs';

/* MEMEFLOW_TOKEN_METADATA_IMAGE_V1 */
function normalizeMetadataUrl(value) {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;
  if (/^ipfs:\/\//i.test(url)) {
    return 'https://ipfs.io/ipfs/' + url.replace(/^ipfs:\/\//i, '').replace(/^ipfs\//i, '');
  }
  if (/^ar:\/\//i.test(url)) {
    return 'https://arweave.net/' + url.replace(/^ar:\/\//i, '');
  }
  if (/^https?:\/\//i.test(url)) return url;
  return null;
}

function firstMetadataImage(metadata) {
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

async function fetchTokenMetadata(uri) {
  const metadataUrl = normalizeMetadataUrl(uri);
  if (!metadataUrl) return {
    metadataUrl:null,imageUrl:null,metadataResolved:true,
    twitter:null,website:null,telegram:null
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(metadataUrl, {
      signal: controller.signal,
      headers: {
        accept: 'application/json,text/plain;q=0.9,*/*;q=0.5',
        'user-agent': 'MEMEFLOW/1.0 token-metadata'
      }
    });
    if (!response.ok) throw new Error('metadata HTTP ' + response.status);

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 1_500_000) throw new Error('metadata response too large');

    const metadata = await response.json();
    return {
      metadataUrl,
      metadataResolved:true,
      imageUrl:firstMetadataImage(metadata),
      metadataName:typeof metadata?.name === 'string' ? metadata.name.slice(0,160) : null,
      metadataSymbol:typeof metadata?.symbol === 'string' ? metadata.symbol.slice(0,40) : null,
      twitter:firstMetadataText(metadata,['twitter','x','twitter_url','x_url']),
      website:firstMetadataText(metadata,['website','site','url','homepage']),
      telegram:firstMetadataText(metadata,['telegram','tg','telegram_url'])
    };
  } finally {
    clearTimeout(timeout);
  }
}

// MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT
// Lightweight retry for unresolved metadata or a missing token image.
export async function refreshTokenMetadata(mint,deps={}){
  const {store,evaluateAll,publish}=deps;
  const token=store?.state?.tokens?.[mint]||null;
  if(!token)return {attempted:false,reason:'token-missing'};

  const uri=token.uri||token.metadataUri||null;
  if(!uri)return {attempted:false,reason:'uri-missing'};

  const existingImage=token.imageUrl||token.image||token.logoUrl||null;
  if(existingImage)return {attempted:false,reason:'image-present'};

  const maxAttempts=Math.max(1,Number(process.env.METADATA_IMAGE_RETRY_MAX||4));
  const attempts=Math.max(0,Number(token.metadataImageRetryCount||0));
  const configuredRetryMs=Number(process.env.METADATA_IMAGE_RETRY_MS);
  const retrySchedule=[5000,15000,45000,120000];
  const retryMs=Number.isFinite(configuredRetryMs)&&configuredRetryMs>0
    ? Math.max(5000,configuredRetryMs)
    : retrySchedule[Math.min(attempts,retrySchedule.length-1)];
  const lastAttempt=Number(token.metadataImageRetryAt||token.metadataFetchedAt||0);

  if(attempts>=maxAttempts)return {attempted:false,reason:'retry-limit'};
  if(lastAttempt>0&&Date.now()-lastAttempt<retryMs)return {attempted:false,reason:'retry-wait'};

  const now=Date.now();

  try{
    const metadata=await fetchTokenMetadata(uri);
    const imageUrl=metadata.imageUrl||existingImage||null;
    const socialPatch={};

    if(metadata.twitter){
      socialPatch.twitter=metadata.twitter;
      socialPatch.twitterUrl=metadata.twitter;
    }
    if(metadata.website){
      socialPatch.website=metadata.website;
      socialPatch.websiteUrl=metadata.website;
    }
    if(metadata.telegram){
      socialPatch.telegram=metadata.telegram;
      socialPatch.telegramUrl=metadata.telegram;
    }

    const updated=store.setToken(mint,{
      metadataFetchedAt:now,
      metadataResolved:metadata.metadataResolved===true||token.metadataResolved===true,
      metadataError:null,
      metadataUrl:metadata.metadataUrl||token.metadataUrl||null,
      imageUrl,
      image:imageUrl,
      logoUrl:imageUrl,
      metadataName:metadata.metadataName||token.metadataName||null,
      metadataSymbol:metadata.metadataSymbol||token.metadataSymbol||null,
      metadataImageRetryCount:attempts+1,
      metadataImageRetryAt:now,
      metadataImageRetryComplete:Boolean(imageUrl),
      ...socialPatch
    });

    if(typeof evaluateAll==='function')await evaluateAll(updated);
    try{publish?.(mint)}catch{}

    return {attempted:true,success:true,imageFound:Boolean(imageUrl)};
  }catch(error){
    const updated=store.setToken(mint,{
      metadataImageRetryCount:attempts+1,
      metadataImageRetryAt:now,
      metadataError:sanitize(error?.message||String(error)),
      metadataResolved:token.metadataResolved===true
    });

    if(typeof evaluateAll==='function'){
      await Promise.resolve(evaluateAll(updated)).catch(()=>{});
    }
    try{publish?.(mint)}catch{}

    return {attempted:true,success:false,error:sanitize(error?.message||String(error))};
  }
}



// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip RPC URLs and long base58 addresses from error messages. */
function sanitize(msg) {
  return (msg || 'unknown error')
    .replace(/https?:\/\/\S+/gi, '[rpc-url]')
    .replace(/[1-9A-HJ-NP-Za-km-z]{32,}/g, '[addr]')
    .slice(0, 200);
}

export function recordEnrichError(enrichDiag, mint, step, e) {
  const msg = sanitize(e?.message || String(e));
  enrichDiag.lastEnrichError = `${step}: ${msg}`;
  enrichDiag.lastEnrichErrorAt = Date.now();
  enrichDiag.lastEnrichMint = mint;
  enrichDiag.enrichFailureReasons[msg] = (enrichDiag.enrichFailureReasons[msg] || 0) + 1;
}

export function makeEnrichDiag() {
  return {
    lastEnrichError: null,
    lastEnrichErrorAt: null,
    lastEnrichMint: null,
    enrichFailureReasons: {},
    enrichStepFailures: {
      getTokenSupply: 0,
      getTokenLargestAccounts: 0,
      getAccountInfo: 0,
      decodeCurve: 0,
      evaluate: 0,
    },
    // Permanent Solana parameter errors — do not retry, do not open circuit breaker
    invalidTokenMint: 0,
    accountNotFound: 0,
  };
}

export function makeHolderMetrics() {
  return {
    holderQueued: 0,
    holderSucceeded: 0,
    holderLateSucceeded: 0,
    holderFailed: 0,
    holderRateLimited: 0,
    holderRetries: 0,
    holderDropped: 0,
    holderAdmissionAllowed: 0,
    holderAdmissionDeferred: 0,
    holderAdmissionDropped: 0,
    holderAdmissionErrors: 0,
    holderWorkerTimeouts: 0,
    lastHolderWorkerTimeoutAt: null,
    lastHolderAdmissionReason: null,
    lastHolderError: null,
    lastHolderErrorAt: null,
  };
}

// ── Rate-limit detection ───────────────────────────────────────────────────────

function isRateLimited(e) {
  if (e?.status === 429) return true;
  const msg = (e?.message || '').toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('too many') ||
    msg.includes('rate limit') ||
    msg.includes('rate-limit') ||
    msg.includes('data allowance') ||
    msg.includes('credits') ||
    msg.includes('quota')
  );
}

// MEMEFLOW_RUNTIME_TRUTH_V1_4_1_HOLDER_HOTFIX
function isTransientHolderError(e){
  if(isRateLimited(e))return true;
  const status=Number(e?.status);
  const code=String(e?.code||'').toUpperCase();
  const msg=String(e?.message||'').toLowerCase();
  return e?.name==='AbortError'||[408,425,500,502,503,504].includes(status)||
    ['ECONNRESET','ENOTFOUND','ETIMEDOUT','ECONNREFUSED','EAI_AGAIN'].includes(code)||
    msg.includes('network')||msg.includes('connection reset')||msg.includes('temporarily unavailable')||
    msg.includes('timeout')||msg.includes('timed out')||msg.includes('aborted');
}

// ── Phase A: immediate enrichment ─────────────────────────────────────────────

/**
 * Enrich a newly-discovered token with on-chain data (Phase A — no holder lookup).
 *
 * Steps: getTokenSupply → getAccountInfo → decodeCurve → store → evaluate → publish.
 * holderFresh is always false after Phase A; Phase B sets it true.
 * holderCount and top10Pct are set to null; Phase B fills them in.
 *
 * @param {string}      mint   token mint address
 * @param {string|null} curve  bonding-curve account address (may be null)
 * @param {object}      deps   { rpc, store, tradeWindows, evaluateAll,
 *                               publish, ensurePriceTimer, discMetrics, enrichDiag }
 */
export async function enrichToken(mint, curve, deps) {
  const {
    rpc, store, tradeWindows, evaluateAll,
    publish, ensurePriceTimer, discMetrics, enrichDiag,
  } = deps;

  let anyStepFailed = false;

  function fail(step, e) {
    anyStepFailed = true;
    // Permanent Solana parameter errors — count separately, skip enrichFailureReasons
    if (e?.invalidTokenMint) { enrichDiag.invalidTokenMint++; return; }
    if (e?.accountNotFound)  { enrichDiag.accountNotFound++;  return; }
    if (step in enrichDiag.enrichStepFailures) enrichDiag.enrichStepFailures[step]++;
    recordEnrichError(enrichDiag, mint, step, e);
  }

  try {
    // ── Step 1: getTokenSupply ──────────────────────────────────────────────
    let supply = null;
    try {
      supply = await rpc.call('getTokenSupply', [mint, {commitment: 'confirmed'}]);
    } catch(e) { fail('getTokenSupply', e); }

    // ── Step 2: getAccountInfo (bonding curve, optional) ───────────────────
    let curveInfo = null;
    if (curve) {
      try {
        curveInfo = await rpc.call('getAccountInfo', [curve, {encoding: 'base64', commitment: 'confirmed'}]);
      } catch(e) { fail('getAccountInfo', e); }
    }

    // ── Step 3: decodeCurve (optional, depends on curveInfo) ───────────────
    let c = {};
    if (curveInfo?.value?.data?.[0]) {
      try {
        c = decodeCurve(curveInfo.value.data[0], supply?.value?.decimals ?? 6);
      } catch(e) { fail('decodeCurve', e); }
    }

    // ── Build token update from whatever succeeded ─────────────────────────
    const decimals = supply?.value?.decimals ?? 6;
    const total = Number(supply?.value?.uiAmountString ?? 0);
    const tw = (tradeWindows?.get?.(mint)) || {buy: 0, sell: 0};
    const existingToken = store.state.tokens[mint] || {};
    let metadataPatch = {};
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
    }


    const update = {
      ...metadataPatch,
      scanError: null,
      lastScannedAt: Date.now(),
      // MEMEFLOW_V12_7_HOLDER_CORRECTNESS_AND_PRIORITY
      // Phase A may finish AFTER Phase B. Never erase a successful holder scan.
      holderFresh: existingToken.holderFresh === true,
      holderCount: existingToken.holderFresh === true
        ? (existingToken.holderCount ?? null)
        : null,
      top10Pct: existingToken.holderFresh === true
        ? (existingToken.top10Pct ?? null)
        : null,
      developerPct: existingToken.holderFresh === true
        ? (existingToken.developerPct ?? existingToken.developerSharePct ?? null)
        : null,
      developerSharePct: existingToken.holderFresh === true
        ? (existingToken.developerPct ?? existingToken.developerSharePct ?? null)
        : null,
      buyPressure: tw.sell ? tw.buy / tw.sell : (tw.buy ? tw.buy : (existingToken.buyPressure ?? null)),
      momentum: tw.sell ? tw.buy / tw.sell : (tw.buy ? tw.buy : (existingToken.buyPressure ?? existingToken.momentum ?? null)),
      dataQuality: Math.max(Number(existingToken.dataQuality) || 0, [total || null, c.priceSol ?? existingToken.priceSol ?? null].filter(x => x != null).length / 2),
      source: existingToken.source || 'Pump create',
    };
    // Supply data
    if (supply) { update.decimals = decimals; update.totalSupply = total; }
    // Curve data
    if (Object.keys(c).length) {
      update.complete = c.complete ?? null;
      update.priceSol       = c.priceSol    ?? null;
      update.liquiditySol   = c.liquiditySol ?? null;
      update.marketCapSol   = (c.priceSol && total) ? c.priceSol * total : null;
      /* MEMEFLOW_CANONICAL_ENRICH_FIELDS_V1 */
      update.marketCap      = update.marketCapSol;
      update.liquidity      = update.liquiditySol;
      update.momentum       = update.buyPressure;
      update.marketSource   = 'pump-bonding-curve';
      update.priceSource    = 'pump-bonding-curve';
      update.canonicalMarket = true;
      update.pumpMarketUpdatedAt = Date.now();
    }

    // ── Always store, evaluate, publish ────────────────────────────────────
    const token = store.setToken(mint, update);

    // ── Step 4: evaluate (score the token) ─────────────────────────────────
    try {
      await evaluateAll(token);
    } catch(e) { fail('evaluate', e); }

    publish(mint);
    if (ensurePriceTimer) ensurePriceTimer(mint, curve);

    // Success: token stored and published regardless of step failures
    discMetrics.enrichSucceeded++;

    // Clear stale enrich error only after a fully clean Phase A (no step errors)
    if (!anyStepFailed) {
      enrichDiag.lastEnrichError    = null;
      enrichDiag.lastEnrichErrorAt  = null;
      enrichDiag.lastEnrichMint     = null;
    }
  } catch(e) {
    // Truly unrecoverable: store.setToken or publish threw (should not happen)
    if (store.state?.metrics) store.state.metrics.errors++;
    store.save?.();
    discMetrics.enrichFailed++;
    recordEnrichError(enrichDiag, mint, 'store/publish', e);
  }
}

// ── Phase B: delayed holder enrichment ────────────────────────────────────────

/**
 * Fetch holder data for a previously Phase-A-enriched token.
 *
 * Returns { rateLimited: false } on success.
 * Returns { rateLimited: true, retryAfter?: number } when rate-limited.
 * Throws on unexpected errors.
 *
 * @param {string} mint
 * @param {object} deps  { rpc, store, evaluateAll, publish, enrichDiag }
 */
const TOKEN_PROGRAM='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

function decodeHolderSlice(row,decimals){
  const data=row?.account?.data;
  const b64=Array.isArray(data)?data[0]:null;
  if(!b64)return null;
  try{
    // dataSlice is offset 32, length 40:
    // bytes 0..31 = token-account owner authority, 32..39 = raw amount.
    const b=Buffer.from(b64,'base64');
    if(b.length<40)return null;
    const authority=b58encode(b.subarray(0,32));
    const raw=b.readBigUInt64LE(32);
    const amount=Number(raw)/(10**Math.max(0,Number(decimals)||0));
    return Number.isFinite(amount)?{authority,amount}:null;
  }catch{return null}
}

async function mintTokenAccounts(rpc,mint,programId,decimals){
  const rows=await rpc.callOnce('getProgramAccounts',[
    programId,
    {
      commitment:'confirmed',
      encoding:'base64',
      filters:[{memcmp:{offset:0,bytes:mint}}],
      dataSlice:{offset:32,length:40}
    }
  ]);
  return (Array.isArray(rows)?rows:[])
    .map(row=>decodeHolderSlice(row,decimals))
    .filter(Boolean);
}

function aggregateWalletBalances(accounts,protocolAuthorities){
  const byWallet=new Map();
  for(const row of accounts){
    if(!(row.amount>0))continue;
    if(protocolAuthorities.has(row.authority))continue;
    byWallet.set(row.authority,(byWallet.get(row.authority)||0)+row.amount);
  }
  return byWallet;
}

export async function enrichHolders(mint,deps){
  const {rpc,store,evaluateAll,publish,enrichDiag,eventHolderLedger=null}=deps;
  const token=store.state.tokens[mint]||{};
  const decimals=Number(token.decimals??6);
  const total=Number(token.totalSupply||0);

  let accounts=[];
  let programUsed=TOKEN_PROGRAM;
  try{
    accounts=await mintTokenAccounts(rpc,mint,TOKEN_PROGRAM,decimals);
    if(!accounts.length){
      programUsed=TOKEN_2022_PROGRAM;
      accounts=await mintTokenAccounts(rpc,mint,TOKEN_2022_PROGRAM,decimals);
    }
  }catch(e){
    if(enrichDiag){
      enrichDiag.enrichStepFailures.getTokenLargestAccounts++;
      recordEnrichError(enrichDiag,mint,'getProgramAccounts(holder scan)',e);
    }
    if(isRateLimited(e)){
      const ra=/retry-after[:\s]+(\d+)/i.exec(e.message||'');
      return {rateLimited:true,retryAfter:ra?Number(ra[1])*1000:undefined};
    }
    throw e;
  }

  const protocolAuthorities=new Set(
    [token.curve,token.bondingCurve,token.associatedBondingCurve]
      .filter(x=>typeof x==='string'&&x.length>0)
  );

  const holderTokenAccountCount=accounts.filter(
    row=>row.amount>0&&!protocolAuthorities.has(row.authority)
  ).length;

  const walletBalances=aggregateWalletBalances(accounts,protocolAuthorities);
  const balances=[...walletBalances.values()].sort((a,b)=>b-a);
  const holderCount=balances.length;

  const top10Pct=total>0
    ? balances.slice(0,10).reduce((sum,n)=>sum+n,0)/total*100
    : null;

  const creator=token.creator||null;
  const creatorAmount=creator?(walletBalances.get(creator)||0):0;
  const developerPct=creator&&total>0?creatorAmount/total*100:null;

  // Seed the full unique-wallet baseline before the live TradeEvent ledger
  // continues applying incremental buys/sells.
  try{
    eventHolderLedger?.seedCanonicalBalances?.(
      mint,
      walletBalances,
      {decimals,creator,totalSupplyUi:total,tokenAccountCount:holderTokenAccountCount}
    );
  }catch(_){}


  const updated=store.setToken(mint,{
    holderFresh:true,
    holderCount,
    holderWalletCount:holderCount,
    holderTokenAccountCount,
    holderScannedAccountCount:accounts.length,
    top10Pct,
    developerPct,
    developerSharePct:developerPct,
    holderSource:'Solana getProgramAccounts unique-wallet scan',
    holderTokenProgram:programUsed,
    holderScannedAt:Date.now(),
    marketCap:token.marketCapSol??token.marketCap??null,
    liquidity:token.liquiditySol??token.liquidity??null,
    momentum:token.buyPressure??token.momentum??null
  });

  await evaluateAll(updated);
  publish(mint);
  return {rateLimited:false};
}

// ── Holder queue ─────────────────────────────────────────────────────────────


/* MEMEFLOW_V12_15_4_HOLDER_ACTIVE_SLOT_FIX
 * Fixes holder queue starvation caused by occupied/stale worker slots.
 * - active jobs are leased in a Map with start timestamps
 * - every job is bounded by a worker timeout
 * - slot release happens in finally and immediately kicks drain()
 * - watchdog reaps stale bookkeeping and kicks overdue pending work
 * - diagnostics expose active/pending ages without changing user filters
 */
export function makeHolderQueue(config,deps){
  /* MEMEFLOW_V12_16_1_HOLDER_THROUGHPUT_SAFE_FIX
   Raise holder worker capacity to a safe minimum of 4.
   Existing timeout/watchdog/retry/backoff logic is intentionally untouched. */
  const maxConcurrent=Math.max(1,Math.min(4,Number(config?.maxConcurrent??2)));
  const queueMax=Math.max(10,Number(config?.queueMax??500));
  const initialDelayMs=Math.min(10000,Math.max(0,Number(config?.initialDelayMs??750)));
  const retryDelayMs=Math.max(1000,Number(config?.retryDelayMs??30000));
  const maxRetries=Math.max(1,Number(config?.maxRetries??8));
  const jobTimeoutMs=Math.max(
    3000,
    Number(
      config?.jobTimeoutMs ??
      process.env.HOLDER_JOB_TIMEOUT_MS ??
      12000
    )
  );
  const watchdogMs=Math.max(
    100,
    Number(
      config?.watchdogMs ??
      process.env.HOLDER_QUEUE_WATCHDOG_MS ??
      250
    )
  );

  const {enrichHoldersFn,holderMetrics,admissionFn=null}=deps;

  const pending=new Map(); // mint -> {mint,retries,enqueuedAt,dueAt}
  const active=new Map();  // mint -> {mint,item,startedAt,leaseId}
  const history=new Map();

  let wakeTimer=null;
  let wakeAt=0;
  let leaseSeq=0;
  let draining=false;

  // Metrics are additive: older diagnostics remain compatible.
  holderMetrics.holderWorkerTimeouts ??= 0;
  holderMetrics.holderStaleSlotsReaped ??= 0;
  holderMetrics.holderWatchdogRuns ??= 0;
  holderMetrics.holderDrainRuns ??= 0;
  holderMetrics.holderDrainKicks ??= 0;
  holderMetrics.holderMaxObservedActive ??= 0;
  holderMetrics.holderMaxObservedPending ??= 0;

  function diagRow(mint){
    let row=history.get(mint);
    if(!row){
      row={
        mint,
        queuedAt:null,
        nextDueAt:null,
        attempts:0,
        lastAttemptAt:null,
        lastSuccessAt:null,
        lastError:null,
        lastErrorAt:null,
        rateLimited:0,
        retries:0,
        status:'unknown',
        activeStartedAt:null,
        activeEndedAt:null,
        lastDurationMs:null,
        workerTimeouts:0,
        priority:0,
        enqueueReason:null,
        lastAdmissionReason:null
      };
      history.set(mint,row);
    }
    return row;
  }

  function pruneHistory(){
    if(history.size<=2500)return;
    const rows=[...history.values()]
      .sort((a,b)=>(b.lastAttemptAt||b.queuedAt||0)-(a.lastAttemptAt||a.queuedAt||0));
    history.clear();
    for(const row of rows.slice(0,1200))history.set(row.mint,row);
  }

  function nextPendingDueAt(){
    let next=Infinity;
    for(const item of pending.values()){
      const due=Number(item?.dueAt||0);
      if(due<next)next=due;
    }
    return Number.isFinite(next)?next:null;
  }

  function scheduleWake(){
    if(!pending.size){
      if(wakeTimer){ clearTimeout(wakeTimer); wakeTimer=null; }
      wakeAt=0;
      return;
    }

    const next=nextPendingDueAt();
    if(next==null)return;

    if(wakeTimer && wakeAt && wakeAt<=next)return;
    if(wakeTimer){ clearTimeout(wakeTimer); wakeTimer=null; }

    wakeAt=next;
    wakeTimer=setTimeout(()=>{
      wakeTimer=null;
      wakeAt=0;
      kickDrain();
    },Math.max(0,next-Date.now()));
    wakeTimer.unref?.();
  }

  function dropOldest(){
    let oldest=null;
    for(const item of pending.values()){
      if(!oldest||item.enqueuedAt<oldest.enqueuedAt)oldest=item;
    }
    if(oldest){
      pending.delete(oldest.mint);
      holderMetrics.holderDropped++;
      const d=diagRow(oldest.mint);
      d.status='dropped';
      d.nextDueAt=null;
    }
  }

  function reschedule(item,delayMs){
    const base=Math.max(1000,Number(delayMs)||retryDelayMs);
    const exponential=Math.min(120000,base*Math.pow(2,Math.min(Number(item.retries||0),3)));
    const jitter=Math.floor(Math.random()*750);
    const next={
      ...item,
      retries:Number(item.retries||0)+1,
      dueAt:Date.now()+exponential+jitter
    };
    pending.set(item.mint,next);
    const d=diagRow(item.mint);
    d.retries=next.retries;
    d.nextDueAt=next.dueAt;
    d.status='queued';
    scheduleWake();
  }

  function timeoutPromise(ms,mint,leaseId){
    return new Promise((_,reject)=>{
      const t=setTimeout(()=>{
        const e=new Error('holder worker timeout after '+ms+'ms');
        e.code='HOLDER_WORKER_TIMEOUT';
        e.holderWorkerTimeout=true;
        e.mint=mint;
        e.leaseId=leaseId;
        reject(e);
      },ms);
      t.unref?.();
    });
  }

  function releaseLease(mint,leaseId,status){
    const lease=active.get(mint);
    if(!lease || lease.leaseId!==leaseId)return false;
    active.delete(mint);

    const d=diagRow(mint);
    const now=Date.now();
    d.activeEndedAt=now;
    d.lastDurationMs=d.activeStartedAt?Math.max(0,now-d.activeStartedAt):null;
    d.activeStartedAt=null;
    if(status)d.status=status;
    return true;
  }

  async function run(item){
    if(admissionFn){
      let gate=null;
      try{
        gate=admissionFn(item.mint)||{allow:true};
      }catch(e){
        holderMetrics.holderAdmissionErrors=(holderMetrics.holderAdmissionErrors||0)+1;
        gate={allow:true,reason:'admission_error_fail_open'};
      }

      const admissionRow=diagRow(item.mint);
      admissionRow.lastAdmissionReason=gate.reason||null;

      if(gate.allow===false){
        holderMetrics.lastHolderAdmissionReason=gate.reason||'deferred';
        if(gate.drop===true){
          holderMetrics.holderAdmissionDropped=(holderMetrics.holderAdmissionDropped||0)+1;
          const d=diagRow(item.mint);
          d.status='admission-dropped';
          d.nextDueAt=null;
          return;
        }

        holderMetrics.holderAdmissionDeferred=(holderMetrics.holderAdmissionDeferred||0)+1;
        const next={
          ...item,
          dueAt:Date.now()+Math.max(250,Number(gate.retryInMs||3000))
        };
        pending.set(item.mint,next);
        const d=diagRow(item.mint);
        d.status='queued';
        d.nextDueAt=next.dueAt;
        scheduleWake();
        return;
      }
      holderMetrics.holderAdmissionAllowed=(holderMetrics.holderAdmissionAllowed||0)+1;
    }

    // Reserve the slot BEFORE the first await.
    const leaseId=++leaseSeq;
    const startedAt=Date.now();
    active.set(item.mint,{mint:item.mint,item,startedAt,leaseId});
    holderMetrics.holderMaxObservedActive=Math.max(
      holderMetrics.holderMaxObservedActive||0,
      active.size
    );

    const d=diagRow(item.mint);
    d.attempts++;
    d.lastAttemptAt=startedAt;
    d.activeStartedAt=startedAt;
    d.status='running';
    d.nextDueAt=null;

    let finalStatus='failed';

    try{
      const result=await Promise.race([
        Promise.resolve().then(()=>enrichHoldersFn(item.mint)),
        timeoutPromise(jobTimeoutMs,item.mint,leaseId)
      ]);

      if(result?.rateLimited){
        holderMetrics.holderRateLimited++;
        d.rateLimited++;
        d.lastError='rate limited';
        d.lastErrorAt=Date.now();

        if(Number(item.retries||0)<maxRetries){
          holderMetrics.holderRetries++;
          reschedule(item,result.retryAfter??retryDelayMs);
          finalStatus='queued';
        }else{
          holderMetrics.holderFailed++;
          holderMetrics.lastHolderError='max retries exceeded on rate limit';
          holderMetrics.lastHolderErrorAt=Date.now();
          finalStatus='failed';
        }
      }else{
        holderMetrics.holderSucceeded++;
        holderMetrics.lastHolderError=null;
        d.lastSuccessAt=Date.now();
        d.lastError=null;
        d.lastErrorAt=null;
        finalStatus='success';
      }
    }catch(e){
      const timedOut=Boolean(e?.holderWorkerTimeout || e?.code==='HOLDER_WORKER_TIMEOUT');

      if(timedOut){
        holderMetrics.holderWorkerTimeouts++;
        d.workerTimeouts=(d.workerTimeouts||0)+1;
        d.lastError=sanitize(e?.message||'holder worker timeout');
        d.lastErrorAt=Date.now();

        if(Number(item.retries||0)<maxRetries){
          holderMetrics.holderRetries++;
          // Timeout retry is intentionally shorter than normal RPC backoff.
          reschedule(item,Math.min(retryDelayMs,5000));
          finalStatus='queued';
        }else{
          holderMetrics.holderFailed++;
          holderMetrics.lastHolderError=d.lastError;
          holderMetrics.lastHolderErrorAt=Date.now();
          finalStatus='failed';
        }
      }else if(Number(item.retries||0)<maxRetries && isRateLimited(e)){
        holderMetrics.holderRateLimited++;
        holderMetrics.holderRetries++;
        d.lastError=sanitize(e?.message||'rate limited');
        d.lastErrorAt=Date.now();
        reschedule(item,e?.retryAfterMs??retryDelayMs);
        finalStatus='queued';
      }else if(Number(item.retries||0)<maxRetries && isTransientHolderError(e)){
        holderMetrics.holderTransientRetries=(holderMetrics.holderTransientRetries||0)+1;
        holderMetrics.holderRetries++;
        d.lastError=sanitize(e?.message||'transient holder RPC error');
        d.lastErrorAt=Date.now();
        reschedule(item,Math.min(retryDelayMs,3000));
        finalStatus='queued';
      }else{
        holderMetrics.holderFailed++;
        holderMetrics.lastHolderError=sanitize(e?.message||'unknown');
        holderMetrics.lastHolderErrorAt=Date.now();
        d.lastError=holderMetrics.lastHolderError;
        d.lastErrorAt=Date.now();
        finalStatus='failed';
      }
    }finally{
      // Only the lease owner may free this slot.
      releaseLease(item.mint,leaseId,finalStatus);
      // Do not wait for the next timer. A newly freed slot should consume an overdue item now.
      kickDrain();
    }
  }

  function chooseDue(now){
    const rows=[...pending.values()].filter(item=>Number(item?.dueAt||0)<=now);
    if(!rows.length)return null;

    // First attempts before retries. Within first attempts, newest token first.
    rows.sort((a,b)=>{
      const ap=Number(a?.priority||0);
      const bp=Number(b?.priority||0);
      if(ap!==bp)return bp-ap;
      const ar=Number(a?.retries||0);
      const br=Number(b?.retries||0);
      if((ar===0)!==(br===0))return ar===0?-1:1;
      if(ar===0 && br===0)return Number(b?.enqueuedAt||0)-Number(a?.enqueuedAt||0);
      return Number(a?.dueAt||0)-Number(b?.dueAt||0);
    });
    return rows[0]||null;
  }

  function drain(){
    if(draining)return;
    draining=true;
    holderMetrics.holderDrainRuns++;

    try{
      const now=Date.now();

      while(active.size<maxConcurrent){
        const due=chooseDue(now);
        if(!due)break;

        pending.delete(due.mint);
        // run() reserves the active slot synchronously before its first await.
        void run(due);
      }

      holderMetrics.holderMaxObservedPending=Math.max(
        holderMetrics.holderMaxObservedPending||0,
        pending.size
      );
    }finally{
      draining=false;
      scheduleWake();
    }
  }

  function kickDrain(){
    holderMetrics.holderDrainKicks++;
    queueMicrotask(drain);
  }

  function enqueue(mint,options={}){
    if(!mint||pending.has(mint)||active.has(mint))return false;
    if(pending.size>=queueMax)dropOldest();

    const now=Date.now();
    const requestedDelay=Number(options?.delayMs);
    const delayMs=Number.isFinite(requestedDelay)?Math.max(0,Math.min(10000,requestedDelay)):initialDelayMs;
    const priority=Math.max(0,Math.min(1000,Number(options?.priority)||0));
    const enqueueReason=String(options?.reason||'').slice(0,120)||null;
    const item={mint,retries:0,enqueuedAt:now,dueAt:now+delayMs,priority,enqueueReason};
    pending.set(mint,item);

    const d=diagRow(mint);
    d.queuedAt=d.queuedAt||now;
    d.nextDueAt=item.dueAt;
    d.status='queued';
    d.retries=0;
    d.priority=priority;
    d.enqueueReason=enqueueReason;

    holderMetrics.holderQueued++;
    holderMetrics.holderMaxObservedPending=Math.max(holderMetrics.holderMaxObservedPending||0,pending.size);
    pruneHistory();
    scheduleWake();
    if(delayMs===0)kickDrain();
    return true;
  }

  // Independent safety net. It does NOT wait for the regular wake timer.
  const watchdog=setInterval(()=>{
    holderMetrics.holderWatchdogRuns++;
    const now=Date.now();

    // A lease should normally disappear via Promise.race + finally.
    // Reap only if bookkeeping somehow survives well beyond the configured timeout.
    for(const [mint,lease] of active){
      const age=now-Number(lease.startedAt||now);
      if(age>jobTimeoutMs+Math.max(1000,watchdogMs*4)){
        active.delete(mint);
        holderMetrics.holderStaleSlotsReaped++;

        const d=diagRow(mint);
        d.lastError='stale active slot reaped after '+age+'ms';
        d.lastErrorAt=now;
        d.activeEndedAt=now;
        d.lastDurationMs=age;
        d.activeStartedAt=null;
        d.status='stale-reaped';

        const item=lease.item;
        if(item && Number(item.retries||0)<maxRetries && !pending.has(mint)){
          holderMetrics.holderRetries++;
          reschedule(item,1000);
        }
      }
    }

    const next=nextPendingDueAt();
    if(next!=null && next<=now && active.size<maxConcurrent){
      kickDrain();
    }
  },watchdogMs);
  watchdog.unref?.();

  return {
    enqueue,
    drain:()=>kickDrain(),
    get queueDepth(){return pending.size},
    get processing(){return active.size},
    get activeCount(){return active.size},
    get pendingCount(){return pending.size},
    get jobTimeoutMs(){return jobTimeoutMs},
    get watchdogMs(){return watchdogMs},
    get oldestAgeMs(){
      if(!pending.size)return null;
      return Date.now()-Math.min(...[...pending.values()].map(x=>x.enqueuedAt));
    },
    get oldestActiveAgeMs(){
      if(!active.size)return null;
      return Date.now()-Math.min(...[...active.values()].map(x=>x.startedAt));
    },
    get nextDueInMs(){
      const next=nextPendingDueAt();
      return next==null?null:Math.max(0,next-Date.now());
    },
    activeSnapshot(){
      const now=Date.now();
      return [...active.values()].map(x=>({
        mint:x.mint,
        startedAt:x.startedAt,
        activeAgeMs:Math.max(0,now-x.startedAt),
        retries:Number(x.item?.retries||0),
        leaseId:x.leaseId
      }));
    },
    inspect(mint){
            const throughputFixVersion='V12.16.1';
const row=history.get(mint)||null;
      const p=pending.get(mint)||null;
      const a=active.get(mint)||null;
      const now=Date.now();

      return {
        ...(row||{mint,attempts:0,status:a?'running':'unknown'}),
        pending:Boolean(p),
        active:Boolean(a),
        activeStartedAt:a?.startedAt??row?.activeStartedAt??null,
        activeAgeMs:a?Math.max(0,now-a.startedAt):null,
        nextDueAt:p?.dueAt??row?.nextDueAt??null,
        nextDueInMs:p?Math.max(0,p.dueAt-now):null,
        queueRetries:p?.retries??row?.retries??0,
        priority:p?.priority??row?.priority??0,
        enqueueReason:p?.enqueueReason??row?.enqueueReason??null,
        lastAdmissionReason:row?.lastAdmissionReason??null,
        throughputFixVersion,
        configuredMaxConcurrent:maxConcurrent,
        queueDepth:pending.size,
        activeCount:active.size,
        workerTimeoutMs:jobTimeoutMs
      };
    }
  };
}


