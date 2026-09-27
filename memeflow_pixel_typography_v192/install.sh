#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$PWD}"
APP="$ROOT/memeflow-app"
HERE="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.memeflow-pixel-type-v192-backup-$STAMP"
LAST="$HERE/.last-backup"

[[ -d "$APP" ]] || { echo "ERROR: $APP not found"; exit 1; }
[[ -f "$APP/index.html" ]] || { echo "ERROR: memeflow-app/index.html missing"; exit 1; }
printf '%s\n' "$BACKUP" > "$LAST"

rollback_on_error() {
  code=$?
  echo
  echo "V192 validation failed. Restoring exact pre-patch state..."
  if [[ -f "$BACKUP/manifest.json" ]]; then
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
print(f"Automatic rollback restored {len(m['files'])} files.")
PY
  fi
  exit "$code"
}
trap rollback_on_error ERR INT TERM

python3 "$HERE/apply.py" "$ROOT" "$BACKUP"
python3 "$HERE/audit.py" "$ROOT"
trap - ERR INT TERM

echo
echo "Installed MEMEFLOW PIXEL TYPOGRAPHY V192"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo
echo "Rollback:"
echo "  bash memeflow_pixel_typography_v192/rollback.sh"
