#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/memeflow-app"
LAST="$HERE/.last-backup"

[[ -f "$LAST" ]] || { echo "ERROR: no V207.1 backup pointer"; exit 1; }
BACKUP="$(cat "$LAST")"
[[ -f "$BACKUP/manifest.json" ]] || { echo "ERROR: backup manifest missing"; exit 1; }

python3 - "$ROOT" "$BACKUP" <<'PY'
from pathlib import Path
import json,shutil,sys
root=Path(sys.argv[1]); backup=Path(sys.argv[2])
m=json.loads((backup/"manifest.json").read_text())
for rel in m.get("files",[]):
    src=backup/rel
    dst=root/rel
    dst.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(src,dst)

v207=root/"memeflow-app/memeflow-terminal-font-v207.css"
v2071=root/"memeflow-app/memeflow-terminal-font-v207-1.css"
if not m.get("v207_loader_existed",False) and v207.exists():
    v207.unlink()
if not m.get("v2071_loader_existed",False) and v2071.exists():
    v2071.unlink()

print(f"Exact pre-V207.1 state restored ({len(m.get('files',[]))} files).")
PY
echo "No server restart was performed."
