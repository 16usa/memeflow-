#!/usr/bin/env bash
set -euo pipefail

cd "${REPL_HOME:-$PWD}"
if [ ! -f memeflow-app/system-tokens.html ]; then
  echo "ERROR: run from MEMEFLOW repo root"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/token-scan-cache-bust-$STAMP"
mkdir -p "$BACKUP"
cp memeflow-app/system-tokens.html "$BACKUP/system-tokens.html"

python3 - <<'PY'
from pathlib import Path

p = Path("memeflow-app/system-tokens.html")
s = p.read_text()

s = s.replace(
    'href="/system-tokens.css?v=load-perf-v1-20260901"',
    'href="/system-tokens.css?v=token-scan-v27-2-20260902"',
    1
)

s = s.replace(
    'src="/system-tokens.js?v=toolbar-experiments-clean-20260830"',
    'src="/system-tokens.js?v=token-scan-v27-2-20260902"',
    1
)

p.write_text(s)
PY

git diff --check
git add memeflow-app/system-tokens.html
git commit -m "bust token scan asset cache"
git push origin HEAD:main

echo "DONE: cache-bust pushed to main"
