#!/usr/bin/env bash
set -Eeuo pipefail
export GIT_PAGER=cat
export PAGER=cat

PATCH_NAME="MEMEFLOW_RUNTIME_TRUTH_V1_4_1_HOLDER_HOTFIX"
EXPECTED_HEAD="e4bf6dff62b5d8903cdb06346d0cd693977dad3b"
NEW_TEST="src/runtime-truth-v1_4_1-holder-hotfix.test.mjs"

log(){ printf '[PATCH] %s\n' "$*"; }
die(){ log "STOP: $*"; exit 1; }

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
[[ "$HEAD_NOW" == "$EXPECTED_HEAD" ]] || die "Expected baseline HEAD $EXPECTED_HEAD; current HEAD is $HEAD_NOW. Nothing changed."

TARGETS=(
  "app-server.mjs"
  "src/enrich.mjs"
  "src/solana.mjs"
  "src/pump-live-trade-feed.mjs"
)
for f in "${TARGETS[@]}"; do [[ -f "$f" ]] || die "Missing target file: $f"; done

grep -q "MEMEFLOW_RUNTIME_TRUTH_V1_4_EXACT" app-server.mjs || die "V1.4 runtime marker is missing from app-server.mjs."

# V1.4 intentionally did not stamp the global marker into enrich.mjs.
# Validate the exact V1.4 semantic anchors instead of requiring a nonexistent marker.
grep -Fq "holderTokenAccountCount" src/enrich.mjs || die "V1.4 holder dual-count anchor is missing from src/enrich.mjs."
grep -Fq "const maxConcurrent=Math.max(1,Math.min(4,Number(config?.maxConcurrent??2)))" src/enrich.mjs || die "V1.4 holder queue concurrency anchor is missing from src/enrich.mjs."
grep -Fq "rpc.callOnce('getProgramAccounts'" src/enrich.mjs || die "V1.4 queue-controlled holder RPC anchor is missing from src/enrich.mjs."

grep -q "pump-trade-event-60s-sol-flow" src/pump-live-trade-feed.mjs || die "V1.4 Pump live-flow marker is missing."
grep -q "const TIMEOUT=this.methodTimeoutMs(method);" src/solana.mjs || die "V1.4 RPC timeout policy is missing."
if grep -q "MEMEFLOW_RUNTIME_TRUTH_V1_4_1_HOLDER_HOTFIX" app-server.mjs; then die "V1.4.1 holder hotfix is already applied."; fi
[[ ! -e "$NEW_TEST" ]] || die "$NEW_TEST already exists. Nothing changed."

BACKUP=".memeflow-runtime-truth-v1.4.1-holder-hotfix-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/src"
for f in "${TARGETS[@]}"; do mkdir -p "$BACKUP/$(dirname "$f")"; cp "$f" "$BACKUP/$f"; done
rollback(){
  code=$?
  log "Validation failed. Restoring exact pre-hotfix files..."
  for f in "${TARGETS[@]}"; do cp "$BACKUP/$f" "$f" || true; done
  rm -f "$NEW_TEST"
  log "ROLLBACK COMPLETE. Backup kept at $BACKUP"
  exit "$code"
}
trap rollback ERR INT TERM

log "Applying $PATCH_NAME on top of successful V1.4..."

python3 - <<'PY'
from pathlib import Path
MARK="MEMEFLOW_RUNTIME_TRUTH_V1_4_1_HOLDER_HOTFIX"

def once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected exactly 1 anchor, found {count}")
    return text.replace(old,new,1)

# app-server.mjs
p=Path("app-server.mjs")
s=p.read_text(encoding="utf-8")
if MARK in s: raise SystemExit("app-server already contains V1.4.1 marker")

anchor='''function __mfSolUsdNow(){
  return __mfValidSolUsd(__mfSolUsd.price);
}
'''
helper='''function __mfSolUsdNow(){
  return __mfValidSolUsd(__mfSolUsd.price);
}

// MEMEFLOW_RUNTIME_TRUTH_V1_4_1_HOLDER_HOTFIX
// Currency conversion only: canonical token evidence remains Pump/Solana.
function __v141DecoratePumpUsd(token){
  if(!token||!__isPumpOriginToken(token))return token;
  const solUsd=__mfSolUsdNow();
  if(!Number.isFinite(Number(solUsd))||Number(solUsd)<=0)return token;

  const marketCapSol=Number(token?.marketCapSol??token?.marketCap);
  const liquiditySol=Number(token?.liquiditySol??token?.liquidity);
  const next={};

  if(Number.isFinite(marketCapSol)&&marketCapSol>=0){
    const marketCapUsd=marketCapSol*Number(solUsd);
    if(!Number.isFinite(Number(token.marketCapUsd))||
       Math.abs(Number(token.marketCapUsd)-marketCapUsd)>Math.max(0.01,marketCapUsd*0.0005)||
       String(token.marketCapUsdSource||'')!=='pump-sol-x-solusd'){
      next.marketCapUsd=marketCapUsd;
      next.marketCapUSD=marketCapUsd;
      next.marketCapUsdSource='pump-sol-x-solusd';
    }
  }

  if(Number.isFinite(liquiditySol)&&liquiditySol>=0){
    const liquidityUsd=liquiditySol*Number(solUsd);
    if(!Number.isFinite(Number(token.liquidityUsd))||
       Math.abs(Number(token.liquidityUsd)-liquidityUsd)>Math.max(0.01,liquidityUsd*0.0005)||
       String(token.liquidityUsdSource||'')!=='pump-sol-x-solusd'){
      next.liquidityUsd=liquidityUsd;
      next.liquidityUSD=liquidityUsd;
      next.liquidityUsdSource='pump-sol-x-solusd';
    }
  }

  if(!Object.keys(next).length)return token;
  next.solUsdReference=Number(solUsd);
  next.solUsdReferenceAt=Number(__mfSolUsd.updatedAt||Date.now());
  next.solUsdReferencePurpose='currency-conversion-only';
  return token?.mint?store.setToken(token.mint,next):{...token,...next};
}
'''
s=once(s,anchor,helper,"Pump USD conversion helper")

s=once(s,
'''function evaluateAll(token){
  return __evaluateAllBase(token);
}
''',
'''function evaluateAll(token){
  return __evaluateAllBase(__v141DecoratePumpUsd(token));
}
''',
"evaluation Pump USD decoration")

s=once(s,
"  const token=store.state.tokens[mint];\n  if(!token)return {allow:false,drop:true,reason:'token_missing'};",
"  const token=__v141DecoratePumpUsd(store.state.tokens[mint]);\n  if(!token)return {allow:false,drop:true,reason:'token_missing'};",
"holder admission Pump USD decoration")

s=once(s,
'''  try{ensurePriceTimer(mint,updated?.curve||updated?.bondingCurve||null)}catch{}
  try{if(updated?.creator)eventHolderLedger.setCreator(mint,updated.creator)}catch{}
  Promise.resolve(evaluateAll(updated)).catch(()=>{});
  try{publish(mint)}catch{}
}
''',
'''  try{ensurePriceTimer(mint,updated?.curve||updated?.bondingCurve||null)}catch{}
  try{if(updated?.creator)eventHolderLedger.setCreator(mint,updated.creator)}catch{}

  // MEMEFLOW_RUNTIME_TRUTH_V1_4_1_HOLDER_HOTFIX
  // A DEX-filter user cannot admit the token before confirmation. Confirmation
  // changes visibility, so canonical Pump/Solana holder enrichment must start now.
  try{
    const holderState=holderQueue.inspect?.(mint)||null;
    const holderReady=updated?.holderFresh===true&&Number.isFinite(Number(updated?.holderCount));
    if(!holderReady&&!holderState?.pending&&!holderState?.active){
      const queued=holderQueue.enqueue(mint,{priority:100,delayMs:0,reason:'dex-confirmed-visible-holder-bootstrap'});
      if(queued)fastPhaseMetrics.holderQueued++;
    }
  }catch(error){
    fastPhaseMetrics.bootstrapErrors++;
    fastPhaseMetrics.lastBootstrapError='dex-confirmed holder bootstrap: '+String(error?.message||error);
  }

  Promise.resolve(evaluateAll(updated)).catch(()=>{});
  try{publish(mint)}catch{}
}
''',
"DEX confirmation holder bootstrap")

s=once(s,
'''        if(!mint||!visible.has(mint)||!__isPumpOriginToken(token))return false;
        if(!__v13IsCanonicalHolderSource(token))return false;
        if(__v13HolderScanAge(token,now)<=__V13_HOLDER_MAX_AGE_MS)return false;

        const activity=__v13LastMarketActivity(token);
''',
'''        if(!mint||!visible.has(mint)||!__isPumpOriginToken(token))return false;

        const canonicalSource=__v13IsCanonicalHolderSource(token);
        const holderCount=Number(token?.holderCount);
        const holderMissing=token?.holderFresh!==true||!Number.isFinite(holderCount);
        const canonicalStale=canonicalSource&&__v13HolderScanAge(token,now)>__V13_HOLDER_MAX_AGE_MS;
        if(!holderMissing&&!canonicalStale)return false;

        const activity=__v13LastMarketActivity(token);
''',
"visible missing-holder reconciliation filter")

s=once(s,
'''      try{
        const result=await enrichHolders(
          mint,
          {rpc,store,evaluateAll,publish,enrichDiag,eventHolderLedger}
        );

        if(result?.rateLimited){
          __v13IntegrityMetrics.holderRefreshRateLimited++;
          continue;
        }

        const refreshed=store?.state?.tokens?.[mint]||null;
        const source=String(refreshed?.holderSource||'').toLowerCase();

        if(
          refreshed?.holderFresh===true&&
          Number.isFinite(Number(refreshed?.holderCount))&&
          source.includes('getprogramaccounts')
        ){
          __v13IntegrityMetrics.holderRefreshSucceeded++;
        }else{
          __v13IntegrityMetrics.holderRefreshFailed++;
        }
      }catch(error){
        __v13IntegrityMetrics.holderRefreshFailed++;
        __v13IntegrityMetrics.lastError='holder: '+String(error?.message||error).slice(0,180);
      }
''',
'''      try{
        const queued=holderQueue.enqueue(mint,{priority:90,delayMs:0,reason:'visible-missing-or-stale-holder-reconcile'});
        if(!queued){
          const state=holderQueue.inspect?.(mint)||null;
          if(!state?.pending&&!state?.active)__v13IntegrityMetrics.holderRefreshFailed++;
        }
      }catch(error){
        __v13IntegrityMetrics.holderRefreshFailed++;
        __v13IntegrityMetrics.lastError='holder: '+String(error?.message||error).slice(0,180);
      }
''',
"holder reconciliation through queue")

s=once(s,
'''const __V13_METADATA_TICK_MS=Math.max(
  30000,
  Number(process.env.METADATA_IMAGE_RETRY_TICK_MS||60000)
);
''',
'''const __V13_METADATA_TICK_MS=Math.max(
  3000,
  Number(process.env.METADATA_IMAGE_RETRY_TICK_MS||5000)
);
''',
"metadata worker cadence")

s=once(s,
'''const __V13_METADATA_BATCH=Math.max(
  1,
  Math.min(4,Number(process.env.METADATA_IMAGE_RETRY_BATCH||2))
);
''',
'''const __V13_METADATA_BATCH=Math.max(
  1,
  Math.min(6,Number(process.env.METADATA_IMAGE_RETRY_BATCH||4))
);

function __v141MetadataRetryDelay(attempts){
  const configured=Number(process.env.METADATA_IMAGE_RETRY_MS);
  if(Number.isFinite(configured)&&configured>0)return Math.max(5000,configured);
  const schedule=[5000,15000,45000,120000];
  return schedule[Math.min(Math.max(0,Number(attempts)||0),schedule.length-1)];
}
''',
"metadata retry schedule")

s=once(s,
"        const retryMs=Math.max(60000,Number(process.env.METADATA_IMAGE_RETRY_MS||300000));",
"        const retryMs=__v141MetadataRetryDelay(attempts);",
"metadata retry filter")

s=once(s,
'''    holderWalletCount:finite(t.holderWalletCount??t.holderCount),
    holderTokenAccountCount:finite(t.holderTokenAccountCount),
    holderSource:t.holderSource||null,
    top10:top10Pct,
''',
'''    holderWalletCount:finite(t.holderWalletCount??t.holderCount),
    holderTokenAccountCount:finite(t.holderTokenAccountCount),
    holderSource:t.holderSource||null,
    holderPipeline:(()=>{
      const q=holderQueue.inspect?.(d.mint)||null;
      return q?{
        status:q.status||null,
        pending:q.pending===true,
        active:q.active===true,
        attempts:Number(q.attempts||0),
        retries:Number(q.queueRetries??q.retries??0),
        priority:Number(q.priority||0),
        reason:q.enqueueReason||q.lastAdmissionReason||null,
        lastAdmissionReason:q.lastAdmissionReason||null,
        lastError:q.lastError||null,
        nextDueInMs:q.nextDueInMs??null
      }:null;
    })(),
    top10:top10Pct,
''',
"candidate holder pipeline diagnostics")

p.write_text(s,encoding="utf-8")

# enrich.mjs
p=Path("src/enrich.mjs")
s=p.read_text(encoding="utf-8")
if MARK in s: raise SystemExit("enrich already contains V1.4.1 marker")

rate='''function isRateLimited(e) {
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
'''
rate_new=rate+'''\n// MEMEFLOW_RUNTIME_TRUTH_V1_4_1_HOLDER_HOTFIX
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
'''
s=once(s,rate,rate_new,"holder transient classifier")

s=once(s,
'''  const maxAttempts=Math.max(1,Number(process.env.METADATA_IMAGE_RETRY_MAX||4));
  const retryMs=Math.max(60000,Number(process.env.METADATA_IMAGE_RETRY_MS||300000));
  const attempts=Math.max(0,Number(token.metadataImageRetryCount||0));
''',
'''  const maxAttempts=Math.max(1,Number(process.env.METADATA_IMAGE_RETRY_MAX||4));
  const attempts=Math.max(0,Number(token.metadataImageRetryCount||0));
  const configuredRetryMs=Number(process.env.METADATA_IMAGE_RETRY_MS);
  const retrySchedule=[5000,15000,45000,120000];
  const retryMs=Number.isFinite(configuredRetryMs)&&configuredRetryMs>0
    ? Math.max(5000,configuredRetryMs)
    : retrySchedule[Math.min(attempts,retrySchedule.length-1)];
''',
"metadata fetch retry schedule")

s=once(s,
'''        workerTimeouts:0
''',
'''        workerTimeouts:0,
        priority:0,
        enqueueReason:null,
        lastAdmissionReason:null
''',
"holder queue diagnostics")

s=once(s,
'''      if(gate.allow===false){
        holderMetrics.lastHolderAdmissionReason=gate.reason||'deferred';
''',
'''      const admissionRow=diagRow(item.mint);
      admissionRow.lastAdmissionReason=gate.reason||null;

      if(gate.allow===false){
        holderMetrics.lastHolderAdmissionReason=gate.reason||'deferred';
''',
"per-mint admission diagnostics")

s=once(s,
'''      }else if(Number(item.retries||0)<maxRetries && isRateLimited(e)){
        holderMetrics.holderRateLimited++;
        holderMetrics.holderRetries++;
        d.lastError=sanitize(e?.message||'rate limited');
        d.lastErrorAt=Date.now();
        reschedule(item,e?.retryAfterMs??retryDelayMs);
        finalStatus='queued';
      }else{
''',
'''      }else if(Number(item.retries||0)<maxRetries && isRateLimited(e)){
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
''',
"transient holder retry")

s=once(s,
'''    rows.sort((a,b)=>{
      const ar=Number(a?.retries||0);
      const br=Number(b?.retries||0);
''',
'''    rows.sort((a,b)=>{
      const ap=Number(a?.priority||0);
      const bp=Number(b?.priority||0);
      if(ap!==bp)return bp-ap;
      const ar=Number(a?.retries||0);
      const br=Number(b?.retries||0);
''',
"holder priority ordering")

s=once(s,
'''  function enqueue(mint){
    if(!mint||pending.has(mint)||active.has(mint))return false;
    if(pending.size>=queueMax)dropOldest();

    const now=Date.now();
    const item={mint,retries:0,enqueuedAt:now,dueAt:now+initialDelayMs};
    pending.set(mint,item);

    const d=diagRow(mint);
    d.queuedAt=d.queuedAt||now;
    d.nextDueAt=item.dueAt;
    d.status='queued';
    d.retries=0;

    holderMetrics.holderQueued++;
    holderMetrics.holderMaxObservedPending=Math.max(
      holderMetrics.holderMaxObservedPending||0,
      pending.size
    );

    pruneHistory();
    scheduleWake();

    // If delay is already due (or turns due before another event), give drain an immediate chance.
    if(initialDelayMs===0)kickDrain();
    return true;
  }
''',
'''  function enqueue(mint,options={}){
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
''',
"priority holder enqueue")

s=once(s,
'''        queueRetries:p?.retries??row?.retries??0,
        throughputFixVersion,
''',
'''        queueRetries:p?.retries??row?.retries??0,
        priority:p?.priority??row?.priority??0,
        enqueueReason:p?.enqueueReason??row?.enqueueReason??null,
        lastAdmissionReason:row?.lastAdmissionReason??null,
        throughputFixVersion,
''',
"holder inspect diagnostics")

p.write_text(s,encoding="utf-8")

# solana.mjs
p=Path("src/solana.mjs")
s=p.read_text(encoding="utf-8")
s=once(s,
"      getProgramAccounts:Math.max(1500,Number(process.env.RPC_GET_PROGRAM_ACCOUNTS_MIN_INTERVAL_MS||3500)),",
"      getProgramAccounts:Math.max(500,Number(process.env.RPC_GET_PROGRAM_ACCOUNTS_MIN_INTERVAL_MS||1200)), // MEMEFLOW_RUNTIME_TRUTH_V1_4_1_HOLDER_HOTFIX",
"adaptive GPA pacing")
p.write_text(s,encoding="utf-8")

# pump-live-trade-feed.mjs
p=Path("src/pump-live-trade-feed.mjs")
s=p.read_text(encoding="utf-8")
s=once(s,
'''      if(Number.isFinite(market.priceSol)&&market.priceSol>0)patch.priceSol=market.priceSol;
      if(Number.isFinite(market.liquiditySol)&&market.liquiditySol>=0)patch.liquiditySol=market.liquiditySol;

      const updated=store?.setToken?.(e.mint,patch);
''',
'''      if(Number.isFinite(market.priceSol)&&market.priceSol>0){
        patch.priceSol=market.priceSol;
        const supply=Number(knownToken?.totalSupply);
        if(Number.isFinite(supply)&&supply>0){
          const marketCapSol=market.priceSol*supply;
          patch.marketCapSol=marketCapSol;
          patch.marketCap=marketCapSol;
        }
      }
      if(Number.isFinite(market.liquiditySol)&&market.liquiditySol>=0){
        patch.liquiditySol=market.liquiditySol;
        patch.liquidity=market.liquiditySol;
      }

      const updated=store?.setToken?.(e.mint,patch);
''',
"Pump live market aliases")
p.write_text(s,encoding="utf-8")

# Regression tests
Path("src/runtime-truth-v1_4_1-holder-hotfix.test.mjs").write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeHolderQueue,makeHolderMetrics} from './enrich.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('priority zero-delay holder jobs run before normal delayed jobs',async()=>{
  const order=[];
  const metrics=makeHolderMetrics();
  const queue=makeHolderQueue(
    {maxConcurrent:1,queueMax:20,initialDelayMs:80,retryDelayMs:1000,maxRetries:2,jobTimeoutMs:2000,watchdogMs:50},
    {holderMetrics:metrics,admissionFn:()=>({allow:true,reason:'test'}),enrichHoldersFn:async mint=>{order.push(mint);return {rateLimited:false};}}
  );
  queue.enqueue('normal',{priority:0,delayMs:80,reason:'normal'});
  queue.enqueue('dex-visible',{priority:100,delayMs:0,reason:'dex-confirmed'});
  await sleep(180);
  assert.equal(order[0],'dex-visible');
  assert.ok(order.includes('normal'));
  assert.equal(queue.inspect('dex-visible').priority,100);
});

test('DEX confirmation bootstraps canonical holders',()=>{
  const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
  assert.match(app,/dex-confirmed-visible-holder-bootstrap/);
  assert.match(app,/priority:100,delayMs:0/);
});

test('visible missing holders are reconciled',()=>{
  const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
  assert.match(app,/const holderMissing=/);
  assert.match(app,/visible-missing-or-stale-holder-reconcile/);
});

test('Pump SOL metrics are converted for USD gates',()=>{
  const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
  assert.match(app,/function __v141DecoratePumpUsd/);
  assert.match(app,/marketCapUsdSource='pump-sol-x-solusd'/);
  assert.match(app,/__evaluateAllBase\(__v141DecoratePumpUsd\(token\)\)/);
});

test('holder GPA pacing is faster and still cooldown protected',()=>{
  const solana=fs.readFileSync(new URL('./solana.mjs',import.meta.url),'utf8');
  assert.match(solana,/RPC_GET_PROGRAM_ACCOUNTS_MIN_INTERVAL_MS\|\|1200/);
  assert.match(solana,/_globalCooldownUntil/);
  assert.match(solana,/_noteProviderCooldown/);
});

test('transient holder RPC failures are retried',()=>{
  const enrich=fs.readFileSync(new URL('./enrich.mjs',import.meta.url),'utf8');
  assert.match(enrich,/function isTransientHolderError/);
  assert.match(enrich,/holderTransientRetries/);
});

test('fresh metadata image retries use seconds-scale schedule',()=>{
  const enrich=fs.readFileSync(new URL('./enrich.mjs',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
  assert.match(enrich,/retrySchedule=\[5000,15000,45000,120000\]/);
  assert.match(app,/METADATA_IMAGE_RETRY_TICK_MS\|\|5000/);
});

test('Pump live events publish market cap and liquidity aliases',()=>{
  const live=fs.readFileSync(new URL('./pump-live-trade-feed.mjs',import.meta.url),'utf8');
  assert.match(live,/patch\.marketCapSol=marketCapSol/);
  assert.match(live,/patch\.liquidity=market\.liquiditySol/);
});
''',encoding="utf-8")
PY

log "Syntax validation..."
for f in "${TARGETS[@]}" "$NEW_TEST"; do node --check "$f"; done

log "V1.4.1 holder hotfix tests..."
node --test "$NEW_TEST"

log "V1.4 + V1.3 + V1.2 regression suite..."
node --test \
  src/runtime-truth-v1_4-exact.test.mjs \
  src/data-integrity-v1_3-exact.test.mjs \
  src/filter-upgrade.test.mjs \
  src/unified-decision.test.mjs \
  src/candidate-visibility-lifecycle.test.mjs \
  src/paper-fee-reserve.test.mjs \
  src/openai-policy.test.mjs \
  "$NEW_TEST"

log "Existing integration suite..."
npm test

log "Diff sanity..."
git --no-pager diff --check

grep -q "MEMEFLOW_RUNTIME_TRUTH_V1_4_1_HOLDER_HOTFIX" app-server.mjs
grep -q "dex-confirmed-visible-holder-bootstrap" app-server.mjs
grep -q "visible-missing-or-stale-holder-reconcile" app-server.mjs
grep -q "function isTransientHolderError" src/enrich.mjs
grep -q "RPC_GET_PROGRAM_ACCOUNTS_MIN_INTERVAL_MS||1200" src/solana.mjs

trap - ERR INT TERM
log "SUCCESS: $PATCH_NAME applied and all tests passed."
log "Backup: $BACKUP"
log "Key behavior:"
log "  - DEX-filter visibility immediately triggers canonical Pump/Solana holder enrichment"
log "  - visible tokens with missing/provisional holder evidence are automatically repaired"
log "  - holder queue supports immediate priority jobs for newly visible candidates"
log "  - getProgramAccounts starts are paced at 1.2s by default with existing 429 cooldown protection"
log "  - transient holder RPC failures are retried instead of becoming permanent WAITING rows"
log "  - Pump-native market cap/liquidity are converted for USD gates without token DEX market data"
log "  - fresh token metadata images retry at 5s/15s/45s/120s"
log "  - candidate diagnostics expose holder queue status, reason, attempts and last error"
log ""
log "Restart the Replit workflow/app after SUCCESS."
