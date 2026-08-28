#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW repair: update strict age regression + test + push =="

if [[ -d "memeflow-app" && -f "memeflow-app/app-server.mjs" ]]; then
  cd memeflow-app
elif [[ -f "app-server.mjs" && -d "src" && -d "tests" ]]; then
  :
else
  echo "ERROR: Run this from ~/workspace or the memeflow-app directory."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

p = Path("tests/strict-entry-admission.mjs")
s = p.read_text()

changes = 0

old = """const tooEarly={
  mint:'Early',
  launchPlatform:'pump',
  discoveredAt:now-90_000,
"""
new = """const tooEarly={
  mint:'Early',
  launchPlatform:'pump',
  // MEMEFLOW_SETTINGS_ONLY_DISCOVERY_V1:
  // real token age comes from Pump/create time, not scanner discovery time.
  pumpCreatedAt:now-90_000,
  discoveredAt:now-1_000,
"""
if old in s:
    s = s.replace(old, new, 1)
    changes += 1

old = """const admitted={
  ...tooEarly,
  mint:'Admitted',
  discoveredAt:now-(21*60_000),
"""
new = """const admitted={
  ...tooEarly,
  mint:'Admitted',
  pumpCreatedAt:now-(21*60_000),
  discoveredAt:now-1_000,
"""
if old in s:
    s = s.replace(old, new, 1)
    changes += 1

old = """  {
    mint:'Missing',
    launchPlatform:'pump',
    discoveredAt:now-(21*60_000)
  },
"""
new = """  {
    mint:'Missing',
    launchPlatform:'pump',
    pumpCreatedAt:now-(21*60_000),
    discoveredAt:now-1_000
  },
"""
if old in s:
    s = s.replace(old, new, 1)
    changes += 1

if changes == 0:
    # Idempotent success if the repair is already present.
    if "pumpCreatedAt:now-90_000" in s and "pumpCreatedAt:now-(21*60_000)" in s:
        print("strict-entry-admission age fixtures already repaired")
    else:
        raise SystemExit(
            "PATCH FAILED: expected strict-entry-admission fixtures were not found. "
            "The file differs from the inspected project version."
        )
else:
    p.write_text(s)
    print(f"patched tests/strict-entry-admission.mjs ({changes} fixture updates)")
PY

echo
echo "== Verify the previously failing test =="
node tests/strict-entry-admission.mjs

echo
echo "== Verify age/settings regressions =="
node tests/settings-gate.mjs
node tests/fresh-session-scanner.mjs

echo
echo "== Full project test suite =="
npm test

echo
echo "== Stage complete scanner/settings fix =="
git add \
  app-server.mjs \
  src/settings-gate.mjs \
  src/discqueue.mjs \
  tests/settings-gate.mjs \
  tests/fresh-session-scanner.mjs \
  tests/strict-entry-admission.mjs

echo
echo "== Diff summary =="
git diff --cached --stat

if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git commit -m "fix: use real Pump creation age for scanner admission"
fi

echo
echo "== Push =="
git push origin HEAD

echo
echo "SUCCESS: full npm test passed and changes were pushed."
