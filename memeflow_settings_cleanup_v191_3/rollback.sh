#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"
LAST="$ROOT/.memeflow-settings-v1913-last"
[[ -f "$LAST" ]] || { echo "ERROR: V191.3 backup pointer not found"; exit 1; }
BACKUP="$(cat "$LAST")"
[[ -f "$BACKUP/manifest.json" ]] || { echo "ERROR: backup manifest missing: $BACKUP"; exit 1; }
python3 - "$ROOT" "$BACKUP" <<'PY'
from pathlib import Path
import json, shutil, sys
root=Path(sys.argv[1]); backup=Path(sys.argv[2])
data=json.loads((backup/'manifest.json').read_text(encoding='utf-8'))
for rel in data['files']:
    src=backup/rel; dst=root/rel
    dst.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(src,dst)
print('Restored',len(data['files']),'files from',backup)
PY
echo "V191.3 rollback complete."
echo "No server restart was performed."
