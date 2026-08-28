#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW MC CONFLICT FIX V21"
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

echo "[1/10] Project directory: $APP_DIR"

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

BACKUP_DIR=".memeflow-mc-v21-backup-$STAMP"
mkdir -p "$BACKUP_DIR/src" "$BACKUP_DIR/tests"

cp app-server.mjs "$BACKUP_DIR/app-server.mjs"
cp system-tokens.js "$BACKUP_DIR/system-tokens.js"
cp src/live-card-market.mjs "$BACKUP_DIR/src/live-card-market.mjs"
cp package.json "$BACKUP_DIR/package.json"

if [[ -f tests/mc-conflict-v21.mjs ]]; then
  cp tests/mc-conflict-v21.mjs "$BACKUP_DIR/tests/mc-conflict-v21.mjs"
fi

echo "[2/10] Backup created: $BACKUP_DIR"

rollback() {
  local code=$?

  if [[ $code -eq 0 ]]; then
    return 0
  fi

  echo
  echo "ERROR: Patch failed. Restoring backup."

  cp "$BACKUP_DIR/app-server.mjs" app-server.mjs
  cp "$BACKUP_DIR/system-tokens.js" system-tokens.js
  cp "$BACKUP_DIR/src/live-card-market.mjs" src/live-card-market.mjs
  cp "$BACKUP_DIR/package.json" package.json

  if [[ -f "$BACKUP_DIR/tests/mc-conflict-v21.mjs" ]]; then
    cp "$BACKUP_DIR/tests/mc-conflict-v21.mjs" tests/mc-conflict-v21.mjs
  else
    rm -f tests/mc-conflict-v21.mjs
  fi

  echo "Backup restored."
  exit "$code"
}

trap rollback ERR

echo "[3/10] Applying source changes."

python3 <<'PY'
from pathlib import Path
import json

app_path = Path("app-server.mjs")
ui_path = Path("system-tokens.js")
market_path = Path("src/live-card-market.mjs")
package_path = Path("package.json")
test_path = Path("tests/mc-conflict-v21.mjs")

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

if "MEMEFLOW_NO_PUMP_REFERENCE_AS_LIVE_MC_V21" not in market:
    old = '''  const pumpReferenceUsd=finite(
    token?.pumpReportedMarketCapUsd
  );

  const storedTradeUsd=
    tokenHasTradeEvidence
      ? finite(token?.marketCapUsd)
      : null;

  const marketCapUsd=
    marketCapSol!==null&&
    marketCapSol>0&&
    usd!==null&&
    usd>0
      ? marketCapSol*usd
      : (
          pumpReferenceUsd ??
          storedTradeUsd
        );
'''

    new = '''  // MEMEFLOW_NO_PUMP_REFERENCE_AS_LIVE_MC_V21
  // Pump reference MC is discovery/reference metadata only.
  // It must never be rendered as current live market cap.
  const storedTradeUsd=
    tokenHasTradeEvidence
      ? finite(token?.marketCapUsd)
      : null;

  const marketCapUsd=
    marketCapSol!==null&&
    marketCapSol>0&&
    usd!==null&&
    usd>0
      ? marketCapSol*usd
      : storedTradeUsd;
'''

    market = replace_once(
        market,
        old,
        new,
        "live-card market-cap fallback"
    )

    old_source = '''  if(latestTradePrice!==null){
    marketCapSource='chart-trade-event';
  }else if(tokenHasTradeEvidence){
    marketCapSource='token-live-trade';
  }else if(pumpReferenceUsd!==null){
    marketCapSource='pump-reference';
  }
'''

    new_source = '''  if(latestTradePrice!==null){
    marketCapSource='chart-trade-event';
  }else if(tokenHasTradeEvidence){
    marketCapSource='token-live-trade';
  }
'''

    market = replace_once(
        market,
        old_source,
        new_source,
        "live-card market-cap source"
    )

if "MEMEFLOW_OPEN_POSITION_HISTORY_RESTORE_V21" not in app:
    old_decl = "const chartTradeStreams=new Map(),chartTradeHistory=new Map();"
    new_decl = '''const chartTradeStreams=new Map(),chartTradeHistory=new Map();

// MEMEFLOW_OPEN_POSITION_HISTORY_RESTORE_V21
// A process restart clears the RAM trade cache. Restore persisted real
// TradeEvents once per OPEN POSITION mint so live MC does not fall back to
// creation/reference metadata after Stop -> Run.
const __mfOpenHistoryRestoreAttemptedV21=new Set();'''

    app = replace_once(
        app,
        old_decl,
        new_decl,
        "chart trade cache declaration"
    )

    start = app.find("function __mfCandidateMarket5mV4(mint,t){")
    end = app.find("// MEMEFLOW_REALTIME_UI_FAIRNESS_V1", start)

    if start < 0 or end < 0:
        raise SystemExit("ERROR: Candidate market function was not found.")

    block = app[start:end]

    old_rows = "  const rows=chartTradeHistory.get(mint)||[];"
    new_rows = '''  let rows=chartTradeHistory.get(mint)||[];

  if(
    !rows.length&&
    __mfOpenPositionMints().has(String(mint||''))&&
    !__mfOpenHistoryRestoreAttemptedV21.has(String(mint||''))
  ){
    const key=String(mint||'');
    __mfOpenHistoryRestoreAttemptedV21.add(key);

    try{
      const restored=__mfChartArchive.mergePointsSync(key,[])||[];

      if(restored.length){
        rows=restored.slice(-1200);
        chartTradeHistory.set(key,rows);
      }
    }catch{}
  }'''

    if block.count(old_rows) != 1:
        raise SystemExit(
            "ERROR: Candidate market hot-history source was not found exactly once."
        )

    block = block.replace(old_rows, new_rows, 1)
    app = app[:start] + block + app[end:]

if "MEMEFLOW_UI_TRADE_ONLY_MC_V21" not in ui:
    old = '''  return (
    source.includes('trade') ||
    source==='pump-reference'
  );
'''

    new = '''  // MEMEFLOW_UI_TRADE_ONLY_MC_V21
  // Only a trade-backed source is allowed to render as current MC.
  return source.includes('trade');
'''

    ui = replace_once(
        ui,
        old,
        new,
        "trusted market-cap source"
    )

if "MEMEFLOW_OPEN_POSITION_MC_NO_REINJECTION_V21" not in ui:
    start = ui.find("function mergedRows() {")
    end = ui.find("function isOpenPositionRow(row)", start)

    if start < 0 or end < 0:
        raise SystemExit("ERROR: mergedRows function was not found.")

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

    new_caps = '''          // MEMEFLOW_OPEN_POSITION_MC_NO_REINJECTION_V21
          // OPEN POSITION MC comes only from the live position payload.
          // A regular-card reference MC must never be injected back here.
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

    if block.count(old_caps) != 1:
        raise SystemExit(
            "ERROR: OPEN POSITION top-level MC merge block was not found."
        )

    block = block.replace(old_caps, new_caps, 1)

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

    if block.count(old_market) != 1:
        raise SystemExit(
            "ERROR: OPEN POSITION nested market merge block was not found."
        )

    block = block.replace(old_market, new_market, 1)
    ui = ui[:start] + block + ui[end:]

if "MEMEFLOW_CANONICAL_MC_SOURCE_V21" not in ui:
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
      // MEMEFLOW_CANONICAL_MC_SOURCE_V21
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

test_source = r'''import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  liveCardMarketSnapshot,
  openPositionLiveMarketCap
} from '../src/live-card-market.mjs';

const referenceOnly={
  launchPlatform:'pump',
  totalSupply:1_000_000_000,
  pumpReportedMarketCapUsd:33_500,
  pumpReferenceAt:Date.now(),
  marketSource:'pump-create-event-ws'
};

const referenceSnapshot=liveCardMarketSnapshot({
  token:referenceOnly,
  points:[],
  solUsd:100,
  now:Date.now()
});

assert.equal(referenceSnapshot.marketCapUsd,null);
assert.equal(referenceSnapshot.marketCapSol,null);
assert.equal(referenceSnapshot.marketCapSource,null);
assert.equal(referenceSnapshot.tradeEvidence,false);

const now=Date.now();

const first=liveCardMarketSnapshot({
  token:{
    launchPlatform:'pump',
    totalSupply:1_000_000_000
  },
  points:[{
    t:now-1000,
    priceSol:0.0000001,
    solAmount:1
  }],
  solUsd:100,
  now
});

const second=liveCardMarketSnapshot({
  token:{
    launchPlatform:'pump',
    totalSupply:1_000_000_000
  },
  points:[{
    t:now-1000,
    priceSol:0.0000002,
    solAmount:2
  }],
  solUsd:100,
  now
});

assert.equal(first.marketCapUsd,10_000);
assert.equal(first.marketCapSource,'chart-trade-event');
assert.equal(first.transactions5m,1);
assert.equal(first.volume5mSol,1);

assert.equal(second.marketCapUsd,20_000);
assert.equal(second.marketCapSource,'chart-trade-event');
assert.equal(second.transactions5m,1);
assert.equal(second.volume5mSol,2);

assert.notEqual(first.marketCapUsd,second.marketCapUsd);
assert.notEqual(first.marketCapUsd,33_500);
assert.notEqual(second.marketCapUsd,33_500);

const blockedOpen=openPositionLiveMarketCap({
  token:referenceOnly,
  markPriceSol:0.000000335,
  markSource:'pump-reference',
  solUsd:100
});

assert.equal(blockedOpen.marketCapUsd,null);
assert.equal(blockedOpen.marketCapSource,null);

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
  /MEMEFLOW_NO_PUMP_REFERENCE_AS_LIVE_MC_V21/
);

const sourceFn=ui.slice(
  ui.indexOf('function trustedMarketCapSource'),
  ui.indexOf('function openMarketCapLabel')
);

assert.match(
  sourceFn,
  /MEMEFLOW_UI_TRADE_ONLY_MC_V21/
);

assert.doesNotMatch(
  sourceFn,
  /pump-reference/
);

const merged=ui.slice(
  ui.indexOf('function mergedRows()'),
  ui.indexOf('function isOpenPositionRow')
);

assert.match(
  merged,
  /MEMEFLOW_OPEN_POSITION_MC_NO_REINJECTION_V21/
);

assert.doesNotMatch(
  merged,
  /position\?\.tokenMetrics\?\.marketCapUsd\s*\?\?\s*existing\?\.marketCapUsd/
);

const candidate=app.slice(
  app.indexOf('function __mfCandidateMarket5mV4'),
  app.indexOf('// MEMEFLOW_REALTIME_UI_FAIRNESS_V1')
);

assert.match(
  candidate,
  /__mfOpenHistoryRestoreAttemptedV21/
);

assert.match(
  candidate,
  /__mfChartArchive\.mergePointsSync/
);

console.log('mc conflict v21 ok');
'''

test_path.parent.mkdir(parents=True, exist_ok=True)
test_path.write_text(test_source, encoding="utf-8")

package = json.loads(package_path.read_text(encoding="utf-8"))
scripts = package.setdefault("scripts", {})
test_cmd = str(scripts.get("test", "")).strip()
new_test = "node tests/mc-conflict-v21.mjs"

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

print("V21 source changes applied.")
PY

echo "[4/10] Checking syntax."

node --check app-server.mjs
node --check system-tokens.js
node --check src/live-card-market.mjs
node --check tests/mc-conflict-v21.mjs

echo "[5/10] Running focused MC regression tests."

node tests/open-position-live-mc-v20.mjs
node tests/mc-conflict-v21.mjs
node tests/live-card-clock-v19.mjs
node tests/live-market-truth.mjs

echo "[6/10] Running full npm test suite."

npm test

echo "[7/10] Checking Git diff."

git diff --check 2>/dev/null || true

echo "[8/10] Running benchmark."

if npm run benchmark; then
  echo "Benchmark passed."
else
  echo "WARNING: Benchmark failed. Source tests passed; review benchmark output."
fi

echo "[9/10] Creating Git commit."

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add \
    app-server.mjs \
    system-tokens.js \
    src/live-card-market.mjs \
    tests/mc-conflict-v21.mjs \
    package.json

  if git diff --cached --quiet; then
    echo "No new Git changes were required."
  else
    git commit -m "fix: remove stale market cap conflicts"
  fi

  echo "[10/10] Pushing Git changes."

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
  echo "[10/10] Git repository not detected. Skipping push."
fi

trap - ERR

echo
echo "============================================================"
echo " INSTALLATION COMPLETE"
echo "============================================================"
echo "Patch: $PATCH_NAME"
echo "Backup: $BACKUP_DIR"
echo
echo "Fixed conflicts:"
echo "- Pump reference MC is no longer treated as live MC."
echo "- OPEN POSITION cards restore persisted real TradeEvents after restart."
echo "- OPEN POSITION merge cannot re-inject regular-card reference MC."
echo "- Frontend renders MC only from a trade-backed source."
echo "- Live MC changes with the latest accepted TradeEvent price."
echo
echo "Next:"
echo "1. Stop the Replit app."
echo "2. Run the Replit app."
echo "3. Reload Live token states once."
