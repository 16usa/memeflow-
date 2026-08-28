#!/usr/bin/env bash
set -euo pipefail

cd "${HOME}/workspace"

echo "== MEMEFLOW: fix Replit LIVE launcher =="

test -f memeflow-app/live-bootstrap.mjs || {
  echo "ERROR: memeflow-app/live-bootstrap.mjs not found. The LIVE patch is not installed." >&2
  exit 1
}

STAMP="$(date +%Y%m%d-%H%M%S)"
cp -p .replit ".replit.backup-live-$STAMP"
cp -p run-project.sh "run-project.sh.backup-live-$STAMP"

python3 - <<'PY'
from pathlib import Path

rp = Path(".replit")
s = rp.read_text()

s = s.replace(
    'run = "cd memeflow-app && exec node app-server.mjs"',
    'run = "cd memeflow-app && exec node live-bootstrap.mjs"'
)
s = s.replace(
    'run = ["node", "memeflow-app/app-server.mjs"]',
    'run = ["node", "memeflow-app/live-bootstrap.mjs"]'
)
s = s.replace(
    'args = "cd memeflow-app && node app-server.mjs"',
    'args = "cd memeflow-app && node live-bootstrap.mjs"'
)
rp.write_text(s)

run = Path("run-project.sh")
r = run.read_text()
r = r.replace("exec node app-server.mjs", "exec node live-bootstrap.mjs")
run.write_text(r)
PY

chmod +x run-project.sh

echo
echo "Updated launchers:"
grep -nE 'live-bootstrap|app-server' .replit || true
grep -nE 'live-bootstrap|app-server' run-project.sh || true

echo
echo "Checking Secrets are visible to a fresh shell:"
if [[ "${LIVE_TRADING_ENABLED:-}" == "true" ]]; then
  echo "LIVE_TRADING_ENABLED=true  [OK]"
else
  echo "LIVE_TRADING_ENABLED is not true  [CHECK SECRET]"
fi

if [[ -n "${LIVE_SOLANA_RPC_URL:-}" ]]; then
  echo "LIVE_SOLANA_RPC_URL is present  [OK]"
else
  echo "LIVE_SOLANA_RPC_URL is missing  [CHECK SECRET]"
fi

echo
echo "DONE."
echo "Now STOP the running Replit app completely and press RUN again."
echo "After restart open:"
echo "  /api/live/status"
echo "Expected: enabled=true, featureFlag=true, rpcConfigured=true"
