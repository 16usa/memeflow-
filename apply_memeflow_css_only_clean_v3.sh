#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW CSS-ONLY CLEANUP V3
# ------------------------------------------------------------
# ONLY visual CSS cleanup for:
#   memeflow-app/system.css
#   memeflow-app/system-tokens.css
#   memeflow-app/trading.css
#
# NEVER touches HTML/JS/API/data.
# NEVER changes layout/geometry.
# NEVER appends an override/theme layer.
#
# Allowed changes:
#   CSS color/transparency variables
#   border / border-color
#   background color transparency
#   box-shadow
#
# Explicitly forbidden:
#   display/grid/flex/position
#   width/height
#   margin/padding/gap
#   top/right/bottom/left
#   transform
#   font-size/line-height
#   overflow
#   border-radius
# ------------------------------------------------------------

EXPECTED_HEAD="ee1abe8b437c8a4899140ddf5ff3d62ec1a72b3e"

if [[ -d "memeflow-app" ]]; then
  APP="memeflow-app"
elif [[ -f "system.css" && -f "system-tokens.css" && -f "trading.css" ]]; then
  APP="."
else
  echo "ERROR: Run from repository root or memeflow-app." >&2
  exit 1
fi

FILES=(
  "$APP/system.css"
  "$APP/system-tokens.css"
  "$APP/trading.css"
)

for f in "${FILES[@]}"; do
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
  exit 1
fi

if [[ "$REMOTE_HEAD" != "$EXPECTED_HEAD" ]]; then
  echo "ERROR: main changed since this CSS patch was audited." >&2
  echo "Expected: $EXPECTED_HEAD" >&2
  echo "Current : $REMOTE_HEAD" >&2
  echo "Nothing changed." >&2
  exit 1
fi

# Runtime/backups can be dirty. Only our three CSS files must be clean.
if ! git diff --quiet -- "${FILES[@]}"; then
  echo "ERROR: One of the three CSS files has local edits:" >&2
  git status --short -- "${FILES[@]}"
  exit 1
fi

if ! git diff --cached --quiet -- "${FILES[@]}"; then
  echo "ERROR: One of the three CSS files is staged already:" >&2
  git status --short -- "${FILES[@]}"
  exit 1
fi

STAGED_OTHER="$(git diff --cached --name-only || true)"
if [[ -n "$STAGED_OTHER" ]]; then
  echo "ERROR: unrelated files are staged. Unstage them first:" >&2
  printf '%s\n' "$STAGED_OTHER" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-css-only-cleanup-v3-$STAMP"
mkdir -p "$BACKUP"

for f in "${FILES[@]}"; do
  cp "$f" "$BACKUP/$(basename "$f")"
done

echo "Backup: $BACKUP"

restore_files() {
  git reset -- "${FILES[@]}" >/dev/null 2>&1 || true
  for f in "${FILES[@]}"; do
    cp "$BACKUP/$(basename "$f")" "$f"
  done
}

APPLIED=0
COMMITTED=0

on_exit() {
  rc=$?
  if [[ "$rc" -ne 0 && "$APPLIED" -eq 1 && "$COMMITTED" -eq 0 ]]; then
    echo "Validation failed — restoring original CSS files..."
    restore_files
    echo "Restored. Nothing from this patch remains."
  fi
  exit "$rc"
}
trap on_exit EXIT

python3 - "${FILES[@]}" <<'PY'
from pathlib import Path
import sys

system_path, tokens_path, trading_path = map(Path, sys.argv[1:4])

system = system_path.read_text(encoding="utf-8")
tokens = tokens_path.read_text(encoding="utf-8")
trading = trading_path.read_text(encoding="utf-8")


def replace_checked(text, old, new, label, min_count=1):
    n = text.count(old)
    if n < min_count:
        raise SystemExit(
            f"ERROR [{label}]: expected at least {min_count} occurrence(s), found {n}"
        )
    return text.replace(old, new)


# ============================================================
# SYSTEM / PIPELINE / SETTINGS
# No geometry changes. Only quieter lines and shadows.
# ============================================================

system = replace_checked(
    system,
    "--line:rgba(145,173,198,.095);",
    "--line:rgba(145,173,198,.065);",
    "system line token",
)
system = replace_checked(
    system,
    "--line-strong:rgba(146,187,219,.18);",
    "--line-strong:rgba(146,187,219,.13);",
    "system strong line token",
)
system = replace_checked(
    system,
    "--shadow:0 24px 80px rgba(0,0,0,.42);",
    "--shadow:0 18px 52px rgba(0,0,0,.26);",
    "system shadow",
)
system = replace_checked(
    system,
    "border:1px solid rgba(138,172,199,.085);",
    "border:1px solid rgba(138,172,199,.065);",
    "pipeline viewport border",
)

# Settings native fields: quieter nested boxes, same exact dimensions.
system = replace_checked(
    system,
    "border: 1px solid rgba(88, 130, 147, .065);",
    "border: 1px solid rgba(88, 130, 147, .035);",
    "settings field borders",
)
system = replace_checked(
    system,
    "border: 1px solid rgba(92, 137, 157, .09);",
    "border: 1px solid rgba(92, 137, 157, .055);",
    "settings group borders",
)
system = replace_checked(
    system,
    "border: 1px solid rgba(88, 129, 147, .07);",
    "border: 1px solid rgba(88, 129, 147, .04);",
    "settings meta borders",
)
system = replace_checked(
    system,
    "border: 1px solid rgba(111, 152, 170, .14);",
    "border: 1px solid rgba(111, 152, 170, .10);",
    "settings switches",
)
system = replace_checked(
    system,
    "border-top: 1px solid rgba(94, 137, 156, .085);",
    "border-top: 1px solid rgba(94, 137, 156, .05);",
    "settings footer separator",
)


# ============================================================
# TOKEN FLOW
# Keep status left rail and pills; make full-card outlines quiet.
# ============================================================

tokens = replace_checked(
    tokens,
    "--line: rgba(147, 178, 202, .09);",
    "--line: rgba(147, 178, 202, .06);",
    "token flow line token",
)
tokens = replace_checked(
    tokens,
    "--line-strong: rgba(147, 178, 202, .17);",
    "--line-strong: rgba(147, 178, 202, .12);",
    "token flow strong line",
)

for old, new, label in [
    ("rgba(77, 230, 161, .10)", "rgba(77, 230, 161, .06)", "ready filter"),
    ("rgba(92, 141, 255, .10)", "rgba(92, 141, 255, .06)", "watch filter"),
    ("rgba(255, 102, 121, .11)", "rgba(255, 102, 121, .07)", "blocked filter"),
    ("rgba(77, 230, 161, .14)", "rgba(77, 230, 161, .08)", "ready token border"),
    ("rgba(92, 141, 255, .14)", "rgba(92, 141, 255, .08)", "watch token border"),
    ("rgba(146, 165, 178, .10)", "rgba(146, 165, 178, .06)", "waiting token border"),
    ("rgba(255, 102, 121, .16)", "rgba(255, 102, 121, .10)", "blocked token border"),
]:
    tokens = replace_checked(tokens, old, new, label)


# ============================================================
# TRADING TERMINAL
# Same panels/rows/positions — only quieter visual boundaries.
# ============================================================

trading = replace_checked(
    trading,
    "--line: rgba(111, 154, 172, .085);",
    "--line: rgba(111, 154, 172, .055);",
    "trading line token",
)
trading = replace_checked(
    trading,
    "--line-strong: rgba(111, 170, 190, .16);",
    "--line-strong: rgba(111, 170, 190, .11);",
    "trading strong line",
)
trading = replace_checked(
    trading,
    "box-shadow: 0 18px 55px rgba(0, 0, 0, .18);",
    "box-shadow: 0 14px 40px rgba(0, 0, 0, .10);",
    "trading panel shadow",
)

# Section separators and card outlines.
for old, new, label in [
    ("border-bottom: 1px solid rgba(111, 154, 172, .10);",
     "border-bottom: 1px solid rgba(111, 154, 172, .065);",
     "panel header separators"),

    ("border-bottom: 1px solid rgba(111, 154, 172, .09);",
     "border-bottom: 1px solid rgba(111, 154, 172, .055);",
     "filter separators"),

    ("border-bottom: 1px solid rgba(111, 154, 172, .08);",
     "border-bottom: 1px solid rgba(111, 154, 172, .05);",
     "timeframe separators"),

    ("border: 1px solid rgba(111, 154, 172, .055);",
     "border: 1px solid rgba(111, 154, 172, .035);",
     "native trading row cards"),

    ("border: 1px solid rgba(111, 154, 172, .07);",
     "border: 1px solid rgba(111, 154, 172, .045);",
     "passive buttons"),

    ("border: 1px solid rgba(111, 154, 172, .06);",
     "border: 1px solid rgba(111, 154, 172, .04);",
     "chart legend"),

    ("border-color: rgba(85, 217, 255, .18);",
     "border-color: rgba(85, 217, 255, .14);",
     "selected candidate"),
]:
    trading = replace_checked(trading, old, new, label)

# Write only after every required substitution has validated.
system_path.write_text(system, encoding="utf-8")
tokens_path.write_text(tokens, encoding="utf-8")
trading_path.write_text(trading, encoding="utf-8")

print("CSS-only substitutions validated and written.")
PY

APPLIED=1

git diff --check -- "${FILES[@]}"

# Strong safety check: diff may ONLY contain visual paint properties.
python3 - "${FILES[@]}" <<'PY'
import subprocess
import sys
import re

files = sys.argv[1:]
diff = subprocess.check_output(
    ["git", "diff", "-U0", "--", *files],
    text=True,
)

forbidden = re.compile(
    r"\b("
    r"display|grid-template|grid-column|grid-row|flex(?:-|\s*:)|position|"
    r"width|height|min-width|max-width|min-height|max-height|"
    r"margin|padding|gap|top|right|bottom|left|inset|transform|"
    r"font-size|line-height|overflow|order|place-items|align-items|"
    r"justify-content|border-radius"
    r")\s*:",
    re.I,
)

bad = []
for line in diff.splitlines():
    if not line.startswith(("+", "-")):
        continue
    if line.startswith(("+++", "---")):
        continue
    payload = line[1:]
    if forbidden.search(payload):
        bad.append(line)

if bad:
    print("ERROR: layout/geometry property appeared in CSS diff:", file=sys.stderr)
    print("\n".join(bad[:30]), file=sys.stderr)
    sys.exit(1)

print("Geometry guard passed: no layout/position/size properties changed.")
PY

# Must be exactly 3 CSS files. No HTML, no JS.
CHANGED="$(git diff --name-only -- "${FILES[@]}" | sort)"
EXPECTED="$(printf '%s\n' "${FILES[@]}" | sort)"

if [[ "$CHANGED" != "$EXPECTED" ]]; then
  echo "ERROR: changed file set is not exactly the three CSS files." >&2
  exit 1
fi

# Ensure no unrelated tracked file was touched by this patch.
ALL_CHANGED="$(git diff --name-only | sort)"
EXPECTED_PLUS_EXISTING="$(git diff --name-only -- "${FILES[@]}" | sort)"
# We intentionally allow pre-existing dirty runtime files; only stage our CSS.

echo
echo "CSS-only diff:"
git diff --stat -- "${FILES[@]}"

git add -- "${FILES[@]}"

STAGED="$(git diff --cached --name-only | sort)"
if [[ "$STAGED" != "$EXPECTED" ]]; then
  echo "ERROR: staged set is not exactly the three CSS files." >&2
  exit 1
fi

echo
echo "CSS-only guardrails passed."
echo "Staged files:"
git diff --cached --name-only

git commit \
  -m "Clean visual borders without changing MEMEFLOW layout" \
  -- "${FILES[@]}"

COMMITTED=1

git push origin main

trap - EXIT

echo
echo "DONE — CSS paint cleaned up."
echo "Only system.css, system-tokens.css and trading.css changed."
echo "No HTML, layout, block order, sizing, JS or logic was touched."
