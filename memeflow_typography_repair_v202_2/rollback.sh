#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
LAST="$HERE/.last-backup"
[[ -f "$LAST" ]] || { echo "ERROR: no V202.2 backup pointer"; exit 1; }
BACKUP="$(cat "$LAST")"
[[ -f "$BACKUP/manifest.json" ]] || { echo "ERROR: backup manifest missing"; exit 1; }
python3 - "$ROOT" "$BACKUP" <<'PY'
from pathlib import Path
import json,shutil,sys
root=Path(sys.argv[1]); backup=Path(sys.argv[2])
m=json.loads((backup/'manifest.json').read_text())
for rel in m['files']:
    src=backup/rel; dst=root/rel
    dst.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(src,dst)
type_css=root/'memeflow-app/memeflow-typography-v2022.css'
if not m.get('type_css_existed',False) and type_css.exists(): type_css.unlink()
print(f"Exact pre-V202.2 state restored ({len(m['files'])} files).")
PY
