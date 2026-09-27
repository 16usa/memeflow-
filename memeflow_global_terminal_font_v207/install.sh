#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/memeflow-app"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.patch-backups/global-terminal-font-v207-$STAMP"
LAST="$HERE/.last-backup"
SHADOW="$(mktemp -d "${TMPDIR:-/tmp}/memeflow-v207-shadow.XXXXXX")"

cleanup(){ rm -rf "$SHADOW"; }
trap cleanup EXIT

[[ -d "$APP" ]] || { echo "ERROR: memeflow-app not found"; exit 1; }

echo "V207 GLOBAL TERMINAL FONT PRE-FLIGHT"
echo "===================================="
echo "1/4 Copy CURRENT site source to shadow..."
mkdir -p "$SHADOW/memeflow-app"

python3 - "$APP" "$SHADOW/memeflow-app" <<'PY'
from pathlib import Path
import shutil,sys
src=Path(sys.argv[1]); dst=Path(sys.argv[2])
for p in src.rglob("*"):
    rel=p.relative_to(src)
    if any(x.startswith(".") or x in {"node_modules","data","dist","build"} for x in rel.parts):
        continue
    if p.is_dir():
        continue
    if p.suffix.lower() in {".css",".html",".js",".mjs",".woff2"}:
        out=dst/rel
        out.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(p,out)
PY

echo "2/4 Apply IBM Plex Mono to SHADOW only..."
python3 "$HERE/apply.py" "$SHADOW" -

echo "3/4 Audit SHADOW..."
python3 "$HERE/audit.py" "$SHADOW" -

echo "4/4 Shadow PASS. Real workspace is still untouched."
echo

mkdir -p "$BACKUP"
printf '%s\n' "$BACKUP" > "$LAST"

rollback_on_error(){
  rc=$?
  echo
  echo "V207 real apply failed — restoring exact pre-patch files..."
  if [[ -f "$BACKUP/manifest.json" ]]; then
    bash "$HERE/rollback.sh" "$ROOT" || true
  fi
  exit "$rc"
}
trap rollback_on_error ERR INT TERM

echo "Applying V207 to real site..."
python3 "$HERE/apply.py" "$ROOT" "$BACKUP"
python3 "$HERE/audit.py" "$ROOT" "$BACKUP"

if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" diff --check
  echo " - git diff --check: PASS"
fi

trap - ERR INT TERM

echo
echo "V207 INSTALLED SUCCESSFULLY"
echo "Font: IBM Plex Mono"
echo "Scope: whole site"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo "No git commit/push was performed."
echo
echo "Rollback:"
echo "  bash memeflow_global_terminal_font_v207/rollback.sh"
