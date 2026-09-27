#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$PWD}"; HERE="$(cd "$(dirname "$0")" && pwd)"; APP="$ROOT/memeflow-app"
STAMP="$(date +%Y%m%d-%H%M%S)"; BACKUP="$ROOT/.memeflow-execution-v193-backup-$STAMP"; LAST="$HERE/.last-backup"
[[ -f "$APP/settings.html" ]] || { echo "ERROR: settings.html not found"; exit 1; }
printf '%s\n' "$BACKUP" > "$LAST"
rollback_on_error(){ code=$?; echo "V193 failed. Restoring pre-patch state..."; if [[ -f "$BACKUP/manifest.json" ]]; then bash "$HERE/rollback.sh" "$ROOT" || true; fi; exit "$code"; }
trap rollback_on_error ERR INT TERM
python3 "$HERE/apply.py" "$ROOT" "$BACKUP"
python3 "$HERE/audit.py" "$ROOT"
trap - ERR INT TERM
echo
echo "Installed MEMEFLOW EXECUTION & SAFETY COMPACT V193"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo "Rollback: bash memeflow_execution_compact_v193/rollback.sh"
