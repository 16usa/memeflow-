#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/memeflow-app"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.patch-backups/remove-x100-v209-$STAMP"
LAST="$HERE/.last-backup"
SHADOW="$(mktemp -d "${TMPDIR:-/tmp}/memeflow-v209-shadow.XXXXXX")"

cleanup(){ rm -rf "$SHADOW"; }
trap cleanup EXIT

[[ -d "$APP" ]] || { echo "ERROR: memeflow-app missing"; exit 1; }

echo "V209 REMOVE X100 PAGE — PRE-FLIGHT"
echo "================================="
echo "1/5 Discover current X100 economic-model page..."
python3 "$HERE/apply.py" "$ROOT" --dry-run

echo
echo "2/5 Build filtered SHADOW from current production source..."
mkdir -p "$SHADOW/memeflow-app"
python3 - "$APP" "$SHADOW/memeflow-app" <<'PY'
from pathlib import Path
import shutil,sys
src=Path(sys.argv[1]); dst=Path(sys.argv[2])
skip={"node_modules",".git",".patch-backups",".mf-backups",".memeflow-backups","tests","test","data","logs","coverage","dist","build","__pycache__"}
allowed={".html",".htm",".js",".mjs",".cjs",".json",".xml",".txt",".css",".png",".jpg",".jpeg",".webp",".svg"}
for p in src.rglob("*"):
    if not p.is_file(): continue
    rel=p.relative_to(src)
    if any(part in skip or "backup" in part.lower() for part in rel.parts): continue
    if p.suffix.lower() not in allowed: continue
    q=dst/rel; q.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(p,q)
PY

echo "3/5 Apply removal to SHADOW only..."
mkdir -p "$SHADOW/backup"
python3 "$HERE/apply.py" "$SHADOW" --backup "$SHADOW/backup"

echo "4/5 Audit SHADOW..."
python3 "$HERE/apply.py" "$SHADOW" --audit
echo "Shadow PASS. Real workspace is still untouched."

echo
echo "5/5 Apply to REAL workspace with automatic rollback on any failure..."
mkdir -p "$BACKUP"
printf '%s\n' "$BACKUP" > "$LAST"

rollback_on_error(){
  rc=$?
  echo
  echo "V209 failed — restoring exact pre-patch files..."
  if [[ -f "$BACKUP/manifest.json" ]]; then
    python3 - "$APP" "$BACKUP" <<'PY'
from pathlib import Path
import json,shutil,sys
app=Path(sys.argv[1]); backup=Path(sys.argv[2])
m=json.loads((backup/"manifest.json").read_text())
for rel in m.get("files",[]):
    src=backup/"files"/rel
    dst=app/rel
    dst.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(src,dst)
print("Automatic rollback complete.")
PY
  fi
  exit "$rc"
}
trap rollback_on_error ERR INT TERM

python3 "$HERE/apply.py" "$ROOT" --backup "$BACKUP"
python3 "$HERE/apply.py" "$ROOT" --audit

if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" diff --check
  echo " - git diff --check: PASS"
fi

trap - ERR INT TERM

echo
echo "V209 INSTALLED SUCCESSFULLY"
echo "Backup: $BACKUP"
echo "The X100 economic-model page is physically removed from production source."
echo "No server restart was performed."
echo "No git push was performed."
echo
echo "Rollback:"
echo "  bash memeflow_remove_x100_v209/rollback.sh"
