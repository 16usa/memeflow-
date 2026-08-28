#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW 3D/CANVAS SCREEN LIGHT V3
# ------------------------------------------------------------
# The previous CSS patch is already installed.
# This patch fixes the ACTUAL remaining source of the dark screen:
# memeflow-flow-v4.js paints a full-canvas radial atmosphere every frame.
#
# Changes ONLY:
#   memeflow-app/memeflow-flow-v4.js
#     - existing canvas background color stops inside draw()
#   memeflow-app/system.html
#     - existing JS query string only, for Safari/Replit cache busting
#
# NO new CSS layer
# NO new selector
# NO DOM/layout changes
# NO flow/trading/telemetry logic changes
# NO geometry changes
# Unrelated dirty runtime/backup files are allowed and untouched.
# ------------------------------------------------------------

EXPECTED_HEAD="6accd05ded792690447168a7cdcaf237bdd7b9e8"

REPO="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$REPO" ]]; then
  echo "ERROR: Run this inside the MEMEFLOW git repository." >&2
  exit 1
fi
cd "$REPO"

JS="memeflow-app/memeflow-flow-v4.js"
HTML="memeflow-app/system.html"

for f in "$JS" "$HTML"; do
  [[ -f "$f" ]] || { echo "ERROR: Missing $f" >&2; exit 1; }
done

[[ "$(git branch --show-current)" == "main" ]] || {
  echo "ERROR: Current branch must be main." >&2
  exit 1
}

git fetch origin

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/main)"

if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  echo "ERROR: local main differs from origin/main." >&2
  echo "Local : $LOCAL_HEAD" >&2
  echo "Remote: $REMOTE_HEAD" >&2
  echo "Nothing changed." >&2
  exit 1
fi

if [[ "$REMOTE_HEAD" != "$EXPECTED_HEAD" ]]; then
  echo "ERROR: GitHub main changed since this V3 patch was audited." >&2
  echo "Expected: $EXPECTED_HEAD" >&2
  echo "Current : $REMOTE_HEAD" >&2
  echo "Nothing changed. Rebuild against the new main." >&2
  exit 1
fi

# Other dirty/staged runtime files are allowed.
# Only our two target files must be pristine relative to audited HEAD.
for f in "$JS" "$HTML"; do
  if ! git diff --quiet -- "$f"; then
    echo "ERROR: target file already has local edits: $f" >&2
    git status --short -- "$f"
    exit 1
  fi
  if ! git diff --cached --quiet -- "$f"; then
    echo "ERROR: target file is already staged: $f" >&2
    git status --short -- "$f"
    exit 1
  fi

  EXPECTED_BLOB="$(git rev-parse "$EXPECTED_HEAD:$f")"
  ACTUAL_BLOB="$(git hash-object "$f")"

  if [[ "$EXPECTED_BLOB" != "$ACTUAL_BLOB" ]]; then
    echo "ERROR: $f differs from audited GitHub state." >&2
    echo "Expected blob: $EXPECTED_BLOB" >&2
    echo "Actual blob  : $ACTUAL_BLOB" >&2
    exit 1
  fi
done

echo "Exact audited JS/HTML verification passed."
echo "Unrelated runtime/backup changes are allowed and will remain untouched."

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-3d-canvas-light-v3-$STAMP"
mkdir -p "$BACKUP"
cp "$JS" "$BACKUP/memeflow-flow-v4.js"
cp "$HTML" "$BACKUP/system.html"
echo "Backup: $BACKUP"

APPLIED=0
COMMITTED=0

restore_targets() {
  git reset -- "$JS" "$HTML" >/dev/null 2>&1 || true
  cp "$BACKUP/memeflow-flow-v4.js" "$JS"
  cp "$BACKUP/system.html" "$HTML"
}

on_exit() {
  rc=$?
  if [[ "$rc" -ne 0 && "$APPLIED" -eq 1 && "$COMMITTED" -eq 0 ]]; then
    echo
    echo "Validation failed — restoring ONLY JS/HTML targets..."
    restore_targets
    echo "Targets restored. Unrelated files were not touched."
  fi
  exit "$rc"
}
trap on_exit EXIT

python3 - "$JS" "$HTML" <<'PY'
from pathlib import Path
import sys

js_path = Path(sys.argv[1])
html_path = Path(sys.argv[2])

js = js_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

# This is the existing full-canvas background inside draw().
# It currently paints almost nothing over the CSS (.045 / .012 / 0).
old_bg = """  bg.addColorStop(
    0,
    'rgba(15,49,58,.045)'
  );

  bg.addColorStop(
    .45,
    'rgba(4,12,17,.012)'
  );

  bg.addColorStop(
    1,
    'rgba(0,0,0,0)'
  );"""

# Same existing radial background, simply made visibly blue-graphite.
# No new canvas, layer, function or draw pass.
new_bg = """  bg.addColorStop(
    0,
    'rgba(55,134,168,.46)'
  );

  bg.addColorStop(
    .45,
    'rgba(22,66,86,.30)'
  );

  bg.addColorStop(
    1,
    'rgba(8,26,36,.16)'
  );"""

old_src = '<script src="/memeflow-flow-v4.js?v=4.5-pro-truth" defer></script>'
new_src = '<script src="/memeflow-flow-v4.js?v=4.5-pro-truth-light-v3" defer></script>'

if js.count(old_bg) != 1:
    raise SystemExit(
        f"ERROR [canvas atmosphere]: expected one exact block, found {js.count(old_bg)}"
    )

if html.count(old_src) != 1:
    raise SystemExit(
        f"ERROR [JS cache src]: expected one exact script tag, found {html.count(old_src)}"
    )

js2 = js.replace(old_bg, new_bg, 1)
html2 = html.replace(old_src, new_src, 1)

# Strict final content checks.
if "rgba(55,134,168,.46)" not in js2:
    raise SystemExit("ERROR: new canvas center atmosphere missing.")
if "rgba(22,66,86,.30)" not in js2:
    raise SystemExit("ERROR: new canvas mid atmosphere missing.")
if "rgba(8,26,36,.16)" not in js2:
    raise SystemExit("ERROR: new canvas edge atmosphere missing.")
if "4.5-pro-truth-light-v3" not in html2:
    raise SystemExit("ERROR: JS cache-busting query missing.")

js_path.write_text(js2, encoding="utf-8")
html_path.write_text(html2, encoding="utf-8")

print("Existing Canvas background color stops strengthened in place.")
print("Existing JS script query updated for cache busting.")
PY

APPLIED=1

# Syntax checks.
git diff --check -- "$JS" "$HTML"

if command -v node >/dev/null 2>&1; then
  node --check "$JS"
  echo "JavaScript syntax check passed."
fi

# Strong safety: JS must equal backup with ONLY the exact background block replaced.
python3 - "$BACKUP/memeflow-flow-v4.js" "$JS" <<'PY'
from pathlib import Path
import sys

before = Path(sys.argv[1]).read_text(encoding="utf-8")
after = Path(sys.argv[2]).read_text(encoding="utf-8")

old_bg = """  bg.addColorStop(
    0,
    'rgba(15,49,58,.045)'
  );

  bg.addColorStop(
    .45,
    'rgba(4,12,17,.012)'
  );

  bg.addColorStop(
    1,
    'rgba(0,0,0,0)'
  );"""

new_bg = """  bg.addColorStop(
    0,
    'rgba(55,134,168,.46)'
  );

  bg.addColorStop(
    .45,
    'rgba(22,66,86,.30)'
  );

  bg.addColorStop(
    1,
    'rgba(8,26,36,.16)'
  );"""

expected = before.replace(old_bg, new_bg, 1)
if expected != after:
    raise SystemExit(
        "ERROR: memeflow-flow-v4.js changed beyond the existing Canvas background colors."
    )

print("JS safety guard passed: only existing Canvas atmosphere colors changed.")
PY

# HTML must equal backup with only the JS query changed.
python3 - "$BACKUP/system.html" "$HTML" <<'PY'
from pathlib import Path
import sys

before = Path(sys.argv[1]).read_text(encoding="utf-8")
after = Path(sys.argv[2]).read_text(encoding="utf-8")

old = '<script src="/memeflow-flow-v4.js?v=4.5-pro-truth" defer></script>'
new = '<script src="/memeflow-flow-v4.js?v=4.5-pro-truth-light-v3" defer></script>'

if before.replace(old, new, 1) != after:
    raise SystemExit("ERROR: system.html changed beyond the JS cache query.")

print("HTML safety guard passed: only JS cache query changed.")
PY

# Verify our target diff only; ignore unrelated working-tree dirt.
TARGET_CHANGED="$(git diff --name-only -- "$JS" "$HTML" | sort)"
EXPECTED_TARGETS="$(printf '%s\n' "$JS" "$HTML" | sort)"
if [[ "$TARGET_CHANGED" != "$EXPECTED_TARGETS" ]]; then
  echo "ERROR: target diff is not exactly JS + HTML cache query." >&2
  printf '%s\n' "$TARGET_CHANGED" >&2
  exit 1
fi

echo
echo "V3 target diff:"
git diff --stat -- "$JS" "$HTML"

# Commit only the two target paths, preserving all unrelated dirty/staged files.
git add -- "$JS" "$HTML"

git commit --only \
  -m "Brighten MEMEFLOW canvas atmosphere without adding layers" \
  -- "$JS" "$HTML"

COMMITTED=1

git push origin main

trap - EXIT

echo
echo "DONE — visible blue-graphite Canvas atmosphere installed."
echo "Changed only:"
echo "  $JS (3 existing Canvas background color stops)"
echo "  $HTML (JS cache query only)"
echo "No CSS layer, DOM layout, geometry, telemetry or trading logic was changed."
echo "Unrelated runtime/backup files were left untouched."
