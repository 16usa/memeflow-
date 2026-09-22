#!/usr/bin/env bash
set -euo pipefail

POINTER=".memeflow-style-deep-clean-v169-last-backup"
if [ ! -f "$POINTER" ]; then
  echo "ERROR: $POINTER not found."
  exit 1
fi

BACKUP="$(cat "$POINTER")"
if [ ! -d "$BACKUP/memeflow-app" ]; then
  echo "ERROR: backup not found: $BACKUP"
  exit 1
fi

APP="memeflow-app"

# Remove V169 generated files first.
rm -f \
  "$APP/memeflow-x-canonical-v169.css" \
  "$APP/memeflow-visual-guardrails-v169.css" \
  "$APP/memeflow-structural-compat-v169.css"

# Restore every backed-up file exactly.
for src in "$BACKUP"/memeflow-app/*; do
  [ -e "$src" ] || continue
  cp -p "$src" "$APP/$(basename "$src")"
done

echo "Rollback complete from $BACKUP"
echo "No server restart was performed."
git status --short
