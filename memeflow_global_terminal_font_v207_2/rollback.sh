#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
LAST="$HERE/.last-backup"

[[ -f "$LAST" ]] || { echo "ERROR: no V207.2 backup pointer"; exit 1; }
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

loaders=[
    (root/"memeflow-app/memeflow-terminal-font-v207.css", "v207_loader_existed"),
    (root/"memeflow-app/memeflow-terminal-font-v207-1.css", "v2071_loader_existed"),
    (root/"memeflow-app/memeflow-terminal-font-v207-2.css", "v2072_loader_existed"),
]
for path,key in loaders:
    if not m.get(key,False) and path.exists():
        path.unlink()
print(f"Exact pre-V207.2 state restored ({len(m.get('files',[]))} files).")
PY

echo "No server restart was performed."
