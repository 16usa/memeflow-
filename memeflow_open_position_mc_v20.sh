#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW OPEN POSITION LIVE MC V20"
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
  found="$(find "$HOME" /workspace /home/runner/workspace -maxdepth 5 -type f -name app-server.mjs 2>/dev/null | head -n 1 || true)"

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
  echo "Upload this installer to the Replit workspace and run it from Shell."
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

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  DIRTY_TARGETS="$(git status --porcelain -- "${TARGETS[@]}" 2>/dev/null || true)"
  if [[ -n "$DIRTY_TARGETS" ]]; then
    echo "ERROR: Target files already have uncommitted changes."
    echo "Commit or stash them before installing this patch."
    echo "$DIRTY_TARGETS"
    exit 1
  fi
fi

BACKUP_DIR=".memeflow-open-position-mc-v20-backup-$STAMP"
mkdir -p "$BACKUP_DIR/src" "$BACKUP_DIR/tests"

cp app-server.mjs "$BACKUP_DIR/app-server.mjs"
cp system-tokens.js "$BACKUP_DIR/system-tokens.js"
cp src/live-card-market.mjs "$BACKUP_DIR/src/live-card-market.mjs"
cp package.json "$BACKUP_DIR/package.json"

if [[ -f tests/open-position-live-mc-v20.mjs ]]; then
  cp tests/open-position-live-mc-v20.mjs "$BACKUP_DIR/tests/open-position-live-mc-v20.mjs"
fi

echo "[2/9] Backup created: $BACKUP_DIR"

rollback() {
  local exit_code=$?
  if [[ $exit_code -eq 0 ]]; then
    return 0
  fi

  echo
  echo "ERROR: Installation failed. Restoring backup."

  cp "$BACKUP_DIR/app-server.mjs" app-server.mjs
  cp "$BACKUP_DIR/system-tokens.js" system-tokens.js
  cp "$BACKUP_DIR/src/live-card-market.mjs" src/live-card-market.mjs
  cp "$BACKUP_DIR/package.json" package.json

  if [[ -f "$BACKUP_DIR/tests/open-position-live-mc-v20.mjs" ]]; then
    cp "$BACKUP_DIR/tests/open-position-live-mc-v20.mjs" tests/open-position-live-mc-v20.mjs
  else
    rm -f tests/open-position-live-mc-v20.mjs
  fi

  echo "Backup restored."
  exit "$exit_code"
}

trap rollback ERR

echo "[3/9] Applying backend and UI changes."

python3 <<'PY'
from pathlib import Path
import json

app_path = Path("app-server.mjs")
ui_path = Path("system-tokens.js")
market_path = Path("src/live-card-market.mjs")
package_path = Path("package.json")
test_path = Path("tests/open-position-live-mc-v20.mjs")

app = app_path.read_text(encoding="utf-8")
ui = ui_path.read_text(encoding="utf-8")
market = market_path.read_text(encoding="utf-8")

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"ERROR: Expected exactly one {label} block, found {count}. No partial patch will be kept."
        )
    return text.replace(old, new, 1)

if "MEMEFLOW_OPEN_POSITION_LIVE_MC_V20" not in market:
    market += r'''

// MEMEFLOW_OPEN_POSITION_LIVE_MC_V20
// OPEN POSITION market cap must come from the same confirmed live trade mark
// used to value the position. Stored or Pump-reference MC is never accepted.
export function openPositionLiveMarketCap({
  token={},
  markPriceSol=null,
  markSource=null,
  solUsd=null
}={}){
  const price=finite(markPriceSol);
  const usd=finite(solUsd);
  const source=lower(markSource);

  const trustedTradeSource=Boolean(
    source.includes('trade')
  );

  const supply=normalizePumpSupplyForCard(token);

  const marketCapSol=
    trustedTradeSource&&
    price!==null&&
    price>0&&
    supply!==null&&
    supply>0
      ? price*supply
      : null;

  const marketCapUsd=
    marketCapSol!==null&&
    marketCapSol>0&&
    usd!==null&&
    usd>0
      ? marketCapSol*usd
      : null;

  return {
    marketCapSol,
    marketCapUsd,
    marketCapSource:
      marketCapUsd!==null
        ? (
            source.includes('chart')
              ? 'chart-trade-event-price-x-supply'
              : 'token-live-trade-price-x-supply'
          )
        : null,
    trustedTradeSource
  };
}
'''

old_import = "import {liveCardMarketSnapshot} from './src/live-card-market.mjs'; // MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V18"
new_import = "import {liveCardMarketSnapshot,openPositionLiveMarketCap} from './src/live-card-market.mjs'; // MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V18 / MEMEFLOW_OPEN_POSITION_LIVE_MC_V20"

if "openPositionLiveMarketCap} from './src/live-card-market.mjs'" not in app:
    if old_import not in app:
        raise SystemExit("ERROR: live-card-market import was not found.")
    app = app.replace(old_import, new_import, 1)

candidate_start = app.find("function __mfCandidateMarket5mV4(")
candidate_end = app.find("// MEMEFLOW_REALTIME_UI_FAIRNESS_V1", candidate_start)
if candidate_start < 0 or candidate_end < 0:
    raise SystemExit("ERROR: Candidate market function was not found.")

candidate_block = app[candidate_start:candidate_end]
if "currentPriceSol:snapshot.currentPriceSol" not in candidate_block:
    old = """    latestTradePriceSol:snapshot.latestTradePriceSol,\n    latestTradeAt:snapshot.latestTradeAt,\n    tradeEvidence:snapshot.tradeEvidence\n  };\n}"""
    new = """    latestTradePriceSol:snapshot.latestTradePriceSol,\n    latestTradeAt:snapshot.latestTradeAt,\n    currentPriceSol:snapshot.currentPriceSol,\n    tradeEvidence:snapshot.tradeEvidence\n  };\n}"""
    if old not in candidate_block:
        raise SystemExit("ERROR: Candidate market return block was not found.")
    candidate_block = candidate_block.replace(old, new, 1)
    app = app[:candidate_start] + candidate_block + app[candidate_end:]

route_start = app.find("// MEMEFLOW_OPEN_POSITION_LIVE_BATCH_V18")
route_end = app.find("// MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3", route_start)
if route_start < 0 or route_end < 0 or route_end <= route_start:
    raise SystemExit("ERROR: OPEN POSITION live route was not found.")

route = app[route_start:route_end]
if "MEMEFLOW_OPEN_POSITION_LIVE_MC_V20" not in route:
    old_mark = """        const entryPrice=finite(position.entryPriceSol);\n        const tokenPrice=finite(token.priceSol);\n        const tokenMarkAt=finite(\n          token.lastPriceAt ??\n          token.lastMarketActivityAt\n        );\n        const enginePrice=finite(position.currentPriceSol);\n\n        let markPrice=null;\n        let markAt=null;\n        let markSource=null;\n\n        if(\n          tokenPrice!==null&&\n          tokenPrice>0&&\n          tokenMarkAt!==null&&\n          tokenMarkAt>0\n        ){\n          markPrice=tokenPrice;\n          markAt=tokenMarkAt;\n          markSource='token-live-trade';\n        }else if(\n"""

    new_mark = """        const entryPrice=finite(position.entryPriceSol);\n\n        // MEMEFLOW_OPEN_POSITION_LIVE_MC_V20\n        // Use only the canonical trade-backed market mark for live position\n        // valuation. Pump-reference MC never becomes an OPEN POSITION live MC.\n        const marketPrice=finite(market?.currentPriceSol);\n        const marketMarkAt=finite(market?.marketUpdatedAt);\n        const marketMarkSource=String(\n          market?.marketCapSource||''\n        ).trim();\n\n        const enginePrice=finite(position.currentPriceSol);\n\n        let markPrice=null;\n        let markAt=null;\n        let markSource=null;\n\n        if(\n          marketPrice!==null&&\n          marketPrice>0&&\n          marketMarkSource.toLowerCase().includes('trade')\n        ){\n          markPrice=marketPrice;\n          markAt=marketMarkAt;\n          markSource=marketMarkSource;\n        }else if(\n"""

    route = replace_once(route, old_mark, new_mark, "OPEN POSITION mark selection")

    old_pnl = """        const pnlPct=\n          pnlReady\n            ? ((realized+unrealized)/initialSize)*100\n            : null;\n\n        let ageMinutes=null;\n"""

    new_pnl = """        const pnlPct=\n          pnlReady\n            ? ((realized+unrealized)/initialSize)*100\n            : null;\n\n        const liveMc=openPositionLiveMarketCap({\n          token,\n          markPriceSol:markPrice,\n          markSource,\n          solUsd:solUsdOracle.get()\n        });\n\n        let ageMinutes=null;\n"""

    route = replace_once(route, old_pnl, new_pnl, "OPEN POSITION live market-cap calculation")

    old_metrics = """            marketCapSol:finite(market?.marketCapSol),\n            marketCapUsd:finite(market?.marketCapUsd),\n            marketCapSource:market?.marketCapSource||null,\n"""
    new_metrics = """            marketCapSol:liveMc.marketCapSol,\n            marketCapUsd:liveMc.marketCapUsd,\n            marketCapSource:liveMc.marketCapSource,\n"""

    route = replace_once(route, old_metrics, new_metrics, "OPEN POSITION tokenMetrics market-cap fields")
    app = app[:route_start] + route + app[route_end:]

ui_start = ui.find("// MEMEFLOW_OPEN_POSITION_EVENT_FACT_V16")
ui_end = ui.find("// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18", ui_start)
if ui_start < 0 or ui_end < 0:
    raise SystemExit("ERROR: OPEN POSITION UI refresh block was not found.")

ui_block = ui[ui_start:ui_end]
if "MEMEFLOW_OPEN_POSITION_REFRESH_TIMEOUT_V20" not in ui_block:
    old_timeout = """        {\n          timeoutMs:900\n        }\n"""
    new_timeout = """        {\n          // MEMEFLOW_OPEN_POSITION_REFRESH_TIMEOUT_V20\n          // Replit deployment latency can exceed 900 ms. A short transient\n          // delay must not freeze all OPEN POSITION cards.\n          timeoutMs:1800\n        }\n"""
    ui_block = replace_once(ui_block, old_timeout, new_timeout, "OPEN POSITION request timeout")
    ui = ui[:ui_start] + ui_block + ui[ui_end:]

test_source = r'''import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openPositionLiveMarketCap} from '../src/live-card-market.mjs';

const token={
  launchPlatform:'pump',
  totalSupply:1_000_000_000,
  pumpReportedMarketCapUsd:33_500,
  marketCapUsd:33_500
};

const stale=openPositionLiveMarketCap({
  token,
  markPriceSol:0.000000335,
  markSource:'pump-reference',
  solUsd:100
});

assert.equal(stale.marketCapSol,null);
assert.equal(stale.marketCapUsd,null);
assert.equal(stale.marketCapSource,null);

const first=openPositionLiveMarketCap({
  token,
  markPriceSol:0.0000001,
  markSource:'token-live-trade',
  solUsd:100
});

const second=openPositionLiveMarketCap({
  token,
  markPriceSol:0.0000002,
  markSource:'chart-trade-event',
  solUsd:100
});

assert.equal(first.marketCapSol,100);
assert.equal(first.marketCapUsd,10_000);
assert.equal(first.marketCapSource,'token-live-trade-price-x-supply');

assert.equal(second.marketCapSol,200);
assert.equal(second.marketCapUsd,20_000);
assert.equal(second.marketCapSource,'chart-trade-event-price-x-supply');

assert.notEqual(first.marketCapUsd,second.marketCapUsd);
assert.notEqual(first.marketCapUsd,33_500);
assert.notEqual(second.marketCapUsd,33_500);

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const start=app.indexOf('// MEMEFLOW_OPEN_POSITION_LIVE_BATCH_V18');
const end=app.indexOf('// MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3',start);
assert.ok(start>=0&&end>start);

const route=app.slice(start,end);
assert.match(route,/MEMEFLOW_OPEN_POSITION_LIVE_MC_V20/);
assert.match(route,/openPositionLiveMarketCap\(\{/);
assert.match(route,/marketCapSol:liveMc\.marketCapSol/);
assert.match(route,/marketCapUsd:liveMc\.marketCapUsd/);
assert.match(route,/marketCapSource:liveMc\.marketCapSource/);
assert.doesNotMatch(route,/marketCapUsd:finite\(market\?\.marketCapUsd\)/);

console.log('open position live MC v20 ok');
'''

test_path.parent.mkdir(parents=True, exist_ok=True)
test_path.write_text(test_source, encoding="utf-8")

package = json.loads(package_path.read_text(encoding="utf-8"))
scripts = package.setdefault("scripts", {})
test_cmd = str(scripts.get("test", "")).strip()
new_test = "node tests/open-position-live-mc-v20.mjs"

if new_test not in test_cmd:
    if test_cmd:
        anchor = "node tests/live-market-truth.mjs"
        if anchor in test_cmd:
            test_cmd = test_cmd.replace(anchor, anchor + " && " + new_test, 1)
        else:
            test_cmd = new_test + " && " + test_cmd
    else:
        test_cmd = new_test
    scripts["test"] = test_cmd

package_path.write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
app_path.write_text(app, encoding="utf-8")
ui_path.write_text(ui, encoding="utf-8")
market_path.write_text(market, encoding="utf-8")

print("Patch source changes applied.")
PY

echo "[4/9] Checking JavaScript syntax."
node --check app-server.mjs
node --check system-tokens.js
node --check src/live-card-market.mjs

echo "[5/9] Running V20 regression test."
node tests/open-position-live-mc-v20.mjs

echo "[6/9] Running related regression tests."
node tests/live-card-clock-v19.mjs
node tests/live-market-truth.mjs

echo "[7/9] Checking patch diff."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git diff --check
fi

echo "[8/9] Creating Git commit."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add app-server.mjs system-tokens.js src/live-card-market.mjs tests/open-position-live-mc-v20.mjs package.json

  if git diff --cached --quiet; then
    echo "No new Git changes were required."
  else
    git commit -m "fix: keep open position market cap live"
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
    echo "WARNING: No Git origin remote is configured. The patch is installed locally."
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
echo "Next:"
echo "1. Stop the Replit app."
echo "2. Run the Replit app."
echo "3. Reload Live token states once."
echo
echo "Expected behavior:"
echo "- OPEN POSITION MC no longer accepts stale Pump-reference values."
echo "- P&L and MC share the same confirmed trade-backed market mark."
echo "- If no trusted live trade mark exists, MC displays as unavailable."
echo "- A new trade mark produces a new MC instead of a frozen repeated value."
