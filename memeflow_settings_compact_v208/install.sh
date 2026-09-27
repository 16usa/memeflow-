#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/memeflow-app"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.patch-backups/settings-compact-v208-$STAMP"
LAST="$HERE/.last-backup"
SHADOW="$(mktemp -d "${TMPDIR:-/tmp}/memeflow-v208-shadow.XXXXXX")"

cleanup(){ rm -rf "$SHADOW"; }
trap cleanup EXIT

[[ -f "$APP/settings.html" ]] || { echo "ERROR: settings.html missing"; exit 1; }
[[ -f "$APP/settings-page.js" ]] || { echo "ERROR: settings-page.js missing"; exit 1; }

echo "V208 SYSTEM SETTINGS PRE-FLIGHT"
echo "==============================="
echo "1/4 Build shadow from CURRENT Settings..."
mkdir -p "$SHADOW/memeflow-app"
cp "$APP/settings.html" "$SHADOW/memeflow-app/settings.html"
cp "$APP/settings-page.js" "$SHADOW/memeflow-app/settings-page.js"
if [[ -f "$APP/account-wallet-settings.js" ]]; then
  cp "$APP/account-wallet-settings.js" "$SHADOW/memeflow-app/account-wallet-settings.js"
fi

echo "2/4 Apply V208 to SHADOW only..."
python3 "$HERE/apply.py" "$SHADOW" -

echo "3/4 Audit SHADOW..."
python3 "$HERE/audit.py" "$SHADOW"

echo "4/4 Shadow PASS. Real workspace is still untouched."
echo

mkdir -p "$BACKUP"
printf '%s\n' "$BACKUP" > "$LAST"

rollback_on_error(){
  rc=$?
  echo
  echo "V208 real apply failed — restoring exact pre-patch Settings..."
  if [[ -f "$BACKUP/settings.html" ]]; then
    cp "$BACKUP/settings.html" "$APP/settings.html"
  fi
  state="created"
  if [[ -f "$BACKUP/manifest.json" ]]; then
    state="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("css_state","created"))' "$BACKUP/manifest.json")"
  fi
  if [[ "$state" == "existed" && -f "$BACKUP/memeflow-settings-compact-v208.css" ]]; then
    cp "$BACKUP/memeflow-settings-compact-v208.css" "$APP/memeflow-settings-compact-v208.css"
  else
    rm -f "$APP/memeflow-settings-compact-v208.css"
  fi
  exit "$rc"
}
trap rollback_on_error ERR INT TERM

echo "Applying V208 to real Settings..."
python3 "$HERE/apply.py" "$ROOT" "$BACKUP"
python3 "$HERE/audit.py" "$ROOT"

if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" diff --check -- \
    memeflow-app/settings.html \
    memeflow-app/memeflow-settings-compact-v208.css
  echo " - git diff --check: PASS"
fi

trap - ERR INT TERM

echo
echo "V208 INSTALLED SUCCESSFULLY"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo "No git push was performed."
echo
echo "Rollback:"
echo "  bash memeflow_settings_compact_v208/rollback.sh"
