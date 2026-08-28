#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW repair v2: migrate remaining age fixtures + full test + push =="

if [[ -d "memeflow-app" && -f "memeflow-app/app-server.mjs" ]]; then
  cd memeflow-app
elif [[ -f "app-server.mjs" && -d "src" && -d "tests" ]]; then
  :
else
  echo "ERROR: Run from ~/workspace or the memeflow-app directory."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

def replace_once(path, old, new, label):
    p=Path(path)
    s=p.read_text()
    if old in s:
        p.write_text(s.replace(old,new,1))
        print(f"patched: {path} :: {label}")
        return True
    if new in s:
        print(f"already patched: {path} :: {label}")
        return False
    raise SystemExit(f"PATCH FAILED [{label}]: expected block not found in {path}")

# -----------------------------------------------------------------------
# opportunity-engine.mjs
# The test expects Entry Settings PASS, so it needs authoritative create age.
# -----------------------------------------------------------------------
replace_once(
    "tests/opportunity-engine.mjs",
    """  creator,discoveredAt:Date.now()-20_000,
""",
    """  creator,
  pumpCreatedAt:Date.now()-20_000,
  discoveredAt:Date.now()-1_000,
""",
    "opportunity fixture uses real Pump age"
)

# -----------------------------------------------------------------------
# ws-first-preopen-rpc.mjs
# defaultSettings has maxTokenAgeMinutes enabled; BUY READY fixture therefore
# needs real create time instead of relying on discoveredAt.
# -----------------------------------------------------------------------
replace_once(
    "tests/ws-first-preopen-rpc.mjs",
    """  launchPlatform:'pump',
  discoveredAt:Date.now(),

  priceSol:0.000001,
""",
    """  launchPlatform:'pump',
  pumpCreatedAt:Date.now(),
  discoveredAt:Date.now(),

  priceSol:0.000001,
""",
    "ws-first BUY READY fixture uses real Pump age"
)

# -----------------------------------------------------------------------
# live-policy-performance.mjs
# Keep performance fixture semantically valid under default age settings too.
# -----------------------------------------------------------------------
replace_once(
    "tests/live-policy-performance.mjs",
    """    creator:'Creator',discoveredAt:now-10_000,
""",
    """    creator:'Creator',
    pumpCreatedAt:now-10_000,
    discoveredAt:now-1_000,
""",
    "500-user performance fixture uses real Pump age"
)

print("Remaining known npm-test age fixtures migrated.")
PY

echo
echo "== Run the test that just failed =="
node tests/opportunity-engine.mjs

echo
echo "== Run downstream age-sensitive tests before full suite =="
node tests/live-policy-performance.mjs
node tests/ws-first-preopen-rpc.mjs
node tests/settings-gate.mjs
node tests/strict-entry-admission.mjs
node tests/fresh-session-scanner.mjs

echo
echo "== Full npm test =="
npm test

echo
echo "== Stage the complete scanner/settings fix =="
git add \
  app-server.mjs \
  src/settings-gate.mjs \
  src/discqueue.mjs \
  tests/settings-gate.mjs \
  tests/fresh-session-scanner.mjs \
  tests/strict-entry-admission.mjs \
  tests/opportunity-engine.mjs \
  tests/ws-first-preopen-rpc.mjs \
  tests/live-policy-performance.mjs

echo
echo "== Staged diff summary =="
git diff --cached --stat

if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git commit -m "fix: use authoritative Pump creation time for token age"
fi

echo
echo "== Push current branch =="
git push origin HEAD

echo
echo "SUCCESS: all npm tests passed and the complete fix was pushed."
