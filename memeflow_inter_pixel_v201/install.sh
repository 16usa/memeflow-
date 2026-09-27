#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$PWD}"
APP="$ROOT/memeflow-app"
HERE="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.memeflow-inter-pixel-v201-backup-$STAMP"
LAST="$HERE/.last-backup"

[[ -d "$APP" ]] || { echo "ERROR: memeflow-app not found"; exit 1; }
printf '%s\n' "$BACKUP" > "$LAST"

rollback_on_error(){
  code=$?
  echo
  echo "V201 failed. Restoring exact pre-patch state..."
  if [[ -f "$BACKUP/manifest.json" ]]; then
    bash "$HERE/rollback.sh" "$ROOT" || true
  fi
  exit "$code"
}
trap rollback_on_error ERR INT TERM

python3 "$HERE/apply.py" "$ROOT" "$BACKUP"
python3 "$HERE/audit.py" "$ROOT"

trap - ERR INT TERM

echo
echo "Installed MEMEFLOW INTER + PIXEL SCALE V201"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo
echo "Rollback:"
echo "  bash memeflow_inter_pixel_v201/rollback.sh"
