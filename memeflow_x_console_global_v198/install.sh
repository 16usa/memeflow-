#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$PWD}"; APP="$ROOT/memeflow-app"; HERE="$(cd "$(dirname "$0")" && pwd)"; STAMP="$(date +%Y%m%d-%H%M%S)"; BACKUP="$ROOT/.memeflow-x-console-v198-backup-$STAMP"; LAST="$HERE/.last-backup"
[[ -d "$APP" ]] || { echo "ERROR: memeflow-app not found"; exit 1; }
printf '%s\n' "$BACKUP" > "$LAST"
rollback_on_error(){ code=$?; echo; echo "V198 failed. Restoring exact pre-patch state..."; if [[ -f "$BACKUP/manifest.json" ]]; then bash "$HERE/rollback.sh" "$ROOT" || true; fi; exit "$code"; }
trap rollback_on_error ERR INT TERM
python3 "$HERE/apply.py" "$ROOT" "$BACKUP"
python3 "$HERE/audit.py" "$ROOT"
trap - ERR INT TERM
echo; echo "Installed MEMEFLOW X-CONSOLE GLOBAL UI V198"; echo "Backup: $BACKUP"; echo "No server restart was performed."; echo "Rollback: bash memeflow_x_console_global_v198/rollback.sh"
