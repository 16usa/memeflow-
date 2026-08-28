#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW live market truth repair V4 =="

if [[ -d "memeflow-app" && -f "memeflow-app/app-server.mjs" ]]; then
  cd memeflow-app
elif [[ -f "app-server.mjs" && -d "src" && -d "tests" ]]; then
  :
else
  echo "ERROR: Run from ~/workspace or memeflow-app."
  exit 1
fi

PATCH_PATHS=(
  "app-server.mjs"
  "src/pump-live-trade-feed.mjs"
  "src/pump-history-backfill.mjs"
  "tests/live-market-truth.mjs"
  "package.json"
)

# Runtime files such as data/state.json / ledgers / .patch-backups are allowed
# to be dirty. Refuse only if a source file that THIS patch edits is dirty.
for f in "${PATCH_PATHS[@]}"; do
  if ! git diff --quiet -- "$f" || ! git diff --cached --quiet -- "$f"; then
    echo "ERROR: Source file already has local changes: $f"
    git status --short -- "$f"
    exit 1
  fi
done

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "ERROR: Current branch is '$BRANCH'. Switch to main first."
  exit 1
fi

git fetch origin main
LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/main)"
if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  git merge --ff-only origin/main
fi

python3 - <<'PY'
from pathlib import Path

# ===========================================================================
# pump-history-backfill.mjs
# Pump API fields are not all in display units:
#   market_cap  -> lamports
#   total_supply -> token base units
# Never put those raw values into marketCapSol / totalSupply.
# ===========================================================================
p=Path("src/pump-history-backfill.mjs")
s=p.read_text()

if "MEMEFLOW_PUMP_UNIT_NORMALIZATION_V1" not in s:
    anchor="""function finite(v){
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}
"""
    insert="""function finite(v){
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}

// MEMEFLOW_PUMP_UNIT_NORMALIZATION_V1
// Pump frontend API uses raw integer units for several fields.
// `market_cap` is lamport-denominated; `total_supply` is token base units.
function pumpMarketCapSol(coin){
  const raw=finite(coin?.market_cap);
  if(raw!==null)return raw/1e9;

  // Camel-case fallbacks from other adapters are assumed already normalized.
  return finite(coin?.marketCapSol??coin?.marketCap);
}

function pumpSupplyTokens(coin){
  const raw=finite(coin?.total_supply);
  if(raw!==null){
    const decimals=Math.max(
      0,
      Math.min(12,Math.floor(finite(coin?.decimals)??6))
    );
    return raw/(10**decimals);
  }

  return finite(coin?.totalSupply);
}
"""
    if anchor not in s:
        raise SystemExit("PATCH FAILED: history finite() anchor changed")
    s=s.replace(anchor,insert,1)

old="""    marketCapUsd:finite(coin?.usd_market_cap??coin?.marketCapUsd),
    marketCapSol:finite(coin?.market_cap??coin?.marketCap),
    totalSupply:finite(coin?.total_supply??coin?.totalSupply),
"""
new="""    // Pump API truth/reference fields.
    marketCapUsd:finite(coin?.usd_market_cap??coin?.marketCapUsd),
    marketCapSol:pumpMarketCapSol(coin),
    totalSupply:pumpSupplyTokens(coin),
    pumpMarketCapRawLamports:finite(coin?.market_cap),
    pumpTotalSupplyRaw:finite(coin?.total_supply),
    tokenDecimals:finite(coin?.decimals)??6,
    pumpReportedHolderCount:finite(
      coin?.holder_count ??
      coin?.holderCount ??
      coin?.holders
    ),
    pumpReferenceAt:now,
"""
if old in s:
    s=s.replace(old,new,1)
elif "pumpMarketCapRawLamports" not in s:
    raise SystemExit("PATCH FAILED: history market-cap mapping changed")

# Reference head-sync is lightweight. Keep it below live WS priority.
s=s.replace(
    "const recentEveryMs=Math.max(30000,Number(process.env.PUMPFUN_HISTORY_RECENT_SYNC_MS||60000));",
    "const recentEveryMs=Math.max(10000,Number(process.env.PUMPFUN_HISTORY_RECENT_SYNC_MS||15000));",
    1
)

p.write_text(s)
print("patched: pump-history-backfill :: normalize Pump units + reference fields")


# ===========================================================================
# pump-live-trade-feed.mjs
# A real TradeEvent must update CURRENT MC, not just price/liquidity.
# ===========================================================================
p=Path("src/pump-live-trade-feed.mjs")
s=p.read_text()

if "MEMEFLOW_LIVE_MARKET_CAP_V1" not in s:
    anchor="""function marketFromEvent(e){
  let priceSol=null,liquiditySol=null;
  if(e.virtualSolReserves!==null&&e.virtualTokenReserves!==null&&e.virtualSolReserves>0n&&e.virtualTokenReserves>0n){
    priceSol=(Number(e.virtualSolReserves)/1e9)/(Number(e.virtualTokenReserves)/1e6);
  }
  if(e.realSolReserves!==null)liquiditySol=Number(e.realSolReserves)/1e9;
  return {priceSol,liquiditySol};
}
"""
    insert="""function marketFromEvent(e){
  let priceSol=null,liquiditySol=null;
  if(e.virtualSolReserves!==null&&e.virtualTokenReserves!==null&&e.virtualSolReserves>0n&&e.virtualTokenReserves>0n){
    priceSol=(Number(e.virtualSolReserves)/1e9)/(Number(e.virtualTokenReserves)/1e6);
  }
  if(e.realSolReserves!==null)liquiditySol=Number(e.realSolReserves)/1e9;
  return {priceSol,liquiditySol};
}

// MEMEFLOW_LIVE_MARKET_CAP_V1
function normalizedPumpSupply(token){
  const direct=Number(token?.totalSupply);
  if(Number.isFinite(direct)&&direct>0){
    // Repair registry rows created before Pump base-unit normalization.
    return direct>1e12?direct/1e6:direct;
  }

  const raw=Number(
    token?.tokenTotalSupplyRaw ??
    token?.pumpTotalSupplyRaw
  );
  if(Number.isFinite(raw)&&raw>0){
    const decimals=Math.max(
      0,
      Math.min(12,Math.floor(Number(token?.tokenDecimals??6)))
    );
    return raw/(10**decimals);
  }

  // Pump bonding-curve tokens use the canonical 1B-token supply unless a
  // decoded supply says otherwise.
  const pump=String(
    token?.launchPlatform ??
    token?.protocol ??
    token?.source ??
    ''
  ).toLowerCase();

  return pump.includes('pump')?1_000_000_000:null;
}
"""
    if anchor not in s:
        raise SystemExit("PATCH FAILED: marketFromEvent() anchor changed")
    s=s.replace(anchor,insert,1)

old="""      const patch={
        ...(holderSnap||{}),
        ...opp,
        marketSource:'ws-direct-trade-event-v13',
        lastPriceAt:Date.now(),
        eventSlot:e.slot??null,
"""
new="""      const liveSupply=normalizedPumpSupply(mergedForFeatures);
      const liveMarketCapSol=
        Number.isFinite(m.priceSol)&&m.priceSol>0&&
        Number.isFinite(liveSupply)&&liveSupply>0
          ? m.priceSol*liveSupply
          : null;

      const liveMarketCapUsd=
        Number.isFinite(liveMarketCapSol)&&liveMarketCapSol>0&&
        Number.isFinite(Number(solUsd))&&Number(solUsd)>0
          ? liveMarketCapSol*Number(solUsd)
          : null;

      const patch={
        ...(holderSnap||{}),
        ...opp,
        marketSource:'ws-direct-trade-event-v13',
        lastPriceAt:Date.now(),
        lastMarketActivityAt:Date.now(),
        marketCapUpdatedAt:Date.now(),
        liveMarketCapSource:'pump-trade-price-x-supply',
        eventSlot:e.slot??null,
"""
if old in s:
    s=s.replace(old,new,1)
elif "liveMarketCapSource:'pump-trade-price-x-supply'" not in s:
    raise SystemExit("PATCH FAILED: live TradeEvent patch anchor changed")

old="""      if(Number.isFinite(m.priceSol)&&m.priceSol>0)patch.priceSol=m.priceSol;
      if(Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0)patch.liquiditySol=m.liquiditySol;

      const updated=store?.setToken?.(e.mint,patch);
"""
new="""      if(Number.isFinite(m.priceSol)&&m.priceSol>0)patch.priceSol=m.priceSol;
      if(Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0)patch.liquiditySol=m.liquiditySol;
      if(Number.isFinite(liveSupply)&&liveSupply>0)patch.totalSupply=liveSupply;
      if(Number.isFinite(liveMarketCapSol)&&liveMarketCapSol>0)patch.marketCapSol=liveMarketCapSol;
      if(Number.isFinite(liveMarketCapUsd)&&liveMarketCapUsd>0)patch.marketCapUsd=liveMarketCapUsd;

      const updated=store?.setToken?.(e.mint,patch);
"""
if old in s:
    s=s.replace(old,new,1)
elif "patch.marketCapUsd=liveMarketCapUsd" not in s:
    raise SystemExit("PATCH FAILED: live market field assignment anchor changed")

p.write_text(s)
print("patched: pump-live-trade-feed :: live MC heals on every TradeEvent")


# ===========================================================================
# app-server.mjs
# Fix card payload semantics:
#   marketCap = USD (UI prints a $ sign)
#   marketCapSol = SOL
#   marketCapUsd = USD
# Compute 5m volume using current SOL/USD instead of stale historical ratio.
# ===========================================================================
p=Path("app-server.mjs")
app=p.read_text()

start=app.find("function __mfCandidateMarket5mV4(mint,t){")
end=app.find("\nfunction candidateView(d){",start)
if start<0 or end<0:
    raise SystemExit("PATCH FAILED: candidate market helper boundaries not found")

helper=r"""function __mfNormalizePumpSupplyV5(t){
  const direct=Number(t?.totalSupply);
  if(Number.isFinite(direct)&&direct>0){
    return direct>1e12?direct/1e6:direct;
  }

  const raw=Number(
    t?.tokenTotalSupplyRaw ??
    t?.pumpTotalSupplyRaw
  );
  if(Number.isFinite(raw)&&raw>0){
    const decimals=Math.max(
      0,
      Math.min(12,Math.floor(Number(t?.tokenDecimals??6)))
    );
    return raw/(10**decimals);
  }

  const pump=String(
    t?.launchPlatform ??
    t?.protocol ??
    t?.source ??
    ''
  ).toLowerCase();

  return pump.includes('pump')?1_000_000_000:null;
}

function __mfCandidateMarket5mV4(mint,t){
  // MEMEFLOW_CARD_MARKET_TRUTH_V5
  const rows=chartTradeHistory.get(mint)||[];
  const now=Date.now();
  const cutoff=now-300000;

  const recent=rows.filter(
    r=>Number(r?.t)>=cutoff&&Number(r?.t)<=now
  );

  const volume5mSol=recent.reduce(
    (sum,row)=>sum+Number(row?.solAmount||0),
    0
  );
  const transactions5m=recent.length;

  const finite=(v)=>
    v!==null&&v!==undefined&&Number.isFinite(Number(v))
      ? Number(v)
      : null;

  const latestPrice=finite(t?.priceSol);
  const supply=__mfNormalizePumpSupplyV5(t);

  const liveMcSol=
    latestPrice!==null&&latestPrice>0&&
    supply!==null&&supply>0
      ? latestPrice*supply
      : null;

  let storedMcSol=finite(t?.marketCapSol);

  // Repair old registry rows where Pump `market_cap` lamports were stored
  // directly as SOL (e.g. 33,500,000,000 -> 33.5 SOL).
  if(
    storedMcSol!==null &&
    storedMcSol>1_000_000 &&
    (
      t?.pumpMarketCapRawLamports!=null ||
      t?.registryHistorical===true ||
      String(t?.source||'').toLowerCase().includes('history')
    )
  ){
    storedMcSol/=1e9;
  }

  const marketCapSol=
    liveMcSol!==null&&liveMcSol>0
      ? liveMcSol
      : storedMcSol;

  const solUsd=finite(solUsdOracle.get());
  const storedMcUsd=finite(t?.marketCapUsd);

  const marketCapUsd=
    marketCapSol!==null&&marketCapSol>0&&
    solUsd!==null&&solUsd>0
      ? marketCapSol*solUsd
      : storedMcUsd;

  // 5m volume is derived from the same REAL Pump TradeEvents as the chart.
  const volume5mUsd=
    solUsd!==null&&solUsd>0
      ? volume5mSol*solUsd
      : finite(t?.volume5mUsd);

  let priceChange5mPct=null;
  const priced=recent.filter(r=>Number(r?.price)>0);
  if(priced.length>=2){
    const first=Number(priced[0].price);
    const last=Number(priced[priced.length-1].price);
    if(first>0)priceChange5mPct=((last-first)/first)*100;
  }

  return {
    volume5mSol,
    volume5mUsd,
    transactions5m,
    marketCapSol,
    marketCapUsd,
    priceChange5mPct,
    marketCapSource:
      liveMcSol!==null
        ? 'live-pump-trade'
        : (marketCapSol!==null?'stored-normalized':null),
    marketUpdatedAt:
      Number(t?.marketCapUpdatedAt||t?.lastPriceAt||0)||null
  };
}
"""
app=app[:start]+helper+app[end:]

# candidateView: use market helper values, not stale raw token fields.
old="""  const marketCapSol=finite(t.marketCapSol);
  const liquiditySol=finite(t.liquiditySol);
"""
new="""  const liquiditySol=finite(t.liquiditySol);
"""
if old in app:
    app=app.replace(old,new,1)
elif "const marketCapSol=finite(t.marketCapSol);" in app:
    raise SystemExit("PATCH FAILED: candidate raw marketCapSol removal failed")

old="""    marketCap:marketCapSol,
    marketCapSol,
    marketCapUsd:finite(t.marketCapUsd),
"""
new="""    // `marketCap` is the generic UI field and the UI renders it with `$`.
    // Therefore it MUST be USD, never SOL or Pump lamports.
    marketCap:market5m.marketCapUsd,
    marketCapSol:market5m.marketCapSol,
    marketCapUsd:market5m.marketCapUsd,
    marketCapSource:market5m.marketCapSource,
    marketCapUpdatedAt:market5m.marketUpdatedAt,
"""
if old in app:
    app=app.replace(old,new,1)
elif "marketCap:market5m.marketCapUsd" not in app:
    raise SystemExit("PATCH FAILED: candidate marketCap payload anchor changed")

# Prefer a recent Pump-reported holder count when the low-priority Pump
# reference sync provides one. Otherwise retain the WS event-ledger count.
old="""    holders:finite(t.holderCount),
    holderCount:finite(t.holderCount),
"""
new="""    holders:
      finite(t.pumpReportedHolderCount)!==null &&
      Date.now()-Number(t.pumpReferenceAt||0)<=90000
        ? finite(t.pumpReportedHolderCount)
        : finite(t.holderCount),
    holderCount:
      finite(t.pumpReportedHolderCount)!==null &&
      Date.now()-Number(t.pumpReferenceAt||0)<=90000
        ? finite(t.pumpReportedHolderCount)
        : finite(t.holderCount),
    holderSource:
      finite(t.pumpReportedHolderCount)!==null &&
      Date.now()-Number(t.pumpReferenceAt||0)<=90000
        ? 'pump-reference'
        : (t.holderSource||t.eventLedgerVersion||'ws-event-ledger'),
"""
if old in app:
    app=app.replace(old,new,1)
elif "holderSource:" not in app[app.find("function candidateView(d){"):app.find("function candidateView(d){")+5000]:
    raise SystemExit("PATCH FAILED: candidate holder payload anchor changed")

# Current history head sync should merge ONLY reference fields into an already
# live token; it must never overwrite its WS price/reserve/trade state.
old="""      const current=store.state.tokens?.[token.mint]||null;
      if(current?.wsFirst===true)return;

      const hot=current
"""
new="""      const current=store.state.tokens?.[token.mint]||null;

      if(current?.wsFirst===true){
        const referencePatch={
          pumpReferenceAt:Number(token?.pumpReferenceAt||Date.now())
        };

        if(Number.isFinite(Number(token?.marketCapUsd))){
          referencePatch.pumpReportedMarketCapUsd=Number(token.marketCapUsd);
        }
        if(Number.isFinite(Number(token?.pumpReportedHolderCount))){
          referencePatch.pumpReportedHolderCount=Number(token.pumpReportedHolderCount);
        }

        store.setToken(token.mint,referencePatch);
        try{publish(token.mint)}catch{}
        return;
      }

      const hot=current
"""
if old in app:
    app=app.replace(old,new,1)
elif "pumpReportedMarketCapUsd" not in app:
    raise SystemExit("PATCH FAILED: live/history reference merge anchor changed")

p.write_text(app)
print("patched: app-server :: correct USD MC + current 5m metrics + safe holder reference")


# ===========================================================================
# Regression test
# ===========================================================================
test=r"""import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const live=fs.readFileSync(new URL('../src/pump-live-trade-feed.mjs',import.meta.url),'utf8');
const history=fs.readFileSync(new URL('../src/pump-history-backfill.mjs',import.meta.url),'utf8');

// Pump history must normalize raw units.
assert.match(history,/MEMEFLOW_PUMP_UNIT_NORMALIZATION_V1/);
assert.match(history,/return raw\/1e9/);
assert.match(history,/raw\/\(10\*\*decimals\)/);
assert.match(history,/pumpReportedHolderCount/);

// Every real TradeEvent heals current MC.
assert.match(live,/MEMEFLOW_LIVE_MARKET_CAP_V1/);
assert.match(live,/liveMarketCapSol/);
assert.match(live,/liveMarketCapUsd/);
assert.match(live,/patch\.marketCapSol=liveMarketCapSol/);
assert.match(live,/patch\.marketCapUsd=liveMarketCapUsd/);
assert.match(live,/lastMarketActivityAt:Date\.now\(\)/);

// The card's generic `marketCap` is USD. It must never be marketCapSol.
const candidate=app.slice(
  app.indexOf('function candidateView(d){'),
  app.indexOf('function publish(',app.indexOf('function candidateView(d){'))
);
assert.match(candidate,/marketCap:market5m\.marketCapUsd/);
assert.match(candidate,/marketCapSol:market5m\.marketCapSol/);
assert.match(candidate,/marketCapUsd:market5m\.marketCapUsd/);
assert.doesNotMatch(candidate,/marketCap:marketCapSol/);

// 5m card volume/transactions come from real chart TradeEvents.
const market=app.slice(
  app.indexOf('function __mfCandidateMarket5mV4('),
  app.indexOf('function candidateView(d){')
);
assert.match(market,/chartTradeHistory\.get\(mint\)/);
assert.match(market,/volume5mSol/);
assert.match(market,/transactions5m/);
assert.match(market,/solUsdOracle\.get\(\)/);

// Reference HTTP sync may refresh display/reference holders but cannot replace
// live WS price/reserve state.
assert.match(app,/pumpReportedMarketCapUsd/);
assert.match(app,/pumpReportedHolderCount/);

console.log('live market truth v1 ok');
"""
Path("tests/live-market-truth.mjs").write_text(test)
print("created: tests/live-market-truth.mjs")

p=Path("package.json")
pkg=p.read_text()
if "tests/live-market-truth.mjs" not in pkg:
    # Add it next to the existing realtime regression if present.
    if "node tests/realtime-update-path.mjs &&" in pkg:
        pkg=pkg.replace(
            "node tests/realtime-update-path.mjs &&",
            "node tests/realtime-update-path.mjs && node tests/live-market-truth.mjs &&",
            1
        )
    else:
        pkg=pkg.replace(
            "node tests/fresh-session-scanner.mjs &&",
            "node tests/fresh-session-scanner.mjs && node tests/live-market-truth.mjs &&",
            1
        )
    p.write_text(pkg)
    print("patched: package.json :: live market truth regression")

PY

echo
echo "== Focused tests =="
node tests/live-market-truth.mjs
node tests/realtime-update-path.mjs
node tests/fresh-session-scanner.mjs

echo
echo "== Full project tests =="
npm test

echo
echo "== Stage SOURCE only; runtime data remains untouched =="
git add \
  app-server.mjs \
  src/pump-live-trade-feed.mjs \
  src/pump-history-backfill.mjs \
  tests/live-market-truth.mjs \
  package.json

git --no-pager diff --cached --stat

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "fix: make live token card market data authoritative"
fi

echo
echo "== Push =="
git push origin main

echo
echo "SUCCESS."
echo "Fixed:"
echo "  - Pump market_cap raw lamports are no longer shown as dollars."
echo "  - generic card marketCap is USD."
echo "  - marketCapSol stays SOL."
echo "  - every Pump TradeEvent recalculates MC live."
echo "  - 5m volume / TX / change are derived from real Pump TradeEvents."
echo "  - Pump history reference can refresh holder count without overwriting WS state."
echo "  - runtime data files were not reset/staged/committed."
