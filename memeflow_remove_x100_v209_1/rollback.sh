#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/memeflow-app"
LAST="$HERE/.last-backup"
[[ -f "$LAST" ]] || { echo "ERROR: no V209.1 backup pointer"; exit 1; }
BACKUP="$(cat "$LAST")"
[[ -f "$BACKUP/manifest.json" ]] || { echo "ERROR: backup manifest missing"; exit 1; }
python3 - "$APP" "$BACKUP" <<'PY'
from pathlib import Path
import json,shutil,sys
app=Path(sys.argv[1]); backup=Path(sys.argv[2]); m=json.loads((backup/'manifest.json').read_text())
for rel in m.get('files',[]):
    src=backup/'files'/rel
    dst=app/rel
    dst.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(src,dst)
print('Exact pre-V209.1 state restored.')
PY
echo "No server restart was performed."
