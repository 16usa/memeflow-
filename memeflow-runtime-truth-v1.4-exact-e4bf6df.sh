#!/usr/bin/env bash
set -Eeuo pipefail
export GIT_PAGER=cat
export PAGER=cat

PATCH_NAME="MEMEFLOW_RUNTIME_TRUTH_V1_4_EXACT"
EXPECTED_HEAD="e4bf6dff62b5d8903cdb06346d0cd693977dad3b"
NEW_TEST="src/runtime-truth-v1_4-exact.test.mjs"

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
  ["app-server.mjs"]="19b14705eede9df07f512eb84baebf0e5c13c499"
  ["src/evaluate.mjs"]="3f5b757bf0cd2687c334e68fb3cd717aff1b67d3"
  ["src/enrich.mjs"]="b7e53c49e858fdd618f21d7dfed4d9f4b68fc630"
  ["src/event-holder-ledger.mjs"]="b4db33f93ec115e98952a6d0d16f6aef4093ae12"
  ["src/pump-live-trade-feed.mjs"]="8e5c73fcdc615b77616dc41c8be721f8a3a8ecdd"
  ["src/dex-verification-gate.mjs"]="ade92bf5268e8d3d06e1d60a909f4a130a584163"
  ["src/discovery-source.mjs"]="c80ef127af50a125fecb1f03016c8b7d6bc6f63f"
  ["src/store.mjs"]="a727af62fc9e1b510bb54f88ad126e1f22161343"
  ["src/paper-engine.mjs"]="015a6dc8564e7e10dee215de43ebc4a35cad28df"
  ["src/solana.mjs"]="760c1e12820338af777a47ff3435c0d15d881870"
)

TARGETS=(
  "app-server.mjs"
  "src/evaluate.mjs"
  "src/enrich.mjs"
  "src/event-holder-ledger.mjs"
  "src/pump-live-trade-feed.mjs"
  "src/dex-verification-gate.mjs"
  "src/discovery-source.mjs"
  "src/store.mjs"
  "src/paper-engine.mjs"
  "src/solana.mjs"
)

for f in "${TARGETS[@]}"; do
  [[ -f "$f" ]] || die "Missing target file: $f"
  git diff --quiet -- "$f" || die "$f has unstaged changes. Nothing changed."
  git diff --cached --quiet -- "$f" || die "$f has staged changes. Nothing changed."
  got="$(git hash-object "$f")"
  [[ "$got" == "${EXPECTED_BLOBS[$f]}" ]] || die "$f differs from audited baseline ($got != ${EXPECTED_BLOBS[$f]}). Nothing changed."
done

[[ ! -e "$NEW_TEST" ]] || die "$NEW_TEST already exists. Nothing changed."

BACKUP=".memeflow-runtime-truth-v1.4-exact-backup-$(date +%Y%m%d-%H%M%S)"
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

MARK="MEMEFLOW_RUNTIME_TRUTH_V1_4_EXACT"

def once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"{label}: expected exactly 1 anchor, found {count}")
    return text.replace(old,new,1)

def replace_between(text, start_marker, end_marker, replacement, label):
    start=text.find(start_marker)
    if start<0:
        raise SystemExit(f"{label}: start marker missing")
    end=text.find(end_marker,start+len(start_marker))
    if end<0:
        raise SystemExit(f"{label}: end marker missing")
    return text[:start]+replacement+text[end:]

# 1) Discovery source defaults to Pump.
p=Path("src/discovery-source.mjs")
s=p.read_text(encoding="utf-8")
s=once(s,"function normalizeMode(value, fallback='dex') {","function normalizeMode(value, fallback='pump') {","discovery normalize fallback")
s=once(s,"constructor({dataDir, defaultMode='dex'}={}) {","constructor({dataDir, defaultMode='pump'}={}) {","discovery constructor default")
s=once(s,"this.state = {mode:normalizeMode(defaultMode, 'dex'),updatedAt:Date.now(),version:1};","this.state = {mode:normalizeMode(defaultMode, 'pump'),updatedAt:Date.now(),version:1};","discovery state default")
p.write_text(s,encoding="utf-8")

# 2) Evaluator: canonical Pump age + canonical Pump market freshness.
p=Path("src/evaluate.mjs")
s=p.read_text(encoding="utf-8")
if MARK in s:
    raise SystemExit("evaluate already contains V1.4 marker")

s=once(
    s,
    "  if(!hasUri&&(t.lastScannedAt||t.dexConfirmed===true))return true;",
    "  if(!hasUri&&t.lastScannedAt)return true;",
    "metadata must not become authoritative from DEX confirmation"
)

old_age='''export function tokenAgeMinutes(token={},now=Date.now()){
  const created=firstFinite(token.createdAt,token.discoveredAt,token.firstSeenAt,token.seenAt,token.created_at,token.discovered_at,token.timestamp);
  if(created===null||created<=0)return null;
  const ms=created<1e12?created*1000:created;
  return Math.max(0,(Number(now)-ms)/60000);
}
'''
new_age=r'''function __mfV14PumpOrigin(token={}){
  const mint=String(token?.mint||token?.tokenMint||token?.tokenAddress||'').toLowerCase();
  const launch=String(token?.launchPlatform||'').toLowerCase();
  const protocol=String(token?.protocol||'').toLowerCase();
  const source=String(token?.source||'').toLowerCase();
  return launch==='pump'||protocol==='pump'||source.includes('pump create')||mint.endsWith('pump');
}

function __mfV14TimestampMs(value){
  if(value===null||value===undefined||value==='')return null;
  const numeric=Number(value);
  if(Number.isFinite(numeric)&&numeric>0)return numeric<1e12?numeric*1000:numeric;
  const parsed=Date.parse(String(value));
  return Number.isFinite(parsed)&&parsed>0?parsed:null;
}

export function tokenAgeSource(token={}){
  if(__mfV14PumpOrigin(token)){
    const pumpTs=__mfV14TimestampMs(token.pumpCreatedAt??token.pumpCreateAt??token.pumpCreationAt);
    if(pumpTs!==null)return 'pump-create-block-time';
    if(token.pumpCreatedAtPending===true)return 'pump-create-time-pending';
    const legacy=__mfV14TimestampMs(
      token.createdAt??token.discoveredAt??token.firstSeenAt??token.seenAt??
      token.created_at??token.discovered_at??token.timestamp
    );
    return legacy!==null?'legacy-pump-time-fallback':null;
  }
  const generic=__mfV14TimestampMs(
    token.createdAt??token.discoveredAt??token.firstSeenAt??token.seenAt??
    token.created_at??token.discovered_at??token.timestamp
  );
  return generic!==null?'generic-token-time':null;
}

export function tokenAgeMinutes(token={},now=Date.now()){
  let created=null;
  if(__mfV14PumpOrigin(token)){
    created=__mfV14TimestampMs(token.pumpCreatedAt??token.pumpCreateAt??token.pumpCreationAt);
    if(created===null&&token.pumpCreatedAtPending===true)return null;
    if(created===null){
      created=__mfV14TimestampMs(
        token.createdAt??token.discoveredAt??token.firstSeenAt??token.seenAt??
        token.created_at??token.discovered_at??token.timestamp
      );
    }
  }else{
    created=__mfV14TimestampMs(
      token.createdAt??token.discoveredAt??token.firstSeenAt??token.seenAt??
      token.created_at??token.discovered_at??token.timestamp
    );
  }
  if(created===null)return null;
  return Math.max(0,(Number(now)-created)/60000);
}
'''
s=once(s,old_age,new_age,"canonical Pump age function")

fresh_anchor="  // MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT\n  // Catastrophic drawdown is a hard market-integrity failure."
fresh_block=r'''  // MEMEFLOW_RUNTIME_TRUTH_V1_4_EXACT
  // DEX display updates never refresh this gate. It is driven only by the
  // canonical Pump/Solana market path.
  const __mfMarketSource=String(token?.marketSource||token?.priceSource||'').toLowerCase();
  const __mfCanonicalPumpMarket=
    token?.canonicalMarket===true||
    __mfMarketSource.startsWith('pump')||
    __mfMarketSource.includes('ws-direct')||
    String(token?.source||'').toLowerCase().includes('bonding curve');

  if(__mfV14PumpOrigin(token)&&__mfCanonicalPumpMarket){
    const __mfMarketAt=__mfV14TimestampMs(token?.pumpMarketUpdatedAt??token?.lastPriceAt);
    const __mfConfiguredMarketAge=Number(process.env.PUMP_CANONICAL_MARKET_MAX_AGE_MS);
    const __mfMarketMaxAge=Number.isFinite(__mfConfiguredMarketAge)
      ? Math.max(15000,__mfConfiguredMarketAge)
      : 120000;
    const __mfMarketAge=__mfMarketAt===null?null:Math.max(0,Date.now()-__mfMarketAt);

    addGate(
      'Fresh Pump market data',
      __mfMarketAge===null?null:(__mfMarketAge<=__mfMarketMaxAge?true:null),
      __mfMarketAge===null
        ? 'canonical Pump market timestamp pending'
        : `canonical Pump market data is ${Math.round(__mfMarketAge/1000)}s old`,
      {value:__mfMarketAge,threshold:__mfMarketMaxAge,operator:'<='}
    );
  }

'''
s=once(s,fresh_anchor,fresh_block+fresh_anchor,"Pump market freshness gate")
p.write_text(s,encoding="utf-8")

# 3) DEX verifier emits namespaced display fields only.
p=Path("src/dex-verification-gate.mjs")
s=p.read_text(encoding="utf-8")
start="function marketPatch(pair, mint) {"
end="function retryDelay(attempt) {"
replacement=r'''function marketPatch(pair, mint) {
  const activity = pairActivity(pair);
  const pressure = activity.sells > 0
    ? activity.buys / activity.sells
    : activity.buys > 0 ? Math.max(1, activity.buys) : null;
  const base = String(pair?.baseToken?.address || '');
  const quote = String(pair?.quoteToken?.address || '');
  let dexPriceSol = null;

  if (base === mint && quote === WSOL && finite(pair?.priceNative) && Number(pair.priceNative) > 0) {
    dexPriceSol = Number(pair.priceNative);
  } else if (quote === mint && base === WSOL && finite(pair?.priceNative) && Number(pair.priceNative) > 0) {
    dexPriceSol = 1 / Number(pair.priceNative);
  }

  // MEMEFLOW_RUNTIME_TRUTH_V1_4_EXACT
  // DEX is verification/display only. Never emit canonical decision fields.
  const patch = {
    dexConfirmed: true,
    dexPairAddress: pair?.pairAddress || null,
    dexId: pair?.dexId || null,
    dexUrl: pair?.url || null,
    dexPairCreatedAt: Number(pair?.pairCreatedAt) || null,
    dexMarketUpdatedAt: Date.now(),
    dexMarketSource: 'dexscreener',
    dexPriceSol,
    dexPriceUsd: finite(pair?.priceUsd) ? Number(pair.priceUsd) : null,
    dexLiquidityUsd: finite(pair?.liquidity?.usd) ? Number(pair.liquidity.usd) : null,
    dexMarketCapUsd: finite(pair?.marketCap) ? Number(pair.marketCap) : null,
    dexFdvUsd: finite(pair?.fdv) ? Number(pair.fdv) : null,
    dexVolume24hUsd: finite(pair?.volume?.h24) ? Number(pair.volume.h24) : null,
    dexVolume6hUsd: finite(pair?.volume?.h6) ? Number(pair.volume.h6) : null,
    dexVolume1hUsd: finite(pair?.volume?.h1) ? Number(pair.volume.h1) : null,
    dexVolume5mUsd: finite(pair?.volume?.m5) ? Number(pair.volume.m5) : null,
    dexBuyPressure: finite(pressure) ? Number(pressure) : null,
    dexBuyTransactions: activity.buys,
    dexSellTransactions: activity.sells,
    dexTotalTransactions: activity.buys + activity.sells,
    dexActivityWindow: activity.window || null
  };
  for (const key of Object.keys(patch)) if (patch[key] === null) delete patch[key];
  return patch;
}

'''
s=replace_between(s,start,end,replacement,"DEX display-only market patch")
old_market_delay='''function marketDelay(verifiedAt) {
  const age = Date.now() - Number(verifiedAt || Date.now());
  if (age < 2 * 60_000) return 3000;
  if (age < 15 * 60_000) return 10_000;
  if (age < 60 * 60_000) return 30_000;
  return 60_000;
}
'''
new_market_delay='''function marketDelay(verifiedAt) {
  const age = Date.now() - Number(verifiedAt || Date.now());
  if (age < 2 * 60_000) return 15000;
  if (age < 15 * 60_000) return 30000;
  if (age < 60 * 60_000) return 60000;
  return 120000;
}
'''
s=once(s,old_market_delay,new_market_delay,"DEX tracked refresh cadence")
p.write_text(s,encoding="utf-8")

# 4) Pump enrichment stays canonical; holder scan gets dual semantics.
p=Path("src/enrich.mjs")
s=p.read_text(encoding="utf-8")
s=s.replace("Phase B (enrichHolders) — delayed:  getTokenLargestAccounts, update holderFresh.","Phase B (enrichHolders) — delayed: canonical getProgramAccounts wallet census.")
s=once(s,"    const dexMarketLocked = existingToken.dexConfirmed === true;\n","","remove DEX market lock")
old_update='''      buyPressure: dexMarketLocked ? (existingToken.buyPressure ?? null) : (tw.sell ? tw.buy / tw.sell : (tw.buy ? tw.buy : null)),
      dataQuality: Math.max(Number(existingToken.dataQuality) || 0, [total || null, dexMarketLocked ? (existingToken.priceSol ?? null) : (c.priceSol ?? null)].filter(x => x != null).length / 2),
      source: dexMarketLocked ? (existingToken.source || 'Pump create') : 'Solana RPC',
'''
new_update='''      buyPressure: tw.sell ? tw.buy / tw.sell : (tw.buy ? tw.buy : (existingToken.buyPressure ?? null)),
      momentum: tw.sell ? tw.buy / tw.sell : (tw.buy ? tw.buy : (existingToken.buyPressure ?? existingToken.momentum ?? null)),
      dataQuality: Math.max(Number(existingToken.dataQuality) || 0, [total || null, c.priceSol ?? existingToken.priceSol ?? null].filter(x => x != null).length / 2),
      source: existingToken.source || 'Pump create',
'''
s=once(s,old_update,new_update,"Pump Phase A canonical update")
old_curve='''    if (Object.keys(c).length) {
      update.complete = c.complete ?? null;
      if (!dexMarketLocked) {
        update.priceSol       = c.priceSol    ?? null;
        update.liquiditySol   = c.liquiditySol ?? null;
        update.marketCapSol   = (c.priceSol && total) ? c.priceSol * total : null;
        /* MEMEFLOW_CANONICAL_ENRICH_FIELDS_V1 */
        update.marketCap      = update.marketCapSol;
        update.liquidity      = update.liquiditySol;
        update.momentum       = update.buyPressure;
      }
    }
'''
new_curve='''    if (Object.keys(c).length) {
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
'''
s=once(s,old_curve,new_curve,"Pump curve must remain canonical")
s=once(s,"    if (ensurePriceTimer && token?.dexConfirmed !== true) ensurePriceTimer(mint, curve);","    if (ensurePriceTimer) ensurePriceTimer(mint, curve);","DEX must not disable Pump price lifecycle")
s=once(s,"  const rows=await rpc.call('getProgramAccounts',[","  const rows=await rpc.callOnce('getProgramAccounts',[","holder GPA uses single-attempt queue-controlled RPC")
protocol_anchor='''  const protocolAuthorities=new Set(
    [token.curve,token.bondingCurve,token.associatedBondingCurve]
      .filter(x=>typeof x==='string'&&x.length>0)
  );

  const walletBalances=aggregateWalletBalances(accounts,protocolAuthorities);
'''
protocol_new='''  const protocolAuthorities=new Set(
    [token.curve,token.bondingCurve,token.associatedBondingCurve]
      .filter(x=>typeof x==='string'&&x.length>0)
  );

  const holderTokenAccountCount=accounts.filter(
    row=>row.amount>0&&!protocolAuthorities.has(row.authority)
  ).length;

  const walletBalances=aggregateWalletBalances(accounts,protocolAuthorities);
'''
s=once(s,protocol_anchor,protocol_new,"holder dual-count semantics")
s=once(s,"      {decimals,creator}\n","      {decimals,creator,totalSupplyUi:total,tokenAccountCount:holderTokenAccountCount}\n","seed actual canonical holder supply")
holder_update_anchor='''    holderFresh:true,
    holderCount,
    top10Pct,
'''
holder_update_new='''    holderFresh:true,
    holderCount,
    holderWalletCount:holderCount,
    holderTokenAccountCount,
    holderScannedAccountCount:accounts.length,
    top10Pct,
'''
s=once(s,holder_update_anchor,holder_update_new,"holder diagnostics fields")
s=once(s,"  const maxConcurrent=Math.max(4,Number(config?.maxConcurrent??4));","  const maxConcurrent=Math.max(1,Math.min(4,Number(config?.maxConcurrent??2)));","holder queue concurrency must honor configured capacity")
p.write_text(s,encoding="utf-8")

# 5) Holder ledger uses actual supply and explicit wallet/account counts.
p=Path("src/event-holder-ledger.mjs")
s=p.read_text(encoding="utf-8")
s=once(s,"function supplyRaw(decimals){\n  return BigInt(Math.round(DEFAULT_SUPPLY_UI))*(10n**BigInt(decimals));\n}\n",'''function supplyRaw(decimals){
  return BigInt(Math.round(DEFAULT_SUPPLY_UI))*(10n**BigInt(decimals));
}
function canonicalSupplyRaw(row){
  const ui=Number(row?.totalSupplyUi);
  const decimals=Number.isInteger(Number(row?.decimals))?Number(row.decimals):6;
  if(Number.isFinite(ui)&&ui>0&&Number.isInteger(ui)){
    return BigInt(Math.round(ui))*(10n**BigInt(decimals));
  }
  return supplyRaw(decimals);
}
''',"actual canonical supply helper")
s=once(s,"      r={mint:m,creator:null,balances:new Map(),firstSeenAt:Date.now(),lastSeenAt:null,txCount:0,decimals};","      r={mint:m,creator:null,balances:new Map(),firstSeenAt:Date.now(),lastSeenAt:null,txCount:0,decimals,totalSupplyUi:null,canonicalTokenAccountCount:null};","holder row canonical metadata")
seed_anchor='''    r.canonicalSeedAt=Date.now();
    r.lastSeenAt=r.canonicalSeedAt;
    r.canonicalHolderCount=next.size;
'''
seed_new='''    r.canonicalSeedAt=Date.now();
    r.lastSeenAt=r.canonicalSeedAt;
    r.canonicalHolderCount=next.size;
    r.totalSupplyUi=Number.isFinite(Number(opts.totalSupplyUi))&&Number(opts.totalSupplyUi)>0
      ? Number(opts.totalSupplyUi)
      : r.totalSupplyUi;
    r.canonicalTokenAccountCount=Number.isFinite(Number(opts.tokenAccountCount))
      ? Math.max(0,Number(opts.tokenAccountCount))
      : r.canonicalTokenAccountCount;
'''
s=once(s,seed_anchor,seed_new,"holder canonical seed metadata")
s=once(s,"    const totalSupply=supplyRaw(r.decimals??6);","    const totalSupply=canonicalSupplyRaw(r);","holder snapshot actual supply")
snapshot_anchor='''      holderCount:canonicalFresh?holders.length:null,
      top10Pct:canonicalFresh?pct(top10,totalSupply):null,
'''
snapshot_new='''      holderCount:canonicalFresh?holders.length:null,
      holderWalletCount:canonicalFresh?holders.length:null,
      holderTokenAccountCount:canonicalFresh&&Number.isFinite(Number(r.canonicalTokenAccountCount))
        ? Number(r.canonicalTokenAccountCount)
        : null,
      top10Pct:canonicalFresh?pct(top10,totalSupply):null,
'''
s=once(s,snapshot_anchor,snapshot_new,"holder snapshot dual counts")
s=once(s,"      eventLedgerDecimals:r.decimals??6,\n","      eventLedgerDecimals:r.decimals??6,\n      eventLedgerCanonicalSupplyUi:Number.isFinite(Number(r.totalSupplyUi))?Number(r.totalSupplyUi):null,\n","holder snapshot supply diagnostics")
save_anchor='''        canonicalSeedAt:r.canonicalSeedAt||null,
        canonicalHolderCount:r.canonicalHolderCount??null,
        balances:Object.fromEntries([...r.balances].map(([k,v])=>[k,v.toString()]))
'''
save_new='''        canonicalSeedAt:r.canonicalSeedAt||null,
        canonicalHolderCount:r.canonicalHolderCount??null,
        totalSupplyUi:Number.isFinite(Number(r.totalSupplyUi))?Number(r.totalSupplyUi):null,
        canonicalTokenAccountCount:Number.isFinite(Number(r.canonicalTokenAccountCount))
          ? Number(r.canonicalTokenAccountCount)
          : null,
        balances:Object.fromEntries([...r.balances].map(([k,v])=>[k,v.toString()]))
'''
s=once(s,save_anchor,save_new,"holder persistence metadata")
load_anchor='''          canonicalHolderCount:Number.isFinite(Number(s.canonicalHolderCount))
            ? Number(s.canonicalHolderCount)
            : null,
          balances:new Map()
'''
load_new='''          canonicalHolderCount:Number.isFinite(Number(s.canonicalHolderCount))
            ? Number(s.canonicalHolderCount)
            : null,
          totalSupplyUi:Number.isFinite(Number(s.totalSupplyUi))&&Number(s.totalSupplyUi)>0
            ? Number(s.totalSupplyUi)
            : null,
          canonicalTokenAccountCount:Number.isFinite(Number(s.canonicalTokenAccountCount))
            ? Number(s.canonicalTokenAccountCount)
            : null,
          balances:new Map()
'''
s=once(s,load_anchor,load_new,"holder load metadata")
p.write_text(s,encoding="utf-8")

# 6) Pump live flow owns canonical pressure and transaction counts.
p=Path("src/pump-live-trade-feed.mjs")
s=p.read_text(encoding="utf-8")
old_pressure=r'''  function updatePressure(e){
    const now=Date.now(), windowMs=30_000;
    let a=pressure.get(e.mint);
    if(!a){a=[];pressure.set(e.mint,a)}
    a.push({t:now,buy:e.isBuy,sol:Number(e.solAmount)/1e9});
    while(a.length&&a[0].t<now-windowMs)a.shift();
    let buys=0,sells=0;
    for(const x of a){ if(x.buy)buys+=x.sol; else sells+=x.sol; }
    return sells>0?buys/sells:(buys>0?Math.max(1,buys):null);
  }
'''
new_pressure=r'''  function updatePressure(e){
    const now=Date.now(), windowMs=60_000;
    let a=pressure.get(e.mint);
    if(!a){a=[];pressure.set(e.mint,a)}
    a.push({t:now,buy:e.isBuy,sol:Number(e.solAmount)/1e9});
    while(a.length&&a[0].t<now-windowMs)a.shift();

    let buySol=0,sellSol=0,buyTransactions=0,sellTransactions=0;
    for(const x of a){
      if(x.buy){buySol+=x.sol;buyTransactions++}
      else{sellSol+=x.sol;sellTransactions++}
    }

    const buyPressure=sellSol>0
      ? buySol/sellSol
      : (buySol>0?Math.max(1,buySol):null);

    return {
      buyPressure,
      buyTransactions,
      sellTransactions,
      totalTransactions:buyTransactions+sellTransactions,
      pumpBuyVolumeSol:buySol,
      pumpSellVolumeSol:sellSol,
      windowMs
    };
  }
'''
s=once(s,old_pressure,new_pressure,"Pump live pressure semantics")
old_patch=r'''      const buyPressure=updatePressure(e);
      const patch={
        marketSource:'ws-direct-trade-event',
        buyPressure,
        lastPriceAt:eventAt
      };

      if(Number.isFinite(market.priceSol)&&market.priceSol>0)patch.priceSol=market.priceSol;
      if(Number.isFinite(market.liquiditySol)&&market.liquiditySol>=0)patch.liquiditySol=market.liquiditySol;
'''
new_patch=r'''      const flow=updatePressure(e);
      const patch={
        marketSource:'pump-trade-event',
        priceSource:'pump-trade-event',
        buyPressureSource:'pump-trade-event-60s-sol-flow',
        buyPressure:flow.buyPressure,
        momentum:flow.buyPressure,
        buyTransactions:flow.buyTransactions,
        sellTransactions:flow.sellTransactions,
        totalTransactions:flow.totalTransactions,
        pumpBuyVolumeSol:flow.pumpBuyVolumeSol,
        pumpSellVolumeSol:flow.pumpSellVolumeSol,
        pumpFlowWindowMs:flow.windowMs,
        canonicalMarket:true,
        pumpMarketUpdatedAt:eventAt,
        lastPriceAt:eventAt
      };

      if(Number.isFinite(market.priceSol)&&market.priceSol>0)patch.priceSol=market.priceSol;
      if(Number.isFinite(market.liquiditySol)&&market.liquiditySol>=0)patch.liquiditySol=market.liquiditySol;
'''
s=once(s,old_patch,new_patch,"Pump live canonical market patch")
p.write_text(s,encoding="utf-8")

# 7) Store is a hard isolation boundary against DEX canonical contamination.
p=Path("src/store.mjs")
s=p.read_text(encoding="utf-8")
old_token_ts=r'''  _tokenTs(t={}){
    for(const v of [t.updatedAt,t.lastMarketActivityAt,t.lastPriceAt,t.discoveredAt,t.createdAt,t.firstSeenAt]){
      const n=typeof v==='number'?v:Date.parse(v);
      if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;
    }
    return 0;
  }
'''
new_token_ts=r'''  _tokenTs(t={}){
    // MEMEFLOW_RUNTIME_TRUTH_V1_4_EXACT
    // Display-only updates must not keep dead tokens resident forever.
    for(const v of [
      t.lastMarketActivityAt,
      t.lastPriceChangeAt,
      t.pumpCreatedAt,
      t.discoveredAt,
      t.createdAt,
      t.firstSeenAt
    ]){
      const n=typeof v==='number'?v:Date.parse(v);
      if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;
    }
    const fallback=typeof t.updatedAt==='number'?t.updatedAt:Date.parse(t.updatedAt);
    return Number.isFinite(fallback)&&fallback>0?(fallback<1e12?fallback*1000:fallback):0;
  }
'''
s=once(s,old_token_ts,new_token_ts,"store canonical token timestamp")
patch_anchor='''  setToken(mint,t){
    const now=Date.now(),existed=Boolean(this.state.tokens[mint]),old=this.state.tokens[mint]||{};
    const patch={...(t||{})};

'''
isolation=r'''  setToken(mint,t){
    const now=Date.now(),existed=Boolean(this.state.tokens[mint]),old=this.state.tokens[mint]||{};
    const patch={...(t||{})};

    // MEMEFLOW_RUNTIME_TRUTH_V1_4_EXACT
    // DEX is a verification/display namespace only. Future legacy-looking DEX
    // patches are isolated here before peak/activity/decision state is touched.
    const dexSignal=[patch.dexMarketSource,patch.marketSource,patch.priceSource,patch.buyPressureSource]
      .some(value=>String(value||'').toLowerCase().includes('dexscreener'));

    if(dexSignal){
      const map={
        priceSol:'dexPriceSol',priceUsd:'dexPriceUsd',
        liquiditySol:'dexLiquiditySol',liquidityUsd:'dexLiquidityUsd',
        marketCapSol:'dexMarketCapSol',marketCapUsd:'dexMarketCapUsd',fdvUsd:'dexFdvUsd',
        volume24hUsd:'dexVolume24hUsd',volume6hUsd:'dexVolume6hUsd',
        volume1hUsd:'dexVolume1hUsd',volume5mUsd:'dexVolume5mUsd',
        buyPressure:'dexBuyPressure',buyTransactions:'dexBuyTransactions',
        sellTransactions:'dexSellTransactions',totalTransactions:'dexTotalTransactions'
      };
      for(const [canonical,dexKey] of Object.entries(map)){
        if(patch[canonical]!==undefined&&patch[dexKey]===undefined)patch[dexKey]=patch[canonical];
        delete patch[canonical];
      }
      delete patch.marketCap;delete patch.liquidity;delete patch.momentum;
      delete patch.lastPriceAt;delete patch.lastPriceChangeAt;delete patch.lastMarketActivityAt;
      delete patch.pumpMarketUpdatedAt;delete patch.canonicalMarket;delete patch.dataQuality;
      if(String(patch.marketSource||'').toLowerCase().includes('dexscreener'))delete patch.marketSource;
      if(String(patch.priceSource||'').toLowerCase().includes('dexscreener'))delete patch.priceSource;
      if(String(patch.buyPressureSource||'').toLowerCase().includes('dexscreener'))delete patch.buyPressureSource;
      patch.dexMarketSource=patch.dexMarketSource||'dexscreener';
    }

    const canonicalSource=String(patch.marketSource||patch.priceSource||'').toLowerCase();
    if(canonicalSource.startsWith('pump')||canonicalSource.includes('ws-direct')||canonicalSource.includes('bonding-curve')){
      patch.canonicalMarket=true;
    }

'''
s=once(s,patch_anchor,isolation,"store DEX isolation boundary")
old_activity='''    const pressureChanged=t?.buyPressure!==undefined&&Number(t.buyPressure)!==Number(old?.buyPressure);
    const activityChanged=priceChanged||pressureChanged||Number(t?.buyTransactions||0)!==Number(old?.buyTransactions||0)||Number(t?.sellTransactions||0)!==Number(old?.sellTransactions||0);
'''
new_activity='''    const pressureChanged=patch?.buyPressure!==undefined&&Number(patch.buyPressure)!==Number(old?.buyPressure);
    const activityChanged=priceChanged||pressureChanged||Number(patch?.buyTransactions||0)!==Number(old?.buyTransactions||0)||Number(patch?.sellTransactions||0)!==Number(old?.sellTransactions||0);
'''
s=once(s,old_activity,new_activity,"store canonical market activity")
replacements=[
("Number.isFinite(Number(t?.liquiditySol??t?.liquidity))?Number(t?.liquiditySol??t?.liquidity):null","Number.isFinite(Number(patch?.liquiditySol??patch?.liquidity))?Number(patch?.liquiditySol??patch?.liquidity):null","anti-rug canonical liquidity"),
("(t?.holderCount??t?.holders)==null?null:(Number.isFinite(Number(t?.holderCount??t?.holders))?Number(t?.holderCount??t?.holders):null)","(patch?.holderCount??patch?.holders)==null?null:(Number.isFinite(Number(patch?.holderCount??patch?.holders))?Number(patch?.holderCount??patch?.holders):null)","anti-rug canonical holders"),
("Number.isFinite(Number(t?.top10Pct??t?.top10))?Number(t?.top10Pct??t?.top10):null","Number.isFinite(Number(patch?.top10Pct??patch?.top10))?Number(patch?.top10Pct??patch?.top10):null","anti-rug canonical top10"),
("Number.isFinite(Number(t?.developerPct??t?.creatorPct))?Number(t?.developerPct??t?.creatorPct):null","Number.isFinite(Number(patch?.developerPct??patch?.creatorPct))?Number(patch?.developerPct??patch?.creatorPct):null","anti-rug canonical developer"),
("Number.isFinite(Number(t?.buyPressure??t?.momentum))?Number(t?.buyPressure??t?.momentum):null","Number.isFinite(Number(patch?.buyPressure??patch?.momentum))?Number(patch?.buyPressure??patch?.momentum):null","anti-rug canonical pressure")]
for old,new,label in replacements:s=once(s,old,new,label)
state_anchor='''    this.state.tokens[mint]={
      ...old,...patch,...derivedMarketPatch,
      antiRugHistory:antiRugHistory,
      peakPriceSol:peak||old.peakPriceSol||null,
      lastPriceAt:hasNextPrice?now:(old.lastPriceAt||null),
'''
state_new='''    const explicitLastPrice=Number(patch?.lastPriceAt);
    const canonicalLastPriceAt=Number.isFinite(explicitLastPrice)&&explicitLastPrice>0
      ? (explicitLastPrice<1e12?explicitLastPrice*1000:explicitLastPrice)
      : now;

    this.state.tokens[mint]={
      ...old,...patch,...derivedMarketPatch,
      antiRugHistory:antiRugHistory,
      peakPriceSol:peak||old.peakPriceSol||null,
      lastPriceAt:hasNextPrice?canonicalLastPriceAt:(old.lastPriceAt||null),
'''
s=once(s,state_anchor,state_new,"store explicit Pump event timestamp")
p.write_text(s,encoding="utf-8")

# 8) Paper engine freshness ignores generic display/metadata updates.
p=Path("src/paper-engine.mjs")
s=p.read_text(encoding="utf-8")
s=once(s,"    const tokenUpdatedAt = Number(token?.updatedAt || token?.lastPriceAt || 0);","    const tokenUpdatedAt = Number(token?.pumpMarketUpdatedAt || token?.lastPriceAt || token?.lastMarketActivityAt || 0);","paper canonical market freshness")
p.write_text(s,encoding="utf-8")

# 9) RpcPool.call uses method-specific timeout policy.
p=Path("src/solana.mjs")
s=p.read_text(encoding="utf-8")
s=once(s,"    const TIMEOUT=Number(process.env.SOLANA_RPC_TIMEOUT_MS||20000);\n    const MAX_ATTEMPTS=3;","    const TIMEOUT=this.methodTimeoutMs(method);\n    const MAX_ATTEMPTS=3;","RpcPool method-specific call timeout")
p.write_text(s,encoding="utf-8")

# 10) App server runtime contract.
p=Path("app-server.mjs")
s=p.read_text(encoding="utf-8")
if MARK in s:raise SystemExit("app-server already contains V1.4 marker")
s=once(s,"import {evaluate,tokenAgeMinutes} from './src/evaluate.mjs';","import {evaluate,tokenAgeMinutes,tokenAgeSource} from './src/evaluate.mjs';","app-server age source import")
s=once(s,"const __discoverySource=new DiscoverySourceController({dataDir,defaultMode:process.env.DISCOVERY_SOURCE_MODE||'dex'});","const __discoverySource=new DiscoverySourceController({dataDir,defaultMode:process.env.DISCOVERY_SOURCE_MODE||'pump'});","app-server Pump discovery default")

migration_start="function __migrateLegacyDiscoveryModes(){"
migration_end="const paper=new PaperEngine(store);"
migration_replacement=r'''function __migrateLegacyDiscoveryModes(){
  const legacyMode=normalizeDiscoveryMode(__discoverySource?.mode||'pump');
  let changed=0;
  for(const user of Object.values(store?.state?.users||{})){
    const current=(user?.settings&&typeof user.settings==='object'&&!Array.isArray(user.settings))?user.settings:{};
    if(!Object.prototype.hasOwnProperty.call(current,'discoverySourceMode')){
      user.settings={...current,discoverySourceMode:'pump'};
      changed++;
    }
  }
  if(changed)store.save();
  return {changed,legacyMode};
}
'''
s=replace_between(s,migration_start,migration_end,migration_replacement,"legacy discovery migration")

candidate_anchor='''    holders:finite(t.holderCount),
    holderCount:finite(t.holderCount),
    top10:top10Pct,
'''
candidate_new='''    holders:finite(t.holderCount),
    holderCount:finite(t.holderCount),
    holderWalletCount:finite(t.holderWalletCount??t.holderCount),
    holderTokenAccountCount:finite(t.holderTokenAccountCount),
    holderSource:t.holderSource||null,
    top10:top10Pct,
'''
s=once(s,candidate_anchor,candidate_new,"candidate holder semantics")
s=once(s,"    ageMinutes:tokenAgeMinutes(t),",'''    ageMinutes:tokenAgeMinutes(t),
    ageSource:tokenAgeSource(t),
    pumpCreatedAt:t.pumpCreatedAt||null,
    pumpCreatedAtPending:t.pumpCreatedAtPending===true,
    dexConfirmed:t.dexConfirmed===true,
    dex:{
      confirmed:t.dexConfirmed===true,
      url:t.dexUrl||null,
      pairAddress:t.dexPairAddress||null,
      dexId:t.dexId||null,
      priceSol:finite(t.dexPriceSol),
      priceUsd:finite(t.dexPriceUsd),
      liquidityUsd:finite(t.dexLiquidityUsd),
      marketCapUsd:finite(t.dexMarketCapUsd),
      buyPressure:finite(t.dexBuyPressure),
      updatedAt:t.dexMarketUpdatedAt||null
    },''',"candidate age and DEX display diagnostics")
s=once(s,"  const discovered=Number(token.discoveredAt||token.createdAt||0);\n  const ageMinutes=discovered>0?Math.max(0,(now-discovered)/60000):null;\n","  const ageMinutes=tokenAgeMinutes(token,now);\n","holder admission canonical Pump age")
s=once(s,"workerTimeoutMs:Math.max(5000,Number(process.env.HOLDER_WORKER_TIMEOUT_MS||11000))","workerTimeoutMs:Math.max(5000,Number(process.env.HOLDER_WORKER_TIMEOUT_MS||18000))","holder worker timeout")

price_start='''function ensurePriceTimer(mint,curve){
  const __priceOwnerToken=store.state.tokens?.[mint];
  if(__priceOwnerToken?.dexConfirmed===true)return;
  if(priceTimers.has(mint)||!curve)return;
'''
price_new='''function ensurePriceTimer(mint,curve){
  if(priceTimers.has(mint)||!curve)return;
'''
s=once(s,price_start,price_new,"DEX must not stop Pump price timer")
s=once(s,"  let lastBackgroundPollAt=0;\n","  let lastBackgroundPollAt=0;\n  let pollInFlight=false;\n","price timer in-flight guard declaration")
s=once(s,"    if(t?.dexConfirmed===true){clearInterval(timer);priceTimers.delete(mint);return}\n\n","","DEX must not terminate active Pump price timer")
s=once(s,"    const discoveredAt=Number(t.discoveredAt||now);","    const discoveredAt=Number(t.pumpCreatedAt||t.discoveredAt||now);","price lifecycle canonical age")
s=once(s,"    lastBackgroundPollAt=now;\n\n    try{","    if(pollInFlight)return;\n    pollInFlight=true;\n    lastBackgroundPollAt=now;\n\n    try{","price timer prevent overlapping RPC work")
price_patch_anchor="          source:'Solana bonding curve'\n        });"
price_patch_new="""          source:t.source||'Pump create',
          marketSource:'pump-bonding-curve',
          priceSource:'pump-bonding-curve',
          canonicalMarket:true,
          pumpMarketUpdatedAt:Date.now()
        });"""
s=once(s,price_patch_anchor,price_patch_new,"price timer canonical source")
s=once(s,"      await evaluateAll(updated);\n    }\n  },baseTick);","      await evaluateAll(updated);\n    }finally{\n      pollInFlight=false;\n    }\n  },baseTick);","price timer in-flight release")

pump_candidate_anchor='''        launchPlatform:'pump',
        protocol:'pump',
        discoveredAt:Date.now(),
        slot:tx.slot,
'''
pump_candidate_new='''        launchPlatform:'pump',
        protocol:'pump',
        discoveredAt:Date.now(),
        pumpCreatedAt:Number.isFinite(Number(tx?.blockTime))&&Number(tx.blockTime)>0
          ? Number(tx.blockTime)*1000
          : null,
        pumpCreatedAtPending:!(Number.isFinite(Number(tx?.blockTime))&&Number(tx.blockTime)>0),
        pumpCreatedAtSource:Number.isFinite(Number(tx?.blockTime))&&Number(tx.blockTime)>0
          ? 'solana-create-transaction-block-time'
          : null,
        slot:tx.slot,
'''
s=once(s,pump_candidate_anchor,pump_candidate_new,"Pump create canonical block time")

standalone_dex_pressure=''' }else if(buyPressure==null&&pair){
  const w=mf49TxnWindow(pair);
  if(w.buys!=null||w.sells!=null){
   buyPressure=w.sells?w.buys/w.sells:(w.buys||null)
  }
 }
'''
s=once(s,standalone_dex_pressure," }\n","standalone DEX pressure isolation")

# Replace DEX callbacks so they never own canonical market state.
dex_start="function __stopPumpPriceTimerForDex(mint){"
dex_end="function __pruneDecisionsForUserMode(uid){"
dex_replacement=r'''function __startPumpLiveFeed(){
  if(!__pumpLiveTradeFeed)__pumpLiveTradeFeed=startPumpLiveTradeFeed(__pumpLiveTradeFeedOpts);
}
function __ensureDexVerifier(){
  if(__dexVerificationGate)return __dexVerificationGate;
  __dexVerificationGate=createDexVerificationGate({onVerified:__applyDexVerifiedPump,onMarket:__applyDexVerifiedMarket});
  for(const token of store.tokens().filter(t=>__isPumpOriginToken(t)&&t?.dexConfirmed===true).slice(0,150)){
    __dexVerificationGate.trackVerified(token);
  }
  return __dexVerificationGate;
}
function __submitPumpCandidateForDex(candidate){return __ensureDexVerifier().submit(candidate);}
function __seedDexVerifierFromRecentPump(){
  const gate=__ensureDexVerifier();
  const maxAgeMs=Math.max(10*60_000,Number(process.env.DEX_VERIFY_SEED_MAX_AGE_MS||3*60*60_000));
  const limit=Math.max(50,Math.min(1500,Number(process.env.DEX_VERIFY_SEED_LIMIT||600)));
  const now=Date.now();
  const rows=store.tokens()
    .filter(t=>__isPumpOriginToken(t)&&t?.dexConfirmed!==true)
    .filter(t=>{const ts=Number(t?.discoveredAt||t?.pumpCreatedAt||t?.createdAt||0);return ts>0&&now-ts<=maxAgeMs})
    .slice(0,limit);
  for(const token of rows)gate.submit(token,{seeded:true});
  return rows.length;
}
function __reapplyDexDisplay(mint,market){
  const current=store.state?.tokens?.[mint];
  if(!current||!__isPumpOriginToken(current))return null;
  return store.setToken(mint,{
    ...(market||{}),
    dexConfirmed:true,
    dexConfirmedAt:current.dexConfirmedAt||Date.now(),
    dexListedAt:current.dexListedAt||Date.now(),
    dexVerificationPending:false,
    launchPlatform:'pump',
    protocol:'pump'
  });
}
function __applyDexVerifiedPump(info){
  const mint=String(info?.mint||info?.candidate?.mint||'').trim();
  if(!mint)return;
  const existing=store.state?.tokens?.[mint]||null;
  if(!existing||!__isPumpOriginToken(existing))return;
  const updated=__reapplyDexDisplay(mint,{
    ...(info?.market||{}),
    dexConfirmed:true,
    dexConfirmedAt:existing.dexConfirmedAt||Date.now(),
    dexListedAt:existing.dexListedAt||Date.now(),
    dexVerificationPending:false
  });
  if(!updated)return;
  try{ensurePriceTimer(mint,updated?.curve||updated?.bondingCurve||null)}catch{}
  try{if(updated?.creator)eventHolderLedger.setCreator(mint,updated.creator)}catch{}
  Promise.resolve(evaluateAll(updated)).catch(()=>{});
  try{publish(mint)}catch{}
}
function __applyDexVerifiedMarket(mint,patch){
  const current=store.state?.tokens?.[mint];
  if(!current||current?.dexConfirmed!==true||!__isPumpOriginToken(current))return;
  const updated=__reapplyDexDisplay(mint,patch);
  if(!updated)return;
  try{publish(mint)}catch{}
}
'''
s=replace_between(s,dex_start,dex_end,dex_replacement,"DEX verification/display callbacks")

# Runtime normalization, canonical creation-time backfill and price-timer rescue.
runtime_marker="process.on('uncaughtException',e=>"
runtime_block=r'''
/* MEMEFLOW_RUNTIME_TRUTH_V1_4_EXACT
   Pump/Solana is canonical. DEX is verification/display only. */
const __v14RuntimeTruthMetrics={
  normalizedDexContamination:0,pumpAgePending:0,pumpAgeBackfillAttempted:0,
  pumpAgeBackfillSucceeded:0,pumpAgeBackfillFailed:0,pumpPriceTimersRescued:0,
  lastAgeMint:null,lastError:null
};

function __v14NormalizePersistedEvidence(){
  let changed=false;
  for(const token of Object.values(store?.state?.tokens||{})){
    if(!token||typeof token!=='object')continue;
    const pump=__isPumpOriginToken(token);
    if(pump&&!Number.isFinite(Number(token.pumpCreatedAt))){
      token.pumpCreatedAtPending=true;
      __v14RuntimeTruthMetrics.pumpAgePending++;
      changed=true;
    }

    const sourceText=String(token.marketSource||token.priceSource||'').toLowerCase();
    const currentCanonicalPump=
      token.canonicalMarket===true||
      sourceText.startsWith('pump')||
      sourceText.includes('ws-direct')||
      sourceText.includes('bonding-curve');

    // V1.3 peak history may have been touched by legacy DEX canonical prices.
    // Reset it once at migration so future drawdown is Pump-only.
    if(token.dexConfirmed===true&&!token.v14PumpPeakResetAt){
      const canonicalPrice=Number(token.priceSol);
      token.peakPriceSol=currentCanonicalPump&&Number.isFinite(canonicalPrice)&&canonicalPrice>0
        ? canonicalPrice
        : null;
      token.antiRugHistory=[];
      token.v14PumpPeakResetAt=Date.now();
      changed=true;
    }

    const dexContaminated=[token.marketSource,token.priceSource,token.buyPressureSource]
      .some(value=>String(value||'').toLowerCase().includes('dexscreener'));
    if(!dexContaminated)continue;

    const map={
      priceSol:'dexPriceSol',priceUsd:'dexPriceUsd',
      liquiditySol:'dexLiquiditySol',liquidityUsd:'dexLiquidityUsd',
      marketCapSol:'dexMarketCapSol',marketCapUsd:'dexMarketCapUsd',fdvUsd:'dexFdvUsd',
      volume24hUsd:'dexVolume24hUsd',volume6hUsd:'dexVolume6hUsd',
      volume1hUsd:'dexVolume1hUsd',volume5mUsd:'dexVolume5mUsd',
      buyPressure:'dexBuyPressure',buyTransactions:'dexBuyTransactions',
      sellTransactions:'dexSellTransactions',totalTransactions:'dexTotalTransactions'
    };
    for(const [canonical,dexKey] of Object.entries(map)){
      if(token[canonical]!==undefined&&token[dexKey]===undefined)token[dexKey]=token[canonical];
      delete token[canonical];
    }
    for(const key of [
      'marketCap','liquidity','momentum','marketSource','priceSource','buyPressureSource',
      'lastPriceAt','lastPriceChangeAt','lastMarketActivityAt','pumpMarketUpdatedAt',
      'canonicalMarket','peakPriceSol'
    ])delete token[key];
    token.antiRugHistory=[];
    token.dataQuality=0;
    token.dexMarketSource=token.dexMarketSource||'dexscreener';
    token.updatedAt=Date.now();
    __v14RuntimeTruthMetrics.normalizedDexContamination++;
    changed=true;
  }
  if(changed)store.save();
  return changed;
}

let __v14AgeBackfillRunning=false;
async function __v14BackfillPumpCreateTimes(limit=120){
  if(__v14AgeBackfillRunning)return;
  __v14AgeBackfillRunning=true;
  try{
    const rows=store.tokens()
      .filter(token=>__isPumpOriginToken(token)&&token?.pumpCreatedAtPending===true&&(
        Number.isFinite(Number(token?.slot))||Boolean(String(token?.signature||'').trim())
      ))
      .sort((a,b)=>Number(b?.updatedAt||0)-Number(a?.updatedAt||0))
      .slice(0,Math.max(1,Math.min(250,Number(limit)||120)));

    for(const token of rows){
      const mint=String(token?.mint||'').trim();
      if(!mint)continue;
      __v14RuntimeTruthMetrics.pumpAgeBackfillAttempted++;
      __v14RuntimeTruthMetrics.lastAgeMint=mint;
      try{
        let blockTime=null;
        const slot=Number(token?.slot);
        if(Number.isFinite(slot)&&slot>0){
          blockTime=await rpc.callOnce('getBlockTime',[slot]);
        }else{
          const signature=String(token?.signature||'').trim();
          if(signature){
            const tx=await rpc.callOnce('getTransaction',[signature,{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}]);
            blockTime=tx?.blockTime??null;
          }
        }
        const seconds=Number(blockTime);
        if(Number.isFinite(seconds)&&seconds>0){
          const updated=store.setToken(mint,{
            pumpCreatedAt:seconds*1000,
            pumpCreatedAtPending:false,
            pumpCreatedAtSource:Number.isFinite(slot)&&slot>0?'solana-getBlockTime':'solana-create-transaction-block-time'
          });
          __v14RuntimeTruthMetrics.pumpAgeBackfillSucceeded++;
          await Promise.resolve(evaluateAll(updated)).catch(()=>{});
          try{publish(mint)}catch{}
        }else{
          __v14RuntimeTruthMetrics.pumpAgeBackfillFailed++;
        }
      }catch(error){
        __v14RuntimeTruthMetrics.pumpAgeBackfillFailed++;
        __v14RuntimeTruthMetrics.lastError='age: '+String(error?.message||error).slice(0,180);
      }
      await new Promise(resolve=>setTimeout(resolve,50));
    }
  }finally{
    __v14AgeBackfillRunning=false;
  }
}

function __v14RescueVisiblePumpPriceTimers(){
  const mints=new Set();
  for(const decision of Object.values(store?.state?.decisions||{})){
    const state=String(decision?.state||'').toUpperCase();
    if(['BUY READY','WATCH','WAITING'].includes(state)&&decision?.mint)mints.add(String(decision.mint));
  }
  let rescued=0;
  for(const mint of [...mints].slice(0,80)){
    const token=store?.state?.tokens?.[mint];
    if(!token||!__isPumpOriginToken(token)||!token?.curve||priceTimers.has(mint))continue;
    try{
      ensurePriceTimer(mint,token.curve);
      if(priceTimers.has(mint)){rescued++;__v14RuntimeTruthMetrics.pumpPriceTimersRescued++;}
    }catch(error){
      __v14RuntimeTruthMetrics.lastError='price-rescue: '+String(error?.message||error).slice(0,180);
    }
  }
  return rescued;
}

function __v14StartRuntimeTruthWorkers(){
  setTimeout(()=>void __v14BackfillPumpCreateTimes(120),4000).unref?.();
  setTimeout(()=>__v14RescueVisiblePumpPriceTimers(),6000).unref?.();
  const ageTimer=setInterval(()=>void __v14BackfillPumpCreateTimes(40),Math.max(5*60_000,Number(process.env.PUMP_CREATE_TIME_BACKFILL_INTERVAL_MS||10*60_000)));
  ageTimer.unref?.();
  const priceRescueTimer=setInterval(()=>__v14RescueVisiblePumpPriceTimers(),Math.max(15000,Number(process.env.PUMP_PRICE_RESCUE_INTERVAL_MS||30000)));
  priceRescueTimer.unref?.();
}

'''
s=once(s,runtime_marker,runtime_block+runtime_marker,"V1.4 runtime truth workers")
listen_anchor='''  const listenAt=Date.now();
  console.log(`MEMEFLOW listening on ${process.env.PORT||3000}`);
  __applyDiscoverySourceMode();
  startDecisionRecovery('''
listen_new='''  const listenAt=Date.now();
  console.log(`MEMEFLOW listening on ${process.env.PORT||3000}`);
  __v14NormalizePersistedEvidence();
  __applyDiscoverySourceMode();
  __v14StartRuntimeTruthWorkers();
  startDecisionRecovery('''
s=once(s,listen_anchor,listen_new,"startup evidence normalization order")
p.write_text(s,encoding="utf-8")

# 11) Regression tests.
Path("src/runtime-truth-v1_4-exact.test.mjs").write_text(r"""import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaultSettings} from './settings.mjs';
import {evaluate,tokenAgeMinutes,tokenAgeSource} from './evaluate.mjs';

const now=Date.now();
const goodPump=(patch={})=>({
  mint:'GoodPump111111111111111111111111111111pump',
  name:'Good',symbol:'GOOD',launchPlatform:'pump',protocol:'pump',source:'Pump create',
  discoveredAt:now-60_000,pumpCreatedAt:now-60_000,pumpCreatedAtPending:false,
  holderCount:120,holderWalletCount:120,holderTokenAccountCount:145,holderFresh:true,
  holderSource:'Solana getProgramAccounts unique-wallet scan',holderScannedAt:now,holderCanonicalSeedAt:now,
  top10Pct:10,developerPct:2,buyPressure:3,buyTransactions:8,sellTransactions:2,totalTransactions:10,
  priceSol:1,peakPriceSol:1,lastPriceAt:now,pumpMarketUpdatedAt:now,
  marketSource:'pump-trade-event',canonicalMarket:true,dataQuality:1,metadataResolved:true,...patch
});

test('Pump age uses canonical create block time instead of recent discovery time',()=>{
  const old=goodPump({discoveredAt:now-30_000,pumpCreatedAt:now-18*60*60_000});
  const age=tokenAgeMinutes(old,now);
  assert.ok(age>1079&&age<1081);
  assert.equal(tokenAgeSource(old),'pump-create-block-time');
  const d=evaluate(old,defaultSettings());
  assert.equal(d.state,'BLOCKED');
  assert.match(d.reasons.join(' '),/token age above 180m/i);
});

test('persisted Pump token awaiting canonical create time cannot become BUY READY',()=>{
  const pending=goodPump({pumpCreatedAt:null,pumpCreatedAtPending:true,discoveredAt:now-30_000});
  assert.equal(tokenAgeMinutes(pending,now),null);
  assert.equal(tokenAgeSource(pending),'pump-create-time-pending');
  const d=evaluate(pending,defaultSettings());
  assert.equal(d.state,'WAITING');
  assert.ok(d.settingsEvaluation.gates.some(gate=>gate.name==='Maximum token age'&&gate.status==='WAITING'));
});

test('DEX display fields do not override healthy Pump decision evidence',()=>{
  const token=goodPump({dexConfirmed:true,dexPriceSol:0.00000001,dexBuyPressure:0.01,dexBuyTransactions:0,dexSellTransactions:999,dexMarketUpdatedAt:now,dexMarketSource:'dexscreener'});
  const d=evaluate(token,defaultSettings());
  assert.equal(d.state,'BUY READY');
  assert.equal(d.aiQuality.components.find(x=>x.key==='buyPressure')?.value,3);
});

test('stale canonical Pump market data waits even when DEX display is fresh',()=>{
  const token=goodPump({lastPriceAt:now-10*60_000,pumpMarketUpdatedAt:now-10*60_000,dexConfirmed:true,dexMarketUpdatedAt:now,dexPriceSol:2});
  const d=evaluate(token,defaultSettings());
  assert.equal(d.state,'WAITING');
  assert.ok(d.settingsEvaluation.gates.some(gate=>gate.name==='Fresh Pump market data'&&gate.status==='WAITING'));
});

test('source code keeps DEX out of canonical runtime evidence',()=>{
  const dex=fs.readFileSync(new URL('./dex-verification-gate.mjs',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
  const store=fs.readFileSync(new URL('./store.mjs',import.meta.url),'utf8');
  assert.match(dex,/dexPriceSol/);
  assert.match(dex,/dexBuyPressure/);
  assert.doesNotMatch(dex,/\n\s+marketSource:\s*'dexscreener'/);
  assert.doesNotMatch(dex,/\n\s+lastPriceAt:/);
  assert.doesNotMatch(app,/__stopPumpPriceTimerForDex/);
  assert.match(app,/pumpCreatedAt:/);
  assert.match(app,/__v14NormalizePersistedEvidence/);
  assert.match(store,/MEMEFLOW_RUNTIME_TRUTH_V1_4_EXACT/);
});

test('holder scan exposes both risk-wallet and token-account counts',()=>{
  const enrich=fs.readFileSync(new URL('./enrich.mjs',import.meta.url),'utf8');
  const ledger=fs.readFileSync(new URL('./event-holder-ledger.mjs',import.meta.url),'utf8');
  assert.match(enrich,/holderWalletCount:holderCount/);
  assert.match(enrich,/holderTokenAccountCount/);
  assert.match(enrich,/callOnce\('getProgramAccounts'/);
  assert.match(ledger,/canonicalTokenAccountCount/);
  assert.match(ledger,/eventLedgerCanonicalSupplyUi/);
});

test('paper freshness uses canonical market timestamps, not generic token updatedAt',()=>{
  const paper=fs.readFileSync(new URL('./paper-engine.mjs',import.meta.url),'utf8');
  assert.match(paper,/pumpMarketUpdatedAt \|\| token\?\.lastPriceAt/);
  assert.doesNotMatch(paper,/token\?\.updatedAt \|\| token\?\.lastPriceAt/);
});

test('Pump live flow owns canonical pressure and transaction counts',()=>{
  const live=fs.readFileSync(new URL('./pump-live-trade-feed.mjs',import.meta.url),'utf8');
  assert.match(live,/pump-trade-event-60s-sol-flow/);
  assert.match(live,/buyTransactions:flow\.buyTransactions/);
  assert.match(live,/canonicalMarket:true/);
});

test('discovery controller defaults to Pump',()=>{
  const source=fs.readFileSync(new URL('./discovery-source.mjs',import.meta.url),'utf8');
  assert.match(source,/defaultMode='pump'/);
  assert.doesNotMatch(source,/defaultMode='dex'/);
});
""",encoding="utf-8")
PY

log "Syntax validation..."
for f in "${TARGETS[@]}" "$NEW_TEST"; do
  node --check "$f"
done

log "V1.4 runtime-truth tests..."
node --test "$NEW_TEST"

log "V1.3 + V1.2 regression suite..."
node --test \
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

grep -q "MEMEFLOW_RUNTIME_TRUTH_V1_4_EXACT" app-server.mjs
grep -q "pumpCreatedAt" src/evaluate.mjs
grep -q "dexPriceSol" src/dex-verification-gate.mjs
grep -q "holderTokenAccountCount" src/enrich.mjs
grep -q "pump-trade-event-60s-sol-flow" src/pump-live-trade-feed.mjs
! grep -q "dexMarketLocked" src/enrich.mjs
! grep -q "__stopPumpPriceTimerForDex" app-server.mjs
! grep -q "marketSource: 'dexscreener'" src/dex-verification-gate.mjs

trap - ERR INT TERM

log "SUCCESS: $PATCH_NAME applied and all tests passed."
log "Backup: $BACKUP"
log "Key behavior:"
log "  - Pump/Solana is the canonical discovery, age, market and holder decision source"
log "  - DEX is verification/display only and cannot overwrite decision evidence"
log "  - Pump creation age uses Solana block time; legacy rows are backfilled in the background"
log "  - DEX-confirmed tokens keep the canonical Pump price lifecycle running"
log "  - canonical Pump market freshness is enforced independently from DEX display refreshes"
log "  - holder risk count remains unique wallets; positive token-account count is exposed separately"
log "  - holder GPA work is queue-controlled with bounded concurrency and method-specific timeouts"
log "  - paper entry freshness ignores generic metadata/display updates"
log ""
log "Restart the Replit workflow/app after SUCCESS."
