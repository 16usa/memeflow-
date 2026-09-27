#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"; HERE="$(cd "$(dirname "$0")" && pwd)"; LAST="$HERE/.last-backup"
[[ -f "$LAST" ]] || { echo "ERROR: no V193 backup pointer"; exit 1; }
BACKUP="$(cat "$LAST")"; [[ -f "$BACKUP/manifest.json" ]] || { echo "ERROR: backup manifest missing"; exit 1; }
python3 - "$ROOT" "$BACKUP" <<'PY'
from pathlib import Path
import json,shutil,sys
root=Path(sys.argv[1]); b=Path(sys.argv[2]); m=json.loads((b/'manifest.json').read_text())
for rel in m['files']:
    src=b/rel; dst=root/rel; dst.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(src,dst)
css=root/'memeflow-app/memeflow-settings-execution-compact-v193.css'
js=root/'memeflow-app/memeflow-settings-execution-compact-v193.js'
if not m.get('css_existed',False) and css.exists():css.unlink()
if not m.get('js_existed',False) and js.exists():js.unlink()
print('Exact pre-V193 state restored.')
PY
