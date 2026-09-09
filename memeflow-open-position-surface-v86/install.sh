#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

APP="$ROOT/memeflow-app"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in \
  "$APP/trading.html" \
  "$APP/open-position-popover-v85.css"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: missing required file: $f"
    echo "V86 requires the working V85 popover first."
    exit 1
  fi
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ROOT/.memeflow-backups/open-position-surface-v86-$STAMP"
mkdir -p "$BACKUP/memeflow-app/tests"

TARGETS=(
  "memeflow-app/trading.html"
  "memeflow-app/open-position-surface-v86.css"
  "memeflow-app/tests/open-position-surface-v86.mjs"
)

for rel in "${TARGETS[@]}"; do
  flag="$BACKUP/${rel//\//__}.existed"
  if [[ -f "$ROOT/$rel" ]]; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp "$ROOT/$rel" "$BACKUP/$rel"
    printf '1\n' > "$flag"
  else
    printf '0\n' > "$flag"
  fi
done

git rev-parse HEAD > "$BACKUP/git-head.txt" 2>/dev/null || true
printf '%s\n' "$BACKUP" > "$ROOT/.memeflow-open-position-surface-v86-last-backup"

cp "$PATCH_DIR/open-position-surface-v86.css" \
   "$APP/open-position-surface-v86.css"
mkdir -p "$APP/tests"
cp "$PATCH_DIR/tests/open-position-surface-v86.mjs" \
   "$APP/tests/open-position-surface-v86.mjs"

python3 "$PATCH_DIR/patch_html_v86.py" "$APP/trading.html"

echo "[1/4] Syntax check"
python3 -m py_compile "$PATCH_DIR/patch_html_v86.py"
node --check "$APP/tests/open-position-surface-v86.mjs"

echo "[2/4] V86 regression test"
(
  cd "$APP"
  node tests/open-position-surface-v86.mjs
)

echo "[3/4] Existing V85 regression test"
(
  cd "$APP"
  if [[ -f tests/open-position-popover-v85.mjs ]]; then
    node tests/open-position-popover-v85.mjs
  fi
)

echo "[4/4] Diff guard + Git checkpoint"
git diff --check -- \
  memeflow-app/trading.html \
  memeflow-app/open-position-surface-v86.css \
  memeflow-app/tests/open-position-surface-v86.mjs

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ! git diff --cached --quiet; then
    echo "NOTICE: pre-existing staged changes detected."
    echo "V86 installed/tested, but auto-commit/push skipped to avoid mixing unrelated work."
  else
    git add \
      memeflow-app/trading.html \
      memeflow-app/open-position-surface-v86.css \
      memeflow-app/tests/open-position-surface-v86.mjs

    if git diff --cached --quiet; then
      echo "V86 already present; nothing new to commit."
    else
      git commit -m "fix(trading): align info popover surfaces"

      if git remote get-url origin >/dev/null 2>&1; then
        if git push origin HEAD; then
          echo "Push: OK"
        else
          echo "NOTICE: commit created locally, but push failed."
          echo "Run: git push origin HEAD"
        fi
      fi
    fi
  fi
fi

echo
echo "V86 PATCH OK"
echo "Backup: $BACKUP"
echo "Rollback: bash memeflow-open-position-surface-v86/rollback.sh"
echo
echo "Theme surfaces:"
echo "  LIGHT -> site Surface 2 (#f7f9fb token)"
echo "  DARK  -> site neutral inset (#101113 token)"
echo "Icon, dimensions, P&L colors and interaction are unchanged."
