#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
LAST="$HERE/.last-backup"
[[ -f "$LAST" ]] || { echo "ERROR: no V192 backup pointer found"; exit 1; }
BACKUP="$(cat "$LAST")"
[[ -f "$BACKUP/manifest.json" ]] || { echo "ERROR: backup manifest missing: $BACKUP"; exit 1; }

python3 - "$ROOT" "$BACKUP" <<'PY'
from pathlib import Path
import json, shutil, sys
root=Path(sys.argv[1]); backup=Path(sys.argv[2])
m=json.loads((backup/'manifest.json').read_text())
for rel in m['files']:
    src=backup/rel; dst=root/rel
    dst.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(src,dst)
css=root/'memeflow-app/memeflow-pixel-typography-v192.css'
if not m.get('css_existed',False) and css.exists(): css.unlink()
print(f"Rollback restored {len(m['files'])} files.")
print('Exact pre-V192 state restored.')
PY
