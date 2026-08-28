#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW fix: USER SETTINGS control scanner retention =="

# Run from repo root or memeflow-app
if [[ -d "memeflow-app" && -f "memeflow-app/app-server.mjs" ]]; then
  cd memeflow-app
elif [[ -f "app-server.mjs" && -d "src" && -d "tests" ]]; then
  :
else
  echo "ERROR: Run from ~/workspace or memeflow-app."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

app_path = Path("app-server.mjs")
app = app_path.read_text()
changed = 0

def replace_optional(old, new, label):
    global app, changed
    if old in app:
        app = app.replace(old, new, 1)
        changed += 1
        print("patched:", label)
    elif new in app:
        print("already patched:", label)
    else:
        raise SystemExit(f"PATCH FAILED [{label}]: expected source block not found")

# 1) DEAD is a decision/risk state, not a hidden scanner deletion rule.
replace_optional(
"""function __mfIsCurrentScannerToken(token,now=Date.now()){
  if(!token||token.wsFirst!==true)return false;
  const discovered=Number(token.discoveredAt||0);
  if(!(discovered>=__mfScannerRuntimeStartedAt))return false;
  return token.dead!==true && now-discovered<=__mfScannerTokenTtlMs;
}
""",
"""function __mfIsCurrentScannerToken(token,now=Date.now()){
  if(!token||token.wsFirst!==true)return false;
  const discovered=Number(token.discoveredAt||0);
  if(!(discovered>=__mfScannerRuntimeStartedAt))return false;

  // MEMEFLOW_SETTINGS_CONTROL_SCANNER_RETENTION_V1
  // Opportunity/dead state may BLOCK a trade, but it must not silently remove
  // a Pump token before the user's age/settings filters get a chance to run.
  return now-discovered<=__mfScannerTokenTtlMs;
}
""",
"dead state no longer hides raw scanner token"
)

# 2) Remove Opportunity Engine's 45s/60s/90s hidden pruning from scanner.
replace_optional(
"""    const lifecycleReason=
      token?.dead===true
        ? (token.deadReason||'DEAD')
        : opportunityEngine?.staleReason?.(token,now);

    if(lifecycleReason){
      __mfDropScannerToken(mint,lifecycleReason);
      continue;
    }

""",
"""    // MEMEFLOW_SETTINGS_CONTROL_SCANNER_RETENTION_V1
    // Do NOT prune by opportunityEngine.staleReason/dead here.
    // Previously tokens could be deleted for NO_TRADES_45S, LOW_ACTIVITY,
    // INACTIVE_90S, FAILED_MOMENTUM or DEAD long before a configured
    // minTokenAgeMinutes (for example 5 minutes) could ever be reached.
    // Opportunity/dead signals remain available to evaluate() and can still
    // produce WATCH/BLOCKED; they simply do not destroy scanner inventory.

""",
"remove hidden opportunity lifecycle prune"
)

# 3) Remove immediate delete callback from live TradeEvent feed.
# The feed may still detect dead tokens and evaluation may BLOCK them.
old = "onDead:(mint,reason)=>__mfDropScannerToken(mint,reason)"
new = "onDead:null // MEMEFLOW_SETTINGS_CONTROL_SCANNER_RETENTION_V1: decision-only, never scanner delete"
if old in app:
    app = app.replace(old, new, 1)
    changed += 1
    print("patched: disable immediate onDead scanner deletion")
elif new in app:
    print("already patched: disable immediate onDead scanner deletion")
else:
    # tolerate formatting where onDead has already been omitted entirely
    if "startPumpLiveTradeFeed({" in app and "onDead:" not in app:
        print("already safe: no onDead scanner callback is wired")
    else:
        raise SystemExit("PATCH FAILED [onDead]: expected live-feed wiring not found")

app_path.write_text(app)

# Add regression assertions to an npm-tested file.
test_path = Path("tests/fresh-session-scanner.mjs")
t = test_path.read_text()

marker = """assert.ok(createAt<tradeAt,'CREATE must establish mint before same-tx TradeEvent ingest');

"""
block = """assert.ok(createAt<tradeAt,'CREATE must establish mint before same-tx TradeEvent ingest');

// MEMEFLOW_SETTINGS_CONTROL_SCANNER_RETENTION_V1
// A token must be allowed to survive until the USER'S configured minimum age.
// Opportunity/dead signals can affect the decision, but cannot silently delete
// the raw Pump scanner row at 45/60/90 seconds.
const currentScannerFn=app.slice(
  app.indexOf('function __mfIsCurrentScannerToken('),
  app.indexOf('function __mfLiveScannerTokens(')
);
assert.doesNotMatch(currentScannerFn,/token\\.dead\\s*!==\\s*true/);

const pruneScannerFn=app.slice(
  app.indexOf('function __mfPruneScannerRuntimeState('),
  app.indexOf('const __mfScannerPruneTimer=')
);
assert.doesNotMatch(pruneScannerFn,/opportunityEngine\\?\\.staleReason/);
assert.doesNotMatch(pruneScannerFn,/const lifecycleReason=/);

assert.doesNotMatch(
  app,
  /onDead:\\s*\\(mint,reason\\)=>__mfDropScannerToken\\(mint,reason\\)/
);

"""
if block in t:
    print("already patched: scanner retention regression assertions")
elif marker in t:
    t = t.replace(marker, block, 1)
    test_path.write_text(t)
    changed += 1
    print("patched: scanner retention regression assertions")
else:
    raise SystemExit("PATCH FAILED [test]: insertion marker not found")

print(f"source edits complete; changed sections={changed}")
PY

echo
echo "== Focused scanner regression =="
node tests/fresh-session-scanner.mjs

echo
echo "== Verify Opportunity Engine still blocks unsafe/dead decisions =="
node tests/opportunity-engine.mjs

echo
echo "== Full project test suite =="
npm test

echo
echo "== Stage only this fix =="
git add app-server.mjs tests/fresh-session-scanner.mjs

echo
echo "== Diff summary =="
git diff --cached --stat
git diff --cached -- app-server.mjs tests/fresh-session-scanner.mjs

if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git commit -m "fix: let user settings control scanner token retention"
fi

echo
echo "== Push =="
git push origin HEAD

echo
echo "SUCCESS."
echo "After restart:"
echo "  - Pump CREATE tokens are retained through the scanner TTL."
echo "  - minTokenAgeMinutes can actually reach 5m, 10m, etc."
echo "  - NO_TRADES_45S / LOW_ACTIVITY / INACTIVE_90S no longer delete tokens."
echo "  - DEAD/opportunity signals still affect WATCH/BLOCKED/trading decisions."
echo "  - User Entry Filters still decide which retained tokens become visible."
echo "  - WS-only scanner architecture is preserved; no scanner HTTP RPC was added."
