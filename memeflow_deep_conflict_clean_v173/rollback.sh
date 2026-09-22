#!/usr/bin/env bash
set -euo pipefail

POINTER=".memeflow-deep-conflict-clean-v173-last-backup"

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
rm -f "$APP/memeflow-x-canonical-v173.css"

for src in "$BACKUP"/memeflow-app/*; do
  [ -e "$src" ] || continue
  name="$(basename "$src")"
  [[ "$name" == *.before ]] && continue
  cp -p "$src" "$APP/$name"
done

echo "Rollback complete from $BACKUP"
echo "No server restart was performed."
git status --short
