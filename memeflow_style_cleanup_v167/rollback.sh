#!/usr/bin/env bash
set -euo pipefail

POINTER=".memeflow-style-cleanup-v167-last-backup"

if [ ! -f "$POINTER" ]; then
  echo "ERROR: $POINTER not found."
  exit 1
fi

BACKUP="$(cat "$POINTER")"
if [ ! -d "$BACKUP" ]; then
  echo "ERROR: backup directory not found: $BACKUP"
  exit 1
fi

APP="memeflow-app"
PAGES=(
  "index.html"
  "agent-performance.html"
  "how-it-works.html"
  "settings.html"
  "smart-vault.html"
  "system-tokens.html"
  "system.html"
  "trading.html"
  "owner-intelligence.html"
)

for page in "${PAGES[@]}"; do
  if [ -f "$BACKUP/memeflow-app/$page" ]; then
    cp -p "$BACKUP/memeflow-app/$page" "$APP/$page"
  fi
done

rm -f "$APP/memeflow-x-canonical-v167.css"

for file in \
  memeflow-pump-fee-palette-v162.css \
  memeflow-pump-fee-palette-v163.css \
  memeflow-pump-fee-full-ui-v164.css \
  memeflow-pure-black-v165.css \
  memeflow-x-lights-out-v166.css
do
  if [ -f "$BACKUP/memeflow-app/$file" ]; then
    cp -p "$BACKUP/memeflow-app/$file" "$APP/$file"
  fi
done

if [ -d "$BACKUP/root-patch-dirs" ]; then
  for dir in "$BACKUP"/root-patch-dirs/*; do
    [ -e "$dir" ] || continue
    base="$(basename "$dir")"
    rm -rf "$base"
    cp -a "$dir" "$base"
  done
fi

echo "Rollback complete from $BACKUP"
echo "No server restart was performed."
git status --short
