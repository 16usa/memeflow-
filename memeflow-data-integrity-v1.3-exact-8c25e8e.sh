#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT"
EXPECTED_HEAD="8c25e8edc5280b5e1d46c2f632f0c3041b0337d1"
NEW_TEST="src/data-integrity-v1_3-exact.test.mjs"

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
[[ "$HEAD_NOW" == "$EXPECTED_HEAD" ]] || die "Expected exact baseline $EXPECTED_HEAD; current HEAD is $HEAD_NOW. Nothing changed."

declare -A EXPECTED_BLOBS=(
  ["app-server.mjs"]="75e6ef725880a6c8398e93387d8a0757853cf032"
  ["src/evaluate.mjs"]="1b59c62b2900319f1f1266cd5f623ee3f4198096"
  ["src/enrich.mjs"]="95d253cf8caf0127d7c2db046a4fa7cfee664705"
  ["src/event-holder-ledger.mjs"]="6a4c66b1c85e26cb414a64da21268bf4070f44cf"
)

TARGETS=(
  "app-server.mjs"
  "src/evaluate.mjs"
  "src/enrich.mjs"
  "src/event-holder-ledger.mjs"
)

for f in "${TARGETS[@]}"; do
  [[ -f "$f" ]] || die "Missing target file: $f"
  git diff --quiet -- "$f" || die "$f has unstaged changes. Nothing changed."
  git diff --cached --quiet -- "$f" || die "$f has staged changes. Nothing changed."
  got="$(git hash-object "$f")"
  [[ "$got" == "${EXPECTED_BLOBS[$f]}" ]] || die "$f differs from audited baseline ($got != ${EXPECTED_BLOBS[$f]}). Nothing changed."
done

[[ ! -e "$NEW_TEST" ]] || die "$NEW_TEST already exists. Nothing changed."

BACKUP=".memeflow-data-integrity-v1.3-exact-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/src"
for f in "${TARGETS[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  code=$?
  log "Validation failed. Restoring exact pre-patch files..."
  for f in "${TARGETS[@]}"; do cp "$BACKUP/$f" "$f" || true; done
  rm -f "$NEW_TEST"
  log "ROLLBACK COMPLETE. Backup kept at $BACKUP"
  exit "$code"
}
trap rollback ERR INT TERM

log "Applying $PATCH_NAME to exact pushed baseline $EXPECTED_HEAD..."

python3 - <<'PY'
from pathlib import Path

MARK="MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT"

def once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected exactly 1 anchor, found {count}")
    return text.replace(old,new,1)

# ---------------------------------------------------------------------------
# 1) HOLDER LEDGER
# A canonical getProgramAccounts census is authoritative only for a bounded
# period. Pump TradeEvents may update the seeded map between scans, but they
# must never refresh the age of the canonical census itself.
# ---------------------------------------------------------------------------
p=Path("src/event-holder-ledger.mjs")
s=p.read_text(encoding="utf-8")
if MARK in s:
    raise SystemExit("event-holder-ledger already contains V1.3 exact marker")

anchor="const SAVE_INTERVAL_MS=Math.max(1000,Number(process.env.EVENT_HOLDER_SAVE_INTERVAL_MS||5000));"
s=once(
    s,
    anchor,
    anchor+"\nconst HOLDER_CANONICAL_MAX_AGE_MS=Math.max(60000,Number(process.env.HOLDER_CANONICAL_MAX_AGE_MS||180000)); // "+MARK,
    "event-holder canonical age constant"
)

start=s.find("  snapshot(m){")
end=s.find("\n  applyToStore(store,m){",start)
if start<0 or end<0:
    raise SystemExit("event-holder snapshot function anchor missing")

snapshot=r'''  snapshot(m){
    // MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT
    // TradeEvent deltas do not renew the authoritative census timestamp.
    const r=this.byMint.get(m);
    if(!r)return null;

    const holders=[...r.balances]
      .filter(([,a])=>a>0n)
      .sort((a,b)=>a[1]===b[1]?0:(a[1]>b[1]?-1:1));

    const totalSupply=supplyRaw(r.decimals??6);
    const top10=holders.slice(0,10).reduce((sum,[,amount])=>sum+amount,0n);
    const dev=r.creator?(r.balances.get(r.creator)||0n):0n;
    const tracked=holders.reduce((sum,[,amount])=>sum+amount,0n);
    const now=Date.now();
    const canonicalSeedAt=Number(r.canonicalSeedAt||0);
    const canonicalAgeMs=canonicalSeedAt>0?Math.max(0,now-canonicalSeedAt):null;
    const canonicalFresh=canonicalSeedAt>0&&canonicalAgeMs<=HOLDER_CANONICAL_MAX_AGE_MS;

    return {
      mint:m,
      holderFresh:canonicalFresh,
      holderSource:canonicalFresh
        ? 'Solana getProgramAccounts baseline + live Pump TradeEvent delta'
        : (canonicalSeedAt>0?'canonical-refresh-pending':'event-ledger-user-only-provisional'),
      holderCount:canonicalFresh?holders.length:null,
      top10Pct:canonicalFresh?pct(top10,totalSupply):null,
      developerPct:canonicalFresh&&r.creator?pct(dev,totalSupply):null,
      developerSharePct:canonicalFresh&&r.creator?pct(dev,totalSupply):null,
      holderScannedAt:canonicalSeedAt||null,
      holderCanonicalSeedAt:canonicalSeedAt||null,
      holderCanonicalAgeMs:canonicalAgeMs,
      holderCanonicalFresh:canonicalFresh,
      holderObservedWallets:holders.length,
      holderLastTradeEventAt:r.lastSeenAt||null,
      eventLedgerVersion:VERSION,
      eventLedgerLastUser:r.lastUser||null,
      eventLedgerTxCount:r.txCount,
      eventLedgerCreator:r.creator,
      eventLedgerTrackedSupplyRaw:tracked.toString(),
      eventLedgerTotalSupplyRaw:totalSupply.toString(),
      eventLedgerDecimals:r.decimals??6,
      eventLedgerCoveragePct:pct(tracked,totalSupply)
    };
  }
'''
s=s[:start]+snapshot+s[end:]

diag_anchor="      saveIntervalMs:SAVE_INTERVAL_MS,"
s=once(
    s,
    diag_anchor,
    diag_anchor+"\n      canonicalMaxAgeMs:HOLDER_CANONICAL_MAX_AGE_MS,",
    "event-holder diagnostics"
)
p.write_text(s,encoding="utf-8")

# ---------------------------------------------------------------------------
# 2) EVALUATOR
# Fail closed when a canonical holder census is stale, and hard-block a token
# that has already collapsed >= configured drawdown from MEMEFLOW's own peak.
# ---------------------------------------------------------------------------
p=Path("src/evaluate.mjs")
s=p.read_text(encoding="utf-8")
if MARK in s:
    raise SystemExit("evaluate already contains V1.3 exact marker")

list_anchor="const list=v=>String(v??'').split(/[\\n,]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);"
helper=r'''
const __MF_HOLDER_CANONICAL_MAX_AGE_MS=Math.max(
  60000,
  Number(process.env.HOLDER_CANONICAL_MAX_AGE_MS||180000)
); // MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT

function __mfV13EffectiveEvidence(token={},now=Date.now()){
  const source=String(token?.holderSource||'').toLowerCase();
  const canonicalSource=
    source.includes('getprogramaccounts')||
    source.includes('baseline + live')||
    source.includes('canonical');
  const scanned=firstFinite(token.holderCanonicalSeedAt,token.holderScannedAt);
  const canonicalAgeMs=scanned!==null&&scanned>0
    ? Math.max(0,Number(now)-Number(scanned))
    : null;
  const stale=
    token?.holderFresh===true&&
    canonicalSource&&
    canonicalAgeMs!==null&&
    canonicalAgeMs>__MF_HOLDER_CANONICAL_MAX_AGE_MS;

  if(!stale)return token;

  return {
    ...token,
    holderFresh:false,
    holderCount:null,
    holders:null,
    top10Pct:null,
    top10:null,
    developerPct:null,
    developerSharePct:null,
    creatorPct:null,
    holderEvidenceStale:true,
    holderCanonicalAgeMs:canonicalAgeMs
  };
}
'''
s=once(s,list_anchor,list_anchor+"\n"+helper,"evaluate evidence helper")

base_anchor="function __mfEvaluateBaseV11(token,s={}){\n  const reasons=[],gates=[];let waiting=false,blocked=false;"
s=once(
    s,
    base_anchor,
    "function __mfEvaluateBaseV11(token,s={}){\n  token=__mfV13EffectiveEvidence(token);\n  const reasons=[],gates=[];let waiting=false,blocked=false;",
    "evaluate base entry"
)

s=once(
    s,
    "  const ai=independentAiScore(token),score=ai.score;",
    "  const ai=independentAiScore(token);\n  let score=ai.score;",
    "evaluate mutable score"
)

collapse_anchor="  addGate('Verified price',v.price===null?null:v.price>0,'price unavailable',{value:v.price});"
collapse=r'''  // MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT
  // Catastrophic drawdown is a hard market-integrity failure.
  const __mfCurrentPrice=finite(token?.priceSol)?Number(token.priceSol):null;
  const __mfPeakPrice=finite(token?.peakPriceSol)?Number(token.peakPriceSol):null;
  const __mfConfiguredCollapse=Number(process.env.MEMEFLOW_COLLAPSE_DRAWDOWN_PCT);
  const __mfCollapseLimit=Number.isFinite(__mfConfiguredCollapse)
    ? Math.max(50,Math.min(99,__mfConfiguredCollapse))
    : 90;
  const __mfDrawdownPct=
    __mfCurrentPrice!==null&&__mfCurrentPrice>0&&
    __mfPeakPrice!==null&&__mfPeakPrice>0&&
    __mfPeakPrice>=__mfCurrentPrice
      ? (1-__mfCurrentPrice/__mfPeakPrice)*100
      : null;

  if(__mfDrawdownPct!==null){
    const __mfNotCollapsed=__mfDrawdownPct<__mfCollapseLimit;
    addGate(
      'Peak drawdown safety',
      __mfNotCollapsed,
      `token collapsed ${__mfDrawdownPct.toFixed(1)}% from observed peak`,
      {value:__mfDrawdownPct,threshold:__mfCollapseLimit,operator:'<'}
    );
    if(!__mfNotCollapsed)score=Math.min(score,20);
  }

'''
s=once(s,collapse_anchor,collapse+collapse_anchor,"evaluate collapse gate")
p.write_text(s,encoding="utf-8")

# ---------------------------------------------------------------------------
# 3) METADATA RETRY
# Retry missing images independently from the heavy on-chain holder/price path.
# ---------------------------------------------------------------------------
p=Path("src/enrich.mjs")
s=p.read_text(encoding="utf-8")
if MARK in s:
    raise SystemExit("enrich already contains V1.3 exact marker")

helpers_marker="\n\n\n// ── Helpers ───────────────────────────────────────────────────────────────────"
if helpers_marker not in s:
    raise SystemExit("enrich metadata helper boundary missing")

metadata_refresh=r'''

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
  const retryMs=Math.max(60000,Number(process.env.METADATA_IMAGE_RETRY_MS||300000));
  const attempts=Math.max(0,Number(token.metadataImageRetryCount||0));
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
'''
s=s.replace(helpers_marker,metadata_refresh+helpers_marker,1)
p.write_text(s,encoding="utf-8")

# ---------------------------------------------------------------------------
# 4) RUNTIME RECONCILIATION
# Periodically refresh stale canonical holder censuses for currently visible
# decisions, and retry metadata images with a bounded lightweight worker.
# ---------------------------------------------------------------------------
p=Path("app-server.mjs")
s=p.read_text(encoding="utf-8")
if MARK in s:
    raise SystemExit("app-server already contains V1.3 exact marker")

old_import="import {enrichToken,enrichHolders,makeEnrichDiag,makeHolderQueue,makeHolderMetrics} from './src/enrich.mjs';"
new_import="import {enrichToken,enrichHolders,refreshTokenMetadata,makeEnrichDiag,makeHolderQueue,makeHolderMetrics} from './src/enrich.mjs';"
s=once(s,old_import,new_import,"app-server enrich import")

bridge_marker="/* MEMEFLOW_V12_DISCOVERY_ENRICHMENT_BRIDGE"
if bridge_marker not in s:
    raise SystemExit("app-server bridge marker missing")

runtime=r'''
/* MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT
   Runtime truth reconciliation:
   - a getProgramAccounts holder census expires after a bounded age
   - visible candidates are re-baselined from Solana without trusting accumulated deltas forever
   - missing metadata images use a separate bounded HTTP retry path
*/
const __V13_HOLDER_MAX_AGE_MS=Math.max(
  60000,
  Number(process.env.HOLDER_CANONICAL_MAX_AGE_MS||180000)
);
const __V13_HOLDER_RECONCILE_TICK_MS=Math.max(
  10000,
  Number(process.env.HOLDER_RECONCILE_TICK_MS||20000)
);
const __V13_HOLDER_RECONCILE_ACTIVITY_MS=Math.max(
  __V13_HOLDER_MAX_AGE_MS,
  Number(process.env.HOLDER_RECONCILE_ACTIVITY_MS||900000)
);
const __V13_HOLDER_RECONCILE_BATCH=Math.max(
  1,
  Math.min(4,Number(process.env.HOLDER_RECONCILE_BATCH||2))
);

const __v13IntegrityMetrics={
  holderRuns:0,
  holderQueuedForRefresh:0,
  holderRefreshSucceeded:0,
  holderRefreshFailed:0,
  holderRefreshRateLimited:0,
  metadataRuns:0,
  metadataAttempted:0,
  metadataImageRecovered:0,
  metadataFailed:0,
  lastHolderMint:null,
  lastMetadataMint:null,
  lastError:null
};

let __v13HolderRunActive=false;
let __v13MetadataRunActive=false;

function __v13VisibleMints(){
  const out=new Set();
  for(const decision of Object.values(store?.state?.decisions||{})){
    const mint=String(decision?.mint||'').trim();
    if(!mint)continue;
    if(['BUY READY','WATCH','WAITING'].includes(String(decision?.state||''))){
      out.add(mint);
    }
  }
  return out;
}

function __v13HolderScanAge(token,now=Date.now()){
  const scanned=Number(token?.holderCanonicalSeedAt||token?.holderScannedAt||0);
  return scanned>0?Math.max(0,now-scanned):Infinity;
}

function __v13LastMarketActivity(token){
  return Math.max(
    Number(token?.lastMarketActivityAt||0),
    Number(token?.lastPriceAt||0),
    Number(token?.updatedAt||0),
    Number(token?.discoveredAt||0)
  );
}

function __v13IsCanonicalHolderSource(token){
  const source=String(token?.holderSource||'').toLowerCase();
  return (
    source.includes('getprogramaccounts')||
    source.includes('baseline + live')||
    source.includes('canonical-refresh-pending')
  );
}

async function __v13RunHolderReconcile(){
  if(__v13HolderRunActive)return;
  __v13HolderRunActive=true;
  __v13IntegrityMetrics.holderRuns++;

  try{
    const now=Date.now();
    const visible=__v13VisibleMints();

    const rows=Object.values(store?.state?.tokens||{})
      .filter(token=>{
        const mint=String(token?.mint||'').trim();
        if(!mint||!visible.has(mint)||!__isPumpOriginToken(token))return false;
        if(!__v13IsCanonicalHolderSource(token))return false;
        if(__v13HolderScanAge(token,now)<=__V13_HOLDER_MAX_AGE_MS)return false;

        const activity=__v13LastMarketActivity(token);
        if(activity>0&&now-activity>__V13_HOLDER_RECONCILE_ACTIVITY_MS)return false;

        const queueState=holderQueue.inspect?.(mint)||null;
        if(queueState?.pending||queueState?.active)return false;
        return true;
      })
      .sort((a,b)=>__v13HolderScanAge(b,now)-__v13HolderScanAge(a,now))
      .slice(0,__V13_HOLDER_RECONCILE_BATCH);

    for(const token of rows){
      const mint=String(token.mint);
      __v13IntegrityMetrics.holderQueuedForRefresh++;
      __v13IntegrityMetrics.lastHolderMint=mint;

      const oldScanAt=Number(token?.holderCanonicalSeedAt||token?.holderScannedAt||0)||null;

      const pending=store.setToken(mint,{
        holderFresh:false,
        holderCount:null,
        holders:null,
        top10Pct:null,
        top10:null,
        developerPct:null,
        developerSharePct:null,
        creatorPct:null,
        holderSource:'canonical-refresh-pending',
        holderScannedAt:oldScanAt,
        holderCanonicalSeedAt:oldScanAt,
        holderCanonicalAgeMs:oldScanAt?Math.max(0,Date.now()-oldScanAt):null
      });

      await Promise.resolve(evaluateAll(pending)).catch(()=>{});
      try{publish(mint)}catch{}

      try{
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
    }
  }finally{
    __v13HolderRunActive=false;
  }
}

const __v13HolderTimer=setInterval(
  ()=>void __v13RunHolderReconcile(),
  __V13_HOLDER_RECONCILE_TICK_MS
);
__v13HolderTimer.unref?.();

setTimeout(
  ()=>void __v13RunHolderReconcile(),
  Math.min(10000,__V13_HOLDER_RECONCILE_TICK_MS)
).unref?.();

const __V13_METADATA_TICK_MS=Math.max(
  30000,
  Number(process.env.METADATA_IMAGE_RETRY_TICK_MS||60000)
);
const __V13_METADATA_MAX_TOKEN_AGE_MS=Math.max(
  300000,
  Number(process.env.METADATA_IMAGE_RETRY_TOKEN_MAX_AGE_MS||7200000)
);
const __V13_METADATA_BATCH=Math.max(
  1,
  Math.min(4,Number(process.env.METADATA_IMAGE_RETRY_BATCH||2))
);

async function __v13RunMetadataRetry(){
  if(__v13MetadataRunActive)return;
  __v13MetadataRunActive=true;
  __v13IntegrityMetrics.metadataRuns++;

  try{
    const now=Date.now();
    const visible=__v13VisibleMints();

    const rows=Object.values(store?.state?.tokens||{})
      .filter(token=>{
        const mint=String(token?.mint||'').trim();
        if(!mint||!visible.has(mint))return false;
        if(token?.imageUrl||token?.image||token?.logoUrl)return false;
        if(!(token?.uri||token?.metadataUri))return false;

        const discovered=Number(token?.discoveredAt||token?.createdAt||0);
        if(discovered>0&&now-discovered>__V13_METADATA_MAX_TOKEN_AGE_MS)return false;

        const attempts=Math.max(0,Number(token?.metadataImageRetryCount||0));
        const maxAttempts=Math.max(1,Number(process.env.METADATA_IMAGE_RETRY_MAX||4));
        if(attempts>=maxAttempts)return false;

        const retryMs=Math.max(60000,Number(process.env.METADATA_IMAGE_RETRY_MS||300000));
        const last=Number(token?.metadataImageRetryAt||token?.metadataFetchedAt||0);
        if(last>0&&now-last<retryMs)return false;

        return true;
      })
      .sort((a,b)=>Number(b?.discoveredAt||0)-Number(a?.discoveredAt||0))
      .slice(0,__V13_METADATA_BATCH);

    for(const token of rows){
      const mint=String(token.mint);
      __v13IntegrityMetrics.lastMetadataMint=mint;

      try{
        const result=await refreshTokenMetadata(
          mint,
          {store,evaluateAll,publish}
        );

        if(result?.attempted){
          __v13IntegrityMetrics.metadataAttempted++;
          if(result?.imageFound)__v13IntegrityMetrics.metadataImageRecovered++;
          if(result?.success===false)__v13IntegrityMetrics.metadataFailed++;
        }
      }catch(error){
        __v13IntegrityMetrics.metadataFailed++;
        __v13IntegrityMetrics.lastError='metadata: '+String(error?.message||error).slice(0,180);
      }
    }
  }finally{
    __v13MetadataRunActive=false;
  }
}

const __v13MetadataTimer=setInterval(
  ()=>void __v13RunMetadataRetry(),
  __V13_METADATA_TICK_MS
);
__v13MetadataTimer.unref?.();

setTimeout(
  ()=>void __v13RunMetadataRetry(),
  Math.min(15000,__V13_METADATA_TICK_MS)
).unref?.();

'''
s=s.replace(bridge_marker,runtime+bridge_marker,1)
p.write_text(s,encoding="utf-8")

# ---------------------------------------------------------------------------
# 5) REGRESSION TESTS
# ---------------------------------------------------------------------------
Path("src/data-integrity-v1_3-exact.test.mjs").write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaultSettings} from './settings.mjs';
import {evaluate} from './evaluate.mjs';

const good=(patch={})=>({
  mint:'Good111',
  name:'Good',
  symbol:'GOOD',
  launchPlatform:'pump',
  protocol:'pump',
  source:'Pump create',
  discoveredAt:Date.now()-5*60_000,
  holderCount:120,
  holderFresh:true,
  holderSource:'Solana getProgramAccounts unique-wallet scan',
  holderScannedAt:Date.now(),
  top10Pct:10,
  developerPct:2,
  buyPressure:3,
  priceSol:1,
  peakPriceSol:1,
  dataQuality:1,
  metadataResolved:true,
  ...patch
});

test('fresh canonical holder evidence can qualify normally',()=>{
  const d=evaluate(good(),defaultSettings());
  assert.equal(d.state,'BUY READY');
});

test('stale canonical holder evidence cannot remain BUY READY',()=>{
  const d=evaluate(
    good({holderScannedAt:Date.now()-10*60_000}),
    defaultSettings()
  );
  assert.equal(d.state,'WAITING');
  assert.ok(
    d.settingsEvaluation.gates.some(
      gate=>gate.name==='Fresh holder snapshot'&&gate.status==='WAITING'
    )
  );
});

test('95 percent observed-peak collapse is hard BLOCKED and score-capped',()=>{
  const d=evaluate(
    good({priceSol:0.05,peakPriceSol:1}),
    defaultSettings()
  );
  assert.equal(d.state,'BLOCKED');
  assert.ok(d.score<=20);
  assert.match(d.reasons.join(' '),/collapsed 95\.0% from observed peak/i);
  const gate=d.settingsEvaluation.gates.find(
    item=>item.name==='Peak drawdown safety'
  );
  assert.equal(gate?.status,'FAIL');
});

test('70 percent pullback is not catastrophic collapse',()=>{
  const d=evaluate(
    good({priceSol:0.30,peakPriceSol:1}),
    defaultSettings()
  );
  const gate=d.settingsEvaluation.gates.find(
    item=>item.name==='Peak drawdown safety'
  );
  assert.equal(gate?.status,'PASS');
  assert.doesNotMatch(d.reasons.join(' '),/token collapsed/i);
});

test('event holder ledger keeps canonical scan time separate from trade time',()=>{
  const source=fs.readFileSync(
    new URL('./event-holder-ledger.mjs',import.meta.url),
    'utf8'
  );
  assert.match(source,/HOLDER_CANONICAL_MAX_AGE_MS/);
  assert.match(source,/holderCanonicalSeedAt/);
  assert.match(source,/holderScannedAt:canonicalSeedAt\|\|null/);
  assert.match(source,/canonical-refresh-pending/);
});

test('runtime has bounded holder reconciliation and metadata retry workers',()=>{
  const app=fs.readFileSync(
    new URL('../app-server.mjs',import.meta.url),
    'utf8'
  );
  const enrich=fs.readFileSync(
    new URL('./enrich.mjs',import.meta.url),
    'utf8'
  );
  assert.match(app,/MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT/);
  assert.match(app,/__v13RunHolderReconcile/);
  assert.match(app,/__v13RunMetadataRetry/);
  assert.match(enrich,/export async function refreshTokenMetadata/);
  assert.match(enrich,/METADATA_IMAGE_RETRY_MAX/);
});
''',encoding="utf-8")
PY

log "Syntax validation..."
for f in "${TARGETS[@]}" "$NEW_TEST"; do
  node --check "$f"
done

log "V1.3 exact data-integrity tests..."
node --test "$NEW_TEST"

log "V1.2 canonical regression suite..."
node --test \
  src/filter-upgrade.test.mjs \
  src/unified-decision.test.mjs \
  src/candidate-visibility-lifecycle.test.mjs \
  src/paper-fee-reserve.test.mjs \
  src/openai-policy.test.mjs \
  "$NEW_TEST"

log "Existing integration suite..."
npm test

log "Diff sanity..."
git diff --check

grep -q "MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT" src/evaluate.mjs
grep -q "MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT" src/event-holder-ledger.mjs
grep -q "__v13RunHolderReconcile" app-server.mjs
grep -q "refreshTokenMetadata" src/enrich.mjs

trap - ERR INT TERM

log "SUCCESS: $PATCH_NAME applied and all tests passed."
log "Backup: $BACKUP"
log "Key behavior:"
log "  - canonical holder census expires after 3 minutes by default"
log "  - Pump TradeEvents no longer renew the authoritative holder scan timestamp"
log "  - visible stale candidates are re-baselined from Solana getProgramAccounts"
log "  - stale holder evidence becomes WAITING instead of producing a false BUY READY"
log "  - >=90% drawdown from MEMEFLOW observed peak is hard BLOCKED and score is capped at 20"
log "  - missing token images receive up to 4 bounded metadata retries"
log ""
log "Restart the Replit workflow/app after SUCCESS."
