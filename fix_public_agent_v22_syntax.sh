#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$PWD}"
APP="$ROOT/memeflow-app"
FILE="$APP/app-server.mjs"

[ -f "$FILE" ] || { echo "ERROR: run from repository root"; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.mf-backups/public-agent-v22-syntax-$STAMP"
mkdir -p "$BACKUP"
cp "$FILE" "$BACKUP/app-server.mjs"
echo "Backup: $BACKUP"

python3 - "$FILE" <<'PY'
from pathlib import Path
import sys

f=Path(sys.argv[1])
s=f.read_text()

bad="safety:{testDraftsNeverPublish:true})})}"
good="safety:{testDraftsNeverPublish:true}})}"

if bad not in s:
    raise SystemExit("FIX ABORTED: expected malformed V2.2 GET response was not found")

s=s.replace(bad,good,1)
f.write_text(s)
print("Fixed malformed Public Agent V2.2 GET response.")
PY

cd "$APP"
node --check app-server.mjs
node --check settings-page.js
git diff --check

echo
echo "OK — Public Agent V2.2 syntax repaired."
echo "Backup: $BACKUP"
echo "Do not commit yet."
