#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/memeflow-app"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.patch-backups/remove-x100-v2091-$STAMP"
LAST="$HERE/.last-backup"
SHADOW="$(mktemp -d "${TMPDIR:-/tmp}/memeflow-v2091-shadow.XXXXXX")"
cleanup(){ rm -rf "$SHADOW"; }
trap cleanup EXIT
[[ -d "$APP" ]] || { echo "ERROR: memeflow-app missing"; exit 1; }

echo "V209.1 REMOVE X100 PAGE — PRE-FLIGHT"
echo "====================================="
echo "1/5 Targeted discovery (production files only)..."
python3 "$HERE/apply.py" "$ROOT" --dry-run

echo "2/5 Build SHADOW from top-level production UI only..."
mkdir -p "$SHADOW/memeflow-app/brand"
for f in "$APP"/*.html "$APP"/*.js "$APP"/*.mjs "$APP"/*.cjs "$APP"/*.json "$APP"/*.xml "$APP"/*.css; do
  [[ -f "$f" ]] || continue
  cp -p "$f" "$SHADOW/memeflow-app/"
done
[[ ! -f "$APP/brand/manifest.json" ]] || cp -p "$APP/brand/manifest.json" "$SHADOW/memeflow-app/brand/manifest.json"

echo "3/5 Apply to SHADOW only..."
mkdir -p "$SHADOW/backup"
python3 "$HERE/apply.py" "$SHADOW" --backup "$SHADOW/backup"

echo "4/5 Audit SHADOW..."
python3 "$HERE/apply.py" "$SHADOW" --audit
if command -v node >/dev/null 2>&1 && [[ -f "$SHADOW/memeflow-app/memeflow-nav.js" ]]; then
  node --check "$SHADOW/memeflow-app/memeflow-nav.js"
  echo " - shadow memeflow-nav.js syntax: PASS"
fi
echo "Shadow PASS. Real workspace is still untouched."

echo "5/5 Apply to REAL workspace with exact backup..."
mkdir -p "$BACKUP"
printf '%s\n' "$BACKUP" > "$LAST"
rollback_on_error(){
  rc=$?
  echo "V209.1 real apply failed — restoring exact pre-patch state..."
  if [[ -f "$BACKUP/manifest.json" ]]; then
    bash "$HERE/rollback.sh" "$ROOT" || true
  fi
  exit "$rc"
}
trap rollback_on_error ERR INT TERM
python3 "$HERE/apply.py" "$ROOT" --backup "$BACKUP"
python3 "$HERE/apply.py" "$ROOT" --audit
if command -v node >/dev/null 2>&1; then
  node --check "$APP/memeflow-nav.js"
  echo " - real memeflow-nav.js syntax: PASS"
fi
if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" diff --check
  echo " - git diff --check: PASS"
fi
trap - ERR INT TERM

echo
echo "V209.1 INSTALLED SUCCESSFULLY"
echo "X100 economic-model page removed from the site."
echo "Smart Vault/devnet/game state files were not scanned or modified."
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo "No git push was performed."
echo
echo "Rollback:"
echo "  bash memeflow_remove_x100_v209_1/rollback.sh"
