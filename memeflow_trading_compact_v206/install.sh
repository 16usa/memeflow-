#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/memeflow-app"
HTML="$APP/trading.html"
CSS="$APP/trading-compact-v206.css"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.patch-backups/trading-compact-v206-$STAMP"
LAST="$HERE/.last-backup"
SHADOW="$(mktemp -d "${TMPDIR:-/tmp}/memeflow-v206-shadow.XXXXXX")"

cleanup(){ rm -rf "$SHADOW"; }
trap cleanup EXIT

[[ -f "$HTML" ]] || { echo "ERROR: missing memeflow-app/trading.html"; exit 1; }

echo "V206 TRADING TERMINAL PRE-FLIGHT"
echo "================================"
echo "1/4 Build shadow copy from CURRENT Trading Terminal..."
mkdir -p "$SHADOW/memeflow-app"
cp "$HTML" "$SHADOW/memeflow-app/trading.html"

echo "2/4 Apply V206 to SHADOW only..."
python3 "$HERE/apply.py" "$SHADOW" -

echo "3/4 Audit SHADOW..."
python3 "$HERE/audit.py" "$SHADOW"

echo "4/4 Shadow PASS. Real project is still untouched."
echo

mkdir -p "$BACKUP"
printf '%s\n' "$BACKUP" > "$LAST"

restore_on_error(){
  rc=$?
  echo
  echo "V206 real apply failed — restoring exact pre-patch Trading files..."
  if [[ -f "$BACKUP/trading.html" ]]; then
    cp "$BACKUP/trading.html" "$HTML"
  fi
  state="created"
  [[ -f "$BACKUP/manifest.json" ]] && \
    state="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("compact_css","created"))' "$BACKUP/manifest.json" 2>/dev/null || echo created)"
  if [[ "$state" == "existed" && -f "$BACKUP/trading-compact-v206.css" ]]; then
    cp "$BACKUP/trading-compact-v206.css" "$CSS"
  else
    rm -f "$CSS"
  fi
  exit "$rc"
}
trap restore_on_error ERR INT TERM

echo "Applying V206 to real Trading Terminal..."
python3 "$HERE/apply.py" "$ROOT" "$BACKUP"
python3 "$HERE/audit.py" "$ROOT"

if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" diff --check -- memeflow-app/trading.html memeflow-app/trading-compact-v206.css
  echo " - git diff --check: PASS"
fi

trap - ERR INT TERM

echo
echo "V206 INSTALLED SUCCESSFULLY"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo "No git commit/push was performed."
echo
echo "Rollback:"
echo "  bash memeflow_trading_compact_v206/rollback.sh"
