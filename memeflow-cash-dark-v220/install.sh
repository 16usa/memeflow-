#!/usr/bin/env bash
set -euo pipefail

ROOT="$PWD"
APP="$ROOT/memeflow-app"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CSS_NAME="memeflow-cash-dark-v220.css"
LINK='<link rel="stylesheet" href="/memeflow-cash-dark-v220.css?v=cash-dark-v220-20260927">'

if [[ ! -d "$APP" ]]; then
  echo "ERROR: memeflow-app was not found in the current workspace."
  echo "Run this from the existing Memflow Replit Shell workspace root."
  exit 1
fi

PAGES=(
  system.html
  how-it-works.html
  smart-vault.html
  trading.html
  settings.html
  system-tokens.html
  x100.html
  agent-performance.html
  index.html
  owner-intelligence.html
  system-source.html
)

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP/.cash-dark-v220-backup-$STAMP"
mkdir -p "$BACKUP"

if [[ -f "$APP/$CSS_NAME" ]]; then
  cp -p "$APP/$CSS_NAME" "$BACKUP/$CSS_NAME"
  printf '1\n' > "$BACKUP/had_css"
else
  printf '0\n' > "$BACKUP/had_css"
fi

for page in "${PAGES[@]}"; do
  if [[ ! -f "$APP/$page" ]]; then
    echo "ERROR: missing $APP/$page"
    exit 1
  fi
  cp -p "$APP/$page" "$BACKUP/$page"
done

cp "$SCRIPT_DIR/$CSS_NAME" "$APP/$CSS_NAME"

python3 - "$APP" "$LINK" "${PAGES[@]}" <<'PY'
from pathlib import Path
import sys

app = Path(sys.argv[1])
link = sys.argv[2]
pages = sys.argv[3:]
needle = 'memeflow-cash-dark-v220.css'

for name in pages:
    path = app / name
    text = path.read_text(encoding='utf-8')
    if needle in text:
        continue
    if '</head>' not in text:
        raise SystemExit(f'ERROR: </head> not found in {path}')
    text = text.replace('</head>', f'{link}\n</head>', 1)
    path.write_text(text, encoding='utf-8')
PY

# Safety check: the requested patch must not own typography sizes or geometry.
if grep -Eiq '(^|[;{[:space:]])(font-size|width|height|padding|margin|gap|border-radius)[[:space:]]*:' "$APP/$CSS_NAME"; then
  echo "ERROR: geometry/size declaration detected in $CSS_NAME"
  exit 1
fi

for page in "${PAGES[@]}"; do
  count="$(grep -c 'memeflow-cash-dark-v220.css' "$APP/$page" || true)"
  if [[ "$count" != "1" ]]; then
    echo "ERROR: expected exactly one V220 stylesheet link in $page, found $count"
    exit 1
  fi
done

git diff --check -- "$APP/$CSS_NAME" "${PAGES[@]/#/$APP/}" || true

echo
echo "MEMEFLOW Cash Dark V220 installed."
echo "Backup: $BACKUP"
echo "Dark theme only; LIGHT rules were not changed."
echo "No server/process restart was performed."
