#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW MC CONFLICT FIX V21.1"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "============================================================"
echo " $PATCH_NAME"
echo "============================================================"

find_app_dir() {
  local candidates=(
    "$PWD"
    "$PWD/memeflow-app"
    "$HOME/workspace"
    "$HOME/workspace/memeflow-app"
    "/workspace"
    "/workspace/memeflow-app"
    "/home/runner/workspace"
    "/home/runner/workspace/memeflow-app"
  )

  local dir
  for dir in "${candidates[@]}"; do
    if [[ -f "$dir/app-server.mjs" && -f "$dir/system-tokens.js" && -f "$dir/src/live-card-market.mjs" ]]; then
      printf '%s\n' "$dir"
      return 0
    fi
  done

  local found=""
  found="$(find "$HOME" /workspace /home/runner/workspace \
    -maxdepth 5 \
    -type f \
    -name app-server.mjs \
    2>/dev/null \
    | head -n 1 || true)"

  if [[ -n "$found" ]]; then
    dir="$(dirname "$found")"
    if [[ -f "$dir/system-tokens.js" && -f "$dir/src/live-card-market.mjs" ]]; then
      printf '%s\n' "$dir"
      return 0
    fi
  fi

  return 1
}

APP_DIR="$(find_app_dir || true)"

if [[ -z "$APP_DIR" ]]; then
  echo "ERROR: MEMEFLOW application directory was not found."
  exit 1
fi

cd "$APP_DIR"

echo "[1/9] Project directory: $APP_DIR"

TARGETS=(
  "app-server.mjs"
  "system-tokens.js"
  "src/live-card-market.mjs"
  "package.json"
)

for file in "${TARGETS[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "ERROR: Required file is missing: $file"
    exit 1
  fi
done

BACKUP_DIR=".memeflow-mc-v21-1-backup-$STAMP"
mkdir -p "$BACKUP_DIR/src" "$BACKUP_DIR/tests"

cp app-server.mjs "$BACKUP_DIR/app-server.mjs"
cp system-tokens.js "$BACKUP_DIR/system-tokens.js"
cp src/live-card-market.mjs "$BACKUP_DIR/src/live-card-market.mjs"
cp package.json "$BACKUP_DIR/package.json"

if [[ -f tests/mc-conflict-v21-1.mjs ]]; then
  cp tests/mc-conflict-v21-1.mjs "$BACKUP_DIR/tests/mc-conflict-v21-1.mjs"
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git status --porcelain > "$BACKUP_DIR/pre-patch-git-status.txt" || true
  git diff --binary > "$BACKUP_DIR/pre-patch-working-tree.patch" || true
  git diff --cached --binary > "$BACKUP_DIR/pre-patch-index.patch" || true
fi

echo "[2/9] Backup created: $BACKUP_DIR"
echo "Existing local changes are preserved and will not block this installer."

rollback() {
  local code=$?

  if [[ $code -eq 0 ]]; then
    return 0
  fi

  echo
  echo "ERROR: Patch failed. Restoring the exact pre-patch target files."

  cp "$BACKUP_DIR/app-server.mjs" app-server.mjs
  cp "$BACKUP_DIR/system-tokens.js" system-tokens.js
  cp "$BACKUP_DIR/src/live-card-market.mjs" src/live-card-market.mjs
  cp "$BACKUP_DIR/package.json" package.json

  if [[ -f "$BACKUP_DIR/tests/mc-conflict-v21-1.mjs" ]]; then
    cp "$BACKUP_DIR/tests/mc-conflict-v21-1.mjs" tests/mc-conflict-v21-1.mjs
  else
    rm -f tests/mc-conflict-v21-1.mjs
  fi

  echo "Pre-patch files restored."
  exit "$code"
}

trap rollback ERR

echo "[3/9] Applying conflict repair."

python3 <<'PY'
from pathlib import Path
import json

app_path = Path("app-server.mjs")
ui_path = Path("system-tokens.js")
market_path = Path("src/live-card-market.mjs")
package_path = Path("package.json")
test_path = Path("tests/mc-conflict-v21-1.mjs")

app = app_path.read_text(encoding="utf-8")
ui = ui_path.read_text(encoding="utf-8")
market = market_path.read_text(encoding="utf-8")

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"ERROR: Expected exactly one {label} block, found {count}."
        )
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------------
# 1. Live MC must come only from an accepted real TradeEvent price.
#    Pump reference, stored USD MC, and stored token price are not live truth.
# ---------------------------------------------------------------------------
if "MEMEFLOW_TRADE_EVENT_ONLY_LIVE_MC_V21_1" not in market:
    old_current = '''  const currentPrice=
    latestTradePrice ??
    (
      tokenHasTradeEvidence
        ? tokenPrice
        : null
    );
'''

    new_current = '''  // MEMEFLOW_TRADE_EVENT_ONLY_LIVE_MC_V21_1
  // Live card MC is derived only from an accepted real TradeEvent point.
  // Stored token price can survive a restart and must not masquerade as live.
  const currentPrice=latestTradePrice;
'''

    market = replace_once(
        market,
        old_current,
        new_current,
        "live current-price selection"
    )

    start = market.find("  const pumpReferenceUsd=finite(")

    if start >= 0:
        end = market.find("  const volume5mUsd=", start)
        if end < 0:
            raise SystemExit(
                "ERROR: Live market-cap fallback boundary was not found."
            )

        replacement = '''  // MEMEFLOW_NO_REFERENCE_OR_STORED_MC_FALLBACK_V21_1
  // No accepted TradeEvent price means no current live market cap.
  const marketCapUsd=
    marketCapSol!==null&&
    marketCapSol>0&&
    usd!==null&&
    usd>0
      ? marketCapSol*usd
      : null;

'''

        market = market[:start] + replacement + market[end:]
    elif "MEMEFLOW_NO_REFERENCE_OR_STORED_MC_FALLBACK_V21_1" not in market:
        raise SystemExit(
            "ERROR: Old live market-cap fallback was not found."
        )

    old_source = '''  if(latestTradePrice!==null){
    marketCapSource='chart-trade-event';
  }else if(tokenHasTradeEvidence){
    marketCapSource='token-live-trade';
  }else if(pumpReferenceUsd!==null){
    marketCapSource='pump-reference';
  }
'''

    alt_source = '''  if(latestTradePrice!==null){
    marketCapSource='chart-trade-event';
  }else if(tokenHasTradeEvidence){
    marketCapSource='token-live-trade';
  }
'''

    new_source = '''  if(latestTradePrice!==null){
    marketCapSource='chart-trade-event';
  }
'''

    if old_source in market:
        market = market.replace(old_source, new_source, 1)
    elif alt_source in market:
        market = market.replace(alt_source, new_source, 1)
    elif new_source not in market:
        raise SystemExit(
            "ERROR: Live market-cap source selection was not found."
        )

# ---------------------------------------------------------------------------
# 2. Restore persisted real TradeEvent rows into the hot card cache.
#    This covers OPEN POSITION and regular mounted cards after Stop -> Run.
# ---------------------------------------------------------------------------
if "MEMEFLOW_CARD_HISTORY_RESTORE_V21_1" not in app:
    old_decl = "const chartTradeStreams=new Map(),chartTradeHistory=new Map();"

    new_decl = '''const chartTradeStreams=new Map(),chartTradeHistory=new Map();

// MEMEFLOW_CARD_HISTORY_RESTORE_V21_1
// Stop -> Run clears RAM. The local chart archive contains accepted real
// Pump TradeEvents, so restore it on demand when a card has no hot rows.
const __mfCardHistoryRestoreAtV21_1=new Map();

function __mfCardMarketRowsV21_1(mint){
  const key=String(mint||'').trim();
  if(!key)return [];

  let rows=chartTradeHistory.get(key)||[];

  if(rows.length){
    return rows;
  }

  const now=Date.now();
  const previous=Number(
    __mfCardHistoryRestoreAtV21_1.get(key)||0
  );

  if(now-previous<30000){
    return rows;
  }

  __mfCardHistoryRestoreAtV21_1.set(key,now);

  try{
    const restored=__mfChartArchive.mergePointsSync(key,[])||[];

    if(restored.length){
      rows=restored.slice(-1200);
      chartTradeHistory.set(key,rows);
    }
  }catch{}

  return rows;
}'''

    app = replace_once(
        app,
        old_decl,
        new_decl,
        "chart trade cache declaration"
    )

    start = app.find("function __mfCandidateMarket5mV4(mint,t){")
    end = app.find("// MEMEFLOW_REALTIME_UI_FAIRNESS_V1", start)

    if start < 0 or end < 0:
        raise SystemExit(
            "ERROR: Candidate market function was not found."
        )

    block = app[start:end]

    old_rows = "  const rows=chartTradeHistory.get(mint)||[];"

    if old_rows not in block:
        raise SystemExit(
            "ERROR: Candidate market row source was not found."
        )

    block = block.replace(
        old_rows,
        "  const rows=__mfCardMarketRowsV21_1(mint);",
        1
    )

    app = app[:start] + block + app[end:]

# ---------------------------------------------------------------------------
# 3. Frontend accepts only trade-backed MC.
# ---------------------------------------------------------------------------
if "MEMEFLOW_UI_TRADE_ONLY_MC_V21_1" not in ui:
    old_trusted = '''  return (
    source.includes('trade') ||
    source==='pump-reference'
  );
'''

    already_trade_only = '''  return source.includes('trade');
'''

    new_trusted = '''  // MEMEFLOW_UI_TRADE_ONLY_MC_V21_1
  // Reference values are metadata, not current market cap.
  return source.includes('trade');
'''

    if old_trusted in ui:
        ui = ui.replace(old_trusted, new_trusted, 1)
    elif already_trade_only in ui:
        ui = ui.replace(already_trade_only, new_trusted, 1)
    else:
        raise SystemExit(
            "ERROR: trustedMarketCapSource return block was not found."
        )

# ---------------------------------------------------------------------------
# 4. Preserve marketCapSource during canonical row normalization.
# ---------------------------------------------------------------------------
if "MEMEFLOW_CANONICAL_MC_SOURCE_V21_1" not in ui:
    old = '''      marketCapUsd:
        row?.market?.marketCapUsd ??
        row?.marketCapUsd ??
        null,
      priceChange5mPct:
'''

    new = '''      marketCapUsd:
        row?.market?.marketCapUsd ??
        row?.marketCapUsd ??
        null,
      // MEMEFLOW_CANONICAL_MC_SOURCE_V21_1
      marketCapSource:
        row?.market?.marketCapSource ??
        row?.marketCapSource ??
        null,
      priceChange5mPct:
'''

    ui = replace_once(
        ui,
        old,
        new,
        "canonical market-cap source"
    )

# ---------------------------------------------------------------------------
# 5. OPEN POSITION must not inherit stale MC from its regular scanner row.
# ---------------------------------------------------------------------------
if "MEMEFLOW_OPEN_POSITION_MC_ISOLATION_V21_1" not in ui:
    start = ui.find("function mergedRows() {")
    end = ui.find("function isOpenPositionRow(row)", start)

    if start < 0 or end < 0:
        raise SystemExit(
            "ERROR: mergedRows function was not found."
        )

    block = ui[start:end]

    old_caps = '''          marketCapSol:
            position?.tokenMetrics?.marketCapSol ??
            existing?.marketCapSol ??
            existing?.marketCap ??
            null,
          marketCapUsd:
            position?.tokenMetrics?.marketCapUsd ??
            existing?.marketCapUsd ??
            null,
'''

    new_caps = '''          // MEMEFLOW_OPEN_POSITION_MC_ISOLATION_V21_1
          // OPEN POSITION market data comes only from the live position lane.
          marketCapSol:
            position?.tokenMetrics?.marketCapSol ??
            null,
          marketCapUsd:
            position?.tokenMetrics?.marketCapUsd ??
            null,
          marketCapSource:
            position?.tokenMetrics?.marketCapSource ??
            null,
'''

    if old_caps in block:
        block = block.replace(old_caps, new_caps, 1)
    elif "MEMEFLOW_OPEN_POSITION_MC_ISOLATION_V21_1" not in block:
        old_partial = '''          marketCapSol:
            position?.tokenMetrics?.marketCapSol ??
            null,
          marketCapUsd:
            position?.tokenMetrics?.marketCapUsd ??
            null,
          marketCapSource:
            position?.tokenMetrics?.marketCapSource ??
            null,
'''
        if old_partial in block:
            block = block.replace(old_partial, new_caps, 1)
        else:
            raise SystemExit(
                "ERROR: OPEN POSITION top-level MC merge was not found."
            )

    old_market = '''          market: {
            ...(existing?.market || {}),
            priceSol:
              position?.currentPriceSol ??
              existing?.market?.priceSol ??
              existing?.priceSol ??
              null
          },
'''

    new_market = '''          market: {
            ...(existing?.market || {}),
            priceSol:
              position?.currentPriceSol ??
              existing?.market?.priceSol ??
              existing?.priceSol ??
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
            volume5mSol:
              position?.tokenMetrics?.volume5mSol ??
              null,
            volume5mUsd:
              position?.tokenMetrics?.volume5mUsd ??
              null,
            transactions5m:
              position?.tokenMetrics?.transactions5m ??
              null,
            priceChange5mPct:
              position?.tokenMetrics?.priceChange5mPct ??
              null
          },
'''

    if old_market in block:
        block = block.replace(old_market, new_market, 1)
    elif "marketCapSource:\n              position?.tokenMetrics?.marketCapSource" not in block:
        raise SystemExit(
            "ERROR: OPEN POSITION nested market merge was not found."
        )

    ui = ui[:start] + block + ui[end:]

# Add source to standalone OPEN POSITION rows.
if "MEMEFLOW_POSITION_ROW_MC_SOURCE_V21_1" not in ui:
    start = ui.find("function positionAsDecisionRow(position) {")
    end = ui.find("function mergedRows()", start)

    if start < 0 or end < 0:
        raise SystemExit(
            "ERROR: positionAsDecisionRow function was not found."
        )

    block = ui[start:end]

    old = '''    marketCapUsd:
      metrics?.marketCapUsd ?? null,
    __openPosition: position
'''

    new = '''    marketCapUsd:
      metrics?.marketCapUsd ?? null,
    // MEMEFLOW_POSITION_ROW_MC_SOURCE_V21_1
    marketCapSource:
      metrics?.marketCapSource ?? null,
    __openPosition: position
'''

    block = replace_once(
        block,
        old,
        new,
        "standalone OPEN POSITION market-cap source"
    )

    ui = ui[:start] + block + ui[end:]

# ---------------------------------------------------------------------------
# 6. Regression test reproduces the repeated 33.5K conflict.
# ---------------------------------------------------------------------------
test_source = r'''import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  liveCardMarketSnapshot,
  openPositionLiveMarketCap
} from '../src/live-card-market.mjs';

const now=Date.now();

const staleToken={
  launchPlatform:'pump',
  totalSupply:1_000_000_000,
  pumpReportedMarketCapUsd:33_500,
  marketCapUsd:33_500,
  marketCapSol:33.5,
  priceSol:0.0000000335,
  lastPriceAt:now-3600000,
  marketSource:'pump-create-event-ws'
};

const noTrade=liveCardMarketSnapshot({
  token:staleToken,
  points:[],
  solUsd:1000,
  now
});

assert.equal(noTrade.currentPriceSol,null);
assert.equal(noTrade.marketCapSol,null);
assert.equal(noTrade.marketCapUsd,null);
assert.equal(noTrade.marketCapSource,null);

const tradeA=liveCardMarketSnapshot({
  token:staleToken,
  points:[{
    t:now-1000,
    priceSol:0.000000010,
    solAmount:1
  }],
  solUsd:1000,
  now
});

const tradeB=liveCardMarketSnapshot({
  token:staleToken,
  points:[{
    t:now-1000,
    priceSol:0.000000025,
    solAmount:2
  }],
  solUsd:1000,
  now
});

assert.equal(tradeA.marketCapUsd,10_000);
assert.equal(tradeB.marketCapUsd,25_000);
assert.equal(tradeA.marketCapSource,'chart-trade-event');
assert.equal(tradeB.marketCapSource,'chart-trade-event');
assert.notEqual(tradeA.marketCapUsd,33_500);
assert.notEqual(tradeB.marketCapUsd,33_500);
assert.notEqual(tradeA.marketCapUsd,tradeB.marketCapUsd);

const rejectedReference=openPositionLiveMarketCap({
  token:staleToken,
  markPriceSol:0.0000000335,
  markSource:'pump-reference',
  solUsd:1000
});

assert.equal(rejectedReference.marketCapUsd,null);
assert.equal(rejectedReference.marketCapSource,null);

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const ui=fs.readFileSync(
  new URL('../system-tokens.js',import.meta.url),
  'utf8'
);

const market=fs.readFileSync(
  new URL('../src/live-card-market.mjs',import.meta.url),
  'utf8'
);

assert.match(
  market,
  /MEMEFLOW_TRADE_EVENT_ONLY_LIVE_MC_V21_1/
);

assert.match(
  market,
  /MEMEFLOW_NO_REFERENCE_OR_STORED_MC_FALLBACK_V21_1/
);

const candidate=app.slice(
  app.indexOf('function __mfCandidateMarket5mV4'),
  app.indexOf('// MEMEFLOW_REALTIME_UI_FAIRNESS_V1')
);

assert.match(
  candidate,
  /__mfCardMarketRowsV21_1/
);

const trusted=ui.slice(
  ui.indexOf('function trustedMarketCapSource'),
  ui.indexOf('function openMarketCapLabel')
);

assert.match(
  trusted,
  /MEMEFLOW_UI_TRADE_ONLY_MC_V21_1/
);

assert.doesNotMatch(
  trusted,
  /pump-reference/
);

const merged=ui.slice(
  ui.indexOf('function mergedRows()'),
  ui.indexOf('function isOpenPositionRow')
);

assert.match(
  merged,
  /MEMEFLOW_OPEN_POSITION_MC_ISOLATION_V21_1/
);

assert.doesNotMatch(
  merged,
  /position\?\.tokenMetrics\?\.marketCapUsd\s*\?\?\s*existing/
);

console.log('mc conflict v21.1 ok');
'''

test_path.parent.mkdir(parents=True, exist_ok=True)
test_path.write_text(test_source, encoding="utf-8")

# Add the new test to npm test without removing previous tests.
package = json.loads(package_path.read_text(encoding="utf-8"))
scripts = package.setdefault("scripts", {})
test_cmd = str(scripts.get("test", "")).strip()
new_test = "node tests/mc-conflict-v21-1.mjs"

if new_test not in test_cmd:
    anchor = "node tests/open-position-live-mc-v20.mjs"

    if anchor in test_cmd:
        test_cmd = test_cmd.replace(
            anchor,
            anchor + " && " + new_test,
            1
        )
    elif test_cmd:
        test_cmd = new_test + " && " + test_cmd
    else:
        test_cmd = new_test

    scripts["test"] = test_cmd

package_path.write_text(
    json.dumps(package, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8"
)

app_path.write_text(app, encoding="utf-8")
ui_path.write_text(ui, encoding="utf-8")
market_path.write_text(market, encoding="utf-8")

print("V21.1 source changes applied.")
PY

echo "[4/9] Checking syntax."

node --check app-server.mjs
node --check system-tokens.js
node --check src/live-card-market.mjs
node --check tests/mc-conflict-v21-1.mjs

echo "[5/9] Running focused regression tests."

node tests/open-position-live-mc-v20.mjs
node tests/mc-conflict-v21-1.mjs
node tests/live-card-clock-v19.mjs
node tests/live-market-truth.mjs

echo "[6/9] Running full test suite."

npm test

echo "[7/9] Checking Git diff."

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git diff --check
fi

echo "[8/9] Creating Git commit."

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add \
    app-server.mjs \
    system-tokens.js \
    src/live-card-market.mjs \
    tests/mc-conflict-v21-1.mjs \
    package.json

  if git diff --cached --quiet; then
    echo "No new Git changes were required."
  else
    git commit -m "fix: isolate live market cap from stale references"
  fi

  echo "[9/9] Pushing Git changes."

  if git remote get-url origin >/dev/null 2>&1; then
    if git push; then
      echo "Git push completed."
    else
      echo "WARNING: Git push failed. The patch is installed and committed locally."
      echo "Run 'git push' later after Git authentication is available."
    fi
  else
    echo "WARNING: No Git origin remote is configured."
  fi
else
  echo "[9/9] Git repository not detected. Skipping commit and push."
fi

trap - ERR

echo
echo "============================================================"
echo " INSTALLATION COMPLETE"
echo "============================================================"
echo "Patch: $PATCH_NAME"
echo "Backup: $BACKUP_DIR"
echo
echo "Behavior after this patch:"
echo "- Existing uncommitted target-file changes are preserved."
echo "- Pump/reference MC cannot render as current live MC."
echo "- Stored marketCapUsd cannot render as current live MC."
echo "- Stored token price cannot generate current live MC."
echo "- Real persisted TradeEvents are restored after restart."
echo "- OPEN POSITION cannot inherit stale MC from a regular card."
echo "- A card without accepted TradeEvent evidence shows unavailable MC."
echo
echo "Next:"
echo "1. Stop the Replit app."
echo "2. Run the Replit app."
echo "3. Reload Live token states once."
