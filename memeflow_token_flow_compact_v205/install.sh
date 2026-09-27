#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$PWD}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/memeflow-app"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.patch-backups/token-flow-compact-v205-$STAMP"
LAST="$HERE/.last-backup"
SHADOW="$(mktemp -d "${TMPDIR:-/tmp}/memeflow-v205-shadow.XXXXXX")"

cleanup(){ rm -rf "$SHADOW"; }
trap cleanup EXIT

[[ -f "$APP/system-tokens.css" ]] || { echo "ERROR: missing memeflow-app/system-tokens.css"; exit 1; }
[[ -f "$APP/system-tokens.html" ]] || { echo "ERROR: missing memeflow-app/system-tokens.html"; exit 1; }

echo "V205 TOKEN FLOW PRE-FLIGHT"
echo "=========================="
echo "1/4 Copy CURRENT Token Flow files to shadow..."
mkdir -p "$SHADOW/memeflow-app"
cp "$APP/system-tokens.css" "$SHADOW/memeflow-app/system-tokens.css"
cp "$APP/system-tokens.html" "$SHADOW/memeflow-app/system-tokens.html"

echo "2/4 Apply V205 to SHADOW only..."
python3 "$HERE/apply.py" "$SHADOW" -

echo "3/4 Audit SHADOW..."
python3 "$HERE/audit.py" "$SHADOW"

echo "4/4 Shadow PASS. Real files have not been changed yet."
echo

mkdir -p "$BACKUP"
printf '%s\n' "$BACKUP" > "$LAST"

rollback_on_error(){
  code=$?
  echo
  echo "V205 real apply failed — restoring exact pre-patch Token Flow files..."
  if [[ -f "$BACKUP/system-tokens.css" && -f "$BACKUP/system-tokens.html" ]]; then
    cp "$BACKUP/system-tokens.css" "$APP/system-tokens.css"
    cp "$BACKUP/system-tokens.html" "$APP/system-tokens.html"
  fi
  exit "$code"
}
trap rollback_on_error ERR INT TERM

echo "Applying V205 to real Token Flow..."
python3 "$HERE/apply.py" "$ROOT" "$BACKUP"
python3 "$HERE/audit.py" "$ROOT"

if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" diff --check -- memeflow-app/system-tokens.css memeflow-app/system-tokens.html
  echo " - git diff --check: PASS"
fi

trap - ERR INT TERM

echo
echo "V205 INSTALLED SUCCESSFULLY"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo "No git commit/push was performed."
echo
echo "Rollback:"
echo "  bash memeflow_token_flow_compact_v205/rollback.sh"
