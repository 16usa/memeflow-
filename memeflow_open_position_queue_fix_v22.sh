#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
if [[ -f "$ROOT/app-server.mjs" && -f "$ROOT/system-tokens.js" ]]; then
  APP="$ROOT"
elif [[ -f "$ROOT/memeflow-app/app-server.mjs" && -f "$ROOT/memeflow-app/system-tokens.js" ]]; then
  APP="$ROOT/memeflow-app"
else
  echo "[error] Run this patch from the MEMEFLOW project root (where app-server.mjs exists, or where memeflow-app/ exists)."
  exit 1
fi

cd "$APP"

echo "==> MEMEFLOW V22: OPEN POSITION market restore + WATCH/WAITING score order"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".backups/v22-open-position-queue-$STAMP"
mkdir -p "$BACKUP_DIR/src"

for f in system-tokens.js app-server.mjs src/feed-ranking.mjs; do
  if [[ -f "$f" ]]; then
    cp -p "$f" "$BACKUP_DIR/$f"
  fi
done

echo "==> Backups: $BACKUP_DIR"

python3 - <<'PY'
from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count == 1:
        return text.replace(old, new, 1)
    if count == 0:
        raise SystemExit(f"[error] {label}: expected anchor not found")
    raise SystemExit(f"[error] {label}: anchor matched {count} times")

# ---------------------------------------------------------------------------
# 1) UI order: WATCH and WAITING are ONE score-ranked candidate pool.
# ---------------------------------------------------------------------------
ui_path = Path('system-tokens.js')
ui = ui_path.read_text(encoding='utf-8')

if 'MEMEFLOW_WATCH_WAITING_SCORE_ORDER_V22' not in ui:
    old = """function priority(row) {
  const key =
    stateKey(row?.decision?.state);

  return {
    open: 0,
    ready: 1,
    watch: 2,
    waiting: 3,
    blocked: 4
  }[key] ?? 5;
}
"""
    new = """// MEMEFLOW_WATCH_WAITING_SCORE_ORDER_V22
// WATCH and WAITING describe admission state, not list quality. They share the
// same visual priority so Score decides which live candidate is higher.
function priority(row) {
  const key =
    stateKey(row?.decision?.state);

  return {
    open: 0,
    ready: 1,
    watch: 2,
    waiting: 2,
    blocked: 4
  }[key] ?? 5;
}
"""
    ui = replace_once(ui, old, new, 'WATCH/WAITING priority')

if 'MEMEFLOW_SCORE_FIRST_TIEBREAK_V22' not in ui:
    old = """        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }

        return (
          Number(tokenAge(a) ?? 999999) -
          Number(tokenAge(b) ?? 999999)
        );
"""
    new = """        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }

        // MEMEFLOW_SCORE_FIRST_TIEBREAK_V22
        // Score is authoritative inside WATCH+WAITING. Only when Score ties do
        // current market facts decide order: activity -> MC -> holders -> age.
        const marketA = regularMarketMetrics(a);
        const marketB = regularMarketMetrics(b);

        const txA = finite(marketA?.transactions5m)
          ? Number(marketA.transactions5m)
          : -1;
        const txB = finite(marketB?.transactions5m)
          ? Number(marketB.transactions5m)
          : -1;
        if (txA !== txB) {
          return txB - txA;
        }

        const volumeA = finite(marketA?.volume5mUsd)
          ? Number(marketA.volume5mUsd)
          : finite(marketA?.volume5mSol)
            ? Number(marketA.volume5mSol)
            : -1;
        const volumeB = finite(marketB?.volume5mUsd)
          ? Number(marketB.volume5mUsd)
          : finite(marketB?.volume5mSol)
            ? Number(marketB.volume5mSol)
            : -1;
        if (volumeA !== volumeB) {
          return volumeB - volumeA;
        }

        const mcA = finite(marketA?.marketCapUsd)
          ? Number(marketA.marketCapUsd)
          : finite(marketA?.marketCapSol)
            ? Number(marketA.marketCapSol)
            : -1;
        const mcB = finite(marketB?.marketCapUsd)
          ? Number(marketB.marketCapUsd)
          : finite(marketB?.marketCapSol)
            ? Number(marketB.marketCapSol)
            : -1;
        if (mcA !== mcB) {
          return mcB - mcA;
        }

        const holdersA = finite(holderCount(a))
          ? Number(holderCount(a))
          : -1;
        const holdersB = finite(holderCount(b))
          ? Number(holderCount(b))
          : -1;
        if (holdersA !== holdersB) {
          return holdersB - holdersA;
        }

        return (
          Number(tokenAge(a) ?? 999999) -
          Number(tokenAge(b) ?? 999999)
        );
"""
    ui = replace_once(ui, old, new, 'score-first tie breakers')

# OPEN POSITION row must prefer the dedicated live-position lane over a stale
# scanner row for holder count and age.
if 'MEMEFLOW_OPEN_POSITION_LIVE_ROW_PRIORITY_V22' not in ui:
    old = """          holderCount:
            existing?.holderCount ??
            existing?.holders ??
            position?.tokenMetrics?.holderCount ??
            null,
          ageMinutes:
            existing?.ageMinutes ??
            existing?.tokenAgeMinutes ??
            position?.tokenMetrics?.ageMinutes ??
            null,
"""
    new = """          // MEMEFLOW_OPEN_POSITION_LIVE_ROW_PRIORITY_V22
          // The OPEN POSITION endpoint is the dedicated live lane. Prefer it
          // over a possibly stale scanner row for mutable position metrics.
          holderCount:
            position?.tokenMetrics?.holderCount ??
            existing?.holderCount ??
            existing?.holders ??
            null,
          ageMinutes:
            position?.tokenMetrics?.ageMinutes ??
            existing?.ageMinutes ??
            existing?.tokenAgeMinutes ??
            null,
"""
    ui = replace_once(ui, old, new, 'OPEN POSITION live row priority')

# Carry source metadata through canonical normalization so the UI never treats
# an unlabeled/stale MC as live.
if 'MEMEFLOW_CANONICAL_MC_SOURCE_V22' not in ui:
    old = """      marketCapUsd:
        row?.market?.marketCapUsd ??
        row?.marketCapUsd ??
        null,
      priceChange5mPct:
"""
    new = """      marketCapUsd:
        row?.market?.marketCapUsd ??
        row?.marketCapUsd ??
        null,
      // MEMEFLOW_CANONICAL_MC_SOURCE_V22
      marketCapSource:
        row?.market?.marketCapSource ??
        row?.marketCapSource ??
        null,
      marketUpdatedAt:
        row?.market?.marketUpdatedAt ??
        row?.marketCapUpdatedAt ??
        null,
      priceChange5mPct:
"""
    ui = replace_once(ui, old, new, 'canonical MC source')

# The OPEN POSITION market object itself should carry its dedicated telemetry,
# not only priceSol.
if 'MEMEFLOW_OPEN_POSITION_MARKET_OVERLAY_V22' not in ui:
    old = """          market: {
            ...(existing?.market || {}),
            priceSol:
              position?.currentPriceSol ??
              existing?.market?.priceSol ??
              existing?.priceSol ??
              null
          },
"""
    new = """          // MEMEFLOW_OPEN_POSITION_MARKET_OVERLAY_V22
          market: {
            ...(existing?.market || {}),
            priceSol:
              position?.currentPriceSol ??
              existing?.market?.priceSol ??
              existing?.priceSol ??
              null,
            volume5mSol:
              position?.tokenMetrics?.volume5mSol ??
              existing?.market?.volume5mSol ??
              existing?.volume5mSol ??
              null,
            volume5mUsd:
              position?.tokenMetrics?.volume5mUsd ??
              existing?.market?.volume5mUsd ??
              existing?.volume5mUsd ??
              null,
            transactions5m:
              position?.tokenMetrics?.transactions5m ??
              existing?.market?.transactions5m ??
              existing?.transactions5m ??
              null,
            marketCapSol:
              position?.tokenMetrics?.marketCapSol ??
              null,
            marketCapUsd:
              position?.tokenMetrics?.marketCapUsd ??
              null,
            marketCapSource:
              position?.tokenMetrics?.marketCapSource ??
              null,
            marketUpdatedAt:
              position?.tokenMetrics?.marketUpdatedAt ??
              position?.tokenMetrics?.snapshotAt ??
              null,
            priceChange5mPct:
              position?.tokenMetrics?.priceChange5mPct ??
              null
          },
"""
    ui = replace_once(ui, old, new, 'OPEN POSITION market overlay')

ui_path.write_text(ui, encoding='utf-8')
print('patched system-tokens.js')

# ---------------------------------------------------------------------------
# 2) Backend OPEN POSITION lane: warm market history from the persistent Pump
#    TradeEvent archive, not only the bounded RAM map. This is the root fix for
#    old/open positions showing MC/5m% as "—" after cache eviction/restart.
# ---------------------------------------------------------------------------
app_path = Path('app-server.mjs')
app = app_path.read_text(encoding='utf-8')

if 'MEMEFLOW_OPEN_POSITION_ARCHIVE_MARKET_V22' not in app:
    anchor = """}

// MEMEFLOW_REALTIME_UI_FAIRNESS_V1
"""
    helper = r"""}

// MEMEFLOW_OPEN_POSITION_ARCHIVE_MARKET_V22
// OPEN POSITION survives scanner/cache churn, therefore its market snapshot
// must survive it too. Warm each open mint once from the persistent REAL Pump
// TradeEvent archive and then keep using the hot RAM map for subsequent ticks.
const __mfOpenPositionArchiveWarmedV22=new Set();

function __mfOpenPositionMarket5mV22(mint,t,now=Date.now()){
  let rows=Array.isArray(chartTradeHistory.get(mint))
    ? chartTradeHistory.get(mint).slice()
    : [];

  if(!__mfOpenPositionArchiveWarmedV22.has(mint)){
    try{
      const merged=__mfChartArchive.mergePointsSync(mint,rows);

      if(Array.isArray(merged)){
        rows=merged
          .filter(point=>{
            const ts=Number(point?.t);
            return Number.isFinite(ts)&&ts>0&&ts<=now+30000;
          })
          .sort((a,b)=>Number(a.t)-Number(b.t))
          .slice(-1200);

        if(rows.length){
          chartTradeHistory.delete(mint);
          chartTradeHistory.set(mint,rows);
        }

        __mfOpenPositionArchiveWarmedV22.add(mint);
      }
    }catch{}
  }

  const snapshot=liveCardMarketSnapshot({
    token:t||{},
    points:rows,
    solUsd:solUsdOracle.get(),
    now,
    windowMs:300000
  });

  // V19 computes 5m% from two recent points. For an old OPEN POSITION we can
  // do better because the archive contains the last trade at/before the 5m
  // boundary. Price changes only on a real Pump TradeEvent, so that point is a
  // valid 5m baseline; no synthetic candles or timer prices are created.
  if(
    snapshot.priceChange5mPct===null&&
    Number(snapshot.currentPriceSol)>0&&
    rows.length
  ){
    const cutoff=now-300000;
    let baseline=null;

    for(const point of rows){
      const ts=Number(point?.t);
      const price=Number(point?.priceSol??point?.price);

      if(!(Number.isFinite(ts)&&ts>0&&Number.isFinite(price)&&price>0)){
        continue;
      }

      if(ts<=cutoff){
        baseline=price;
        continue;
      }

      break;
    }

    if(Number(baseline)>0){
      snapshot.priceChange5mPct=
        ((Number(snapshot.currentPriceSol)-Number(baseline))/Number(baseline))*100;
    }
  }

  return snapshot;
}

// MEMEFLOW_REALTIME_UI_FAIRNESS_V1
"""
    if app.count(anchor) != 1:
        raise SystemExit(f"[error] open-position archive helper anchor count={app.count(anchor)}")
    app = app.replace(anchor, helper, 1)

if 'MEMEFLOW_OPEN_POSITION_USE_ARCHIVE_V22' not in app:
    old = """        try{
          market=__mfCandidateMarket5mV4(
            mint,
            token
          );
        }catch{
          market=null;
        }
"""
    new = """        try{
          // MEMEFLOW_OPEN_POSITION_USE_ARCHIVE_V22
          market=__mfOpenPositionMarket5mV22(
            mint,
            token,
            now
          );
        }catch{
          market=null;
        }
"""
    # This exact block should occur in /api/paper/positions/live. If the same
    # formatting exists elsewhere, target the first occurrence after the route.
    route = app.find("if(url.pathname==='/api/paper/positions/live'&&req.method==='GET')")
    if route < 0:
        raise SystemExit('[error] /api/paper/positions/live route not found')
    idx = app.find(old, route)
    if idx < 0:
        raise SystemExit('[error] live-position market block not found')
    app = app[:idx] + new + app[idx+len(old):]

if 'MEMEFLOW_OPEN_POSITION_HOLDER_FALLBACK_V22' not in app:
    old = """            holderCount:finite(token.holderCount),
            volume5mSol:finite(market?.volume5mSol),
"""
    new = """            // MEMEFLOW_OPEN_POSITION_HOLDER_FALLBACK_V22
            holderCount:
              finite(token.holderCount) ??
              finite(eventHolderLedger?.inspect?.(mint)?.holderCount),
            volume5mSol:finite(market?.volume5mSol),
"""
    route = app.find("if(url.pathname==='/api/paper/positions/live'&&req.method==='GET')")
    idx = app.find(old, route)
    if idx < 0:
        raise SystemExit('[error] live-position holder block not found')
    app = app[:idx] + new + app[idx+len(old):]

if 'MEMEFLOW_OPEN_POSITION_MARKET_UPDATED_AT_V22' not in app:
    old = """            marketCapSource:liveMc.marketCapSource,
            priceChange5mPct:finite(market?.priceChange5mPct),
"""
    new = """            marketCapSource:liveMc.marketCapSource,
            // MEMEFLOW_OPEN_POSITION_MARKET_UPDATED_AT_V22
            marketUpdatedAt:finite(market?.marketUpdatedAt),
            priceChange5mPct:finite(market?.priceChange5mPct),
"""
    route = app.find("if(url.pathname==='/api/paper/positions/live'&&req.method==='GET')")
    idx = app.find(old, route)
    if idx < 0:
        raise SystemExit('[error] live-position marketUpdatedAt block not found')
    app = app[:idx] + new + app[idx+len(old):]

app_path.write_text(app, encoding='utf-8')
print('patched app-server.mjs')
PY

echo "==> Syntax checks"
node --check system-tokens.js
node --check app-server.mjs
node --check src/feed-ranking.mjs

echo "==> Focused regression checks"
python3 - <<'PY'
from pathlib import Path
ui=Path('system-tokens.js').read_text(encoding='utf-8')
app=Path('app-server.mjs').read_text(encoding='utf-8')
feed=Path('src/feed-ranking.mjs').read_text(encoding='utf-8')

required_ui=[
  'MEMEFLOW_WATCH_WAITING_SCORE_ORDER_V22',
  'watch: 2,',
  'waiting: 2,',
  'MEMEFLOW_SCORE_FIRST_TIEBREAK_V22',
  'MEMEFLOW_OPEN_POSITION_LIVE_ROW_PRIORITY_V22',
  'MEMEFLOW_OPEN_POSITION_MARKET_OVERLAY_V22'
]
required_app=[
  'MEMEFLOW_OPEN_POSITION_ARCHIVE_MARKET_V22',
  'MEMEFLOW_OPEN_POSITION_USE_ARCHIVE_V22',
  '__mfChartArchive.mergePointsSync(mint,rows)',
  'MEMEFLOW_OPEN_POSITION_HOLDER_FALLBACK_V22',
  'MEMEFLOW_OPEN_POSITION_MARKET_UPDATED_AT_V22'
]
for marker in required_ui:
    assert marker in ui, marker
for marker in required_app:
    assert marker in app, marker
assert 'MEMEFLOW_FEED_RELEVANCE_RANKING_V2' in feed, 'feed ranking V2 missing'

# The old UI bug must be gone: WAITING cannot have a lower visual priority than WATCH.
priority_block=ui[ui.index('function priority(row)'):ui.index('function sortRows(rows)')]
assert 'watch: 2' in priority_block
assert 'waiting: 2' in priority_block
assert 'waiting: 3' not in priority_block

print('focused regression checks: PASS')
PY

# Run the project suite when it exists. Abort before commit/push on a real test failure.
if [[ -f package.json ]]; then
  if node -e 'const p=require("./package.json"); process.exit(p.scripts&&p.scripts.test?0:1)' 2>/dev/null; then
    echo "==> npm test"
    npm test
  else
    echo "==> package.json has no test script; focused checks completed"
  fi
fi

echo "==> Git diff summary"
git diff --stat -- system-tokens.js app-server.mjs src/feed-ranking.mjs || true

# Include src/feed-ranking.mjs because the user's previous V21 attempt may have
# already modified it before aborting. We only stage the intended fix files.
git add system-tokens.js app-server.mjs src/feed-ranking.mjs

if git diff --cached --quiet; then
  echo "==> No staged differences: V22 is already applied."
  exit 0
fi

COMMIT_MSG="fix live token queue and open position market data v22"
git commit -m "$COMMIT_MSG"

echo "==> Pushing current branch"
git push

echo
printf '%s\n' "DONE: V22 applied, tested, committed and pushed." \
  "- OPEN POSITION restores real Pump TradeEvent history from local archive." \
  "- MC uses the latest real trade mark; no stale stored-MC fallback." \
  "- 5m% uses a real archived boundary trade when available." \
  "- WATCH and WAITING share one visual pool; higher Score is above lower Score." \
  "- Score ties use Tx 5m, Vol 5m, MC, holders, then age."
