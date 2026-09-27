#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/memeflow-app"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.memeflow-v204-backup-$STAMP"
LAST="$HERE/.last-backup"
SHADOW="$(mktemp -d "${TMPDIR:-/tmp}/memeflow-v204-shadow.XXXXXX")"
cleanup(){ rm -rf "$SHADOW"; }
trap cleanup EXIT
[[ -d "$APP" ]] || { echo "ERROR: memeflow-app not found"; exit 1; }

echo "V204 PRE-FLIGHT"
echo "==============="
echo "1/5 Copy CURRENT production source to shadow..."
mkdir -p "$SHADOW/memeflow-app"
python3 - "$APP" "$SHADOW/memeflow-app" <<'PY'
from pathlib import Path
import shutil,sys
src=Path(sys.argv[1]); dst=Path(sys.argv[2])
for p in src.rglob('*'):
    rel=p.relative_to(src)
    if any(x.startswith('.') or x in {'node_modules','data','dist','build'} for x in rel.parts): continue
    if p.is_dir(): continue
    if p.suffix.lower() in {'.css','.html','.js','.mjs','.woff2'}:
        out=dst/rel; out.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(p,out)
PY

echo "2/5 Discover linked production CSS + patch SHADOW only..."
python3 "$HERE/apply.py" "$SHADOW" - >/tmp/mf-v204-shadow-apply.log

echo "3/5 Audit SHADOW production graph..."
python3 "$HERE/audit.py" "$SHADOW"

echo "4/5 Shadow PASS. Real workspace is still untouched."
echo
printf '%s\n' "$BACKUP" > "$LAST"
rollback_on_error(){
  code=$?
  echo
  echo "V204 real apply failed. Restoring exact pre-patch state..."
  if [[ -f "$BACKUP/manifest.json" ]]; then bash "$HERE/rollback.sh" "$ROOT" || true; fi
  exit "$code"
}
trap rollback_on_error ERR INT TERM

echo "5/5 Apply to real production graph + audit..."
python3 "$HERE/apply.py" "$ROOT" "$BACKUP"
python3 "$HERE/audit.py" "$ROOT"
if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" diff --check
  echo " - git diff --check: PASS"
fi
trap - ERR INT TERM

echo
echo "V204 INSTALLED SUCCESSFULLY"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo "Rollback: bash memeflow_typography_v204/rollback.sh"
