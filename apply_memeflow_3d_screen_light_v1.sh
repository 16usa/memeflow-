#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW 3D SCREEN LIGHT V1
# ------------------------------------------------------------
# Goal:
#   Make the MEMEFLOW pipeline/3D screen visibly blue-graphite and illuminated
#   instead of black, matching the approved preview.
#
# IMPORTANT:
#   - edits ONLY memeflow-app/memeflow-flow-v4.css
#   - edits EXISTING background declarations in place
#   - adds NO CSS block, selector, stylesheet, HTML, JS or override layer
#   - changes NO layout, size, spacing, canvas logic or telemetry logic
#   - 3D/flow JS remains untouched
#
# Audited against:
#   main = dd381042acc3e6b08926ec3594e8479397138e9e
#   memeflow-flow-v4.css blob = dd0d81d6c2710133ae8436c8639c9234ff6bfcba
# ------------------------------------------------------------

EXPECTED_HEAD="dd381042acc3e6b08926ec3594e8479397138e9e"
EXPECTED_BLOB="dd0d81d6c2710133ae8436c8639c9234ff6bfcba"

REPO="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$REPO" ]]; then
  echo "ERROR: Run this inside the MEMEFLOW git repository." >&2
  exit 1
fi

cd "$REPO"

FILE="memeflow-app/memeflow-flow-v4.css"

[[ -f "$FILE" ]] || {
  echo "ERROR: Missing $FILE" >&2
  exit 1
}

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
  echo "ERROR: GitHub main changed since this patch was audited." >&2
  echo "Expected: $EXPECTED_HEAD" >&2
  echo "Current : $REMOTE_HEAD" >&2
  echo "Nothing changed. Rebuild the patch against current main." >&2
  exit 1
fi

if ! git diff --quiet -- "$FILE"; then
  echo "ERROR: $FILE already has local edits." >&2
  git status --short -- "$FILE"
  exit 1
fi

if ! git diff --cached --quiet -- "$FILE"; then
  echo "ERROR: $FILE is already staged." >&2
  git status --short -- "$FILE"
  exit 1
fi

if [[ -n "$(git diff --cached --name-only || true)" ]]; then
  echo "ERROR: unrelated files are staged. Unstage them first." >&2
  exit 1
fi

ACTUAL_BLOB="$(git hash-object "$FILE")"
if [[ "$ACTUAL_BLOB" != "$EXPECTED_BLOB" ]]; then
  echo "ERROR: $FILE differs from the audited GitHub file." >&2
  echo "Expected blob: $EXPECTED_BLOB" >&2
  echo "Actual blob  : $ACTUAL_BLOB" >&2
  echo "Nothing changed." >&2
  exit 1
fi

echo "Exact audited 3D stylesheet verification passed."

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-3d-screen-light-v1-$STAMP"
mkdir -p "$BACKUP"
cp "$FILE" "$BACKUP/memeflow-flow-v4.css"
echo "Backup: $BACKUP"

APPLIED=0
COMMITTED=0

restore_on_error() {
  rc=$?
  if [[ "$rc" -ne 0 && "$APPLIED" -eq 1 && "$COMMITTED" -eq 0 ]]; then
    git reset -- "$FILE" >/dev/null 2>&1 || true
    cp "$BACKUP/memeflow-flow-v4.css" "$FILE"
    echo "Validation failed — original 3D stylesheet restored."
    echo "Nothing from this patch remains."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

# Snapshot every NON-background declaration.
# After editing, all of these must remain exactly identical.
python3 - "$FILE" "$BACKUP/non-background-before.json" <<'PY'
from pathlib import Path
import json, re, sys

path = Path(sys.argv[1])
out = Path(sys.argv[2])
text = path.read_text(encoding="utf-8")

rx = re.compile(r"(?m)([-\w]+)\s*:\s*([^;{}]+);")
items = []
for m in rx.finditer(text):
    prop = m.group(1).strip().lower()
    value = " ".join(m.group(2).split())
    if prop not in {"background", "background-color", "background-image"}:
        items.append((prop, value))

out.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
print("Non-background CSS snapshot captured.")
PY

python3 - "$FILE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
css = path.read_text(encoding="utf-8")

# Existing viewport background. This is the actual visible base behind the
# transparent flow canvas. We replace it in place — no new selector.
old_viewport = """  background:
    radial-gradient(ellipse at 50% 52%, rgba(34,120,144,.05), transparent 30%),
    linear-gradient(180deg,#04090d 0%,#03070a 100%) !important;"""

new_viewport = """  background:
    radial-gradient(ellipse at 50% 50%, rgba(77,190,225,.15), transparent 34%),
    radial-gradient(ellipse at 50% 44%, rgba(32,91,119,.26), transparent 62%),
    linear-gradient(180deg,#10232f 0%,#0d1c26 48%,#0a161f 100%) !important;"""

# Existing final V4.5 atmosphere. This rule already overrides the earlier
# .mf-flow-v4 background, so editing it avoids creating any extra layer.
old_flow = """  background:
    radial-gradient(
      ellipse at 52% 52%,
      rgba(31,89,104,.030),
      transparent 37%
    ) !important;"""

new_flow = """  background:
    radial-gradient(
      ellipse at 52% 52%,
      rgba(76,177,211,.075),
      transparent 39%
    ),
    radial-gradient(
      ellipse at 50% 50%,
      rgba(28,83,108,.060),
      transparent 70%
    ) !important;"""

if css.count(old_viewport) != 1:
    raise SystemExit(
        f"ERROR: audited viewport background matched {css.count(old_viewport)} times; expected 1."
    )

if css.count(old_flow) != 1:
    raise SystemExit(
        f"ERROR: audited V4.5 flow background matched {css.count(old_flow)} times; expected 1."
    )

css = css.replace(old_viewport, new_viewport, 1)
css = css.replace(old_flow, new_flow, 1)

# Verify the old black base is no longer the active flow stylesheet value.
if old_viewport in css or old_flow in css:
    raise SystemExit("ERROR: old 3D background still present after replacement.")

if "#10232f" not in css or "rgba(77,190,225,.15)" not in css:
    raise SystemExit("ERROR: illuminated viewport palette missing after replacement.")

path.write_text(css, encoding="utf-8")
print("Existing 3D screen backgrounds edited in place.")
PY

APPLIED=1

git diff --check -- "$FILE"

# Verify every non-background CSS declaration stayed identical.
python3 - "$FILE" "$BACKUP/non-background-before.json" <<'PY'
from pathlib import Path
import json, re, sys

path = Path(sys.argv[1])
before_path = Path(sys.argv[2])

css = path.read_text(encoding="utf-8")
before = [tuple(x) for x in json.loads(before_path.read_text(encoding="utf-8"))]

rx = re.compile(r"(?m)([-\w]+)\s*:\s*([^;{}]+);")
after = []
for m in rx.finditer(css):
    prop = m.group(1).strip().lower()
    value = " ".join(m.group(2).split())
    if prop not in {"background", "background-color", "background-image"}:
        after.append((prop, value))

if after != before:
    print("ERROR: a non-background CSS declaration changed.", file=sys.stderr)
    for i in range(min(len(before), len(after))):
        if before[i] != after[i]:
            print(f"First difference #{i}", file=sys.stderr)
            print(f"BEFORE: {before[i]}", file=sys.stderr)
            print(f"AFTER : {after[i]}", file=sys.stderr)
            break
    if len(before) != len(after):
        print(f"Counts: before={len(before)}, after={len(after)}", file=sys.stderr)
    sys.exit(1)

print("Style-safety guard passed: only background paint changed.")
PY

# No rule/selector layer may have been added.
BEFORE_OPEN="$(tr -cd '{' < "$BACKUP/memeflow-flow-v4.css" | wc -c | tr -d ' ')"
AFTER_OPEN="$(tr -cd '{' < "$FILE" | wc -c | tr -d ' ')"
BEFORE_CLOSE="$(tr -cd '}' < "$BACKUP/memeflow-flow-v4.css" | wc -c | tr -d ' ')"
AFTER_CLOSE="$(tr -cd '}' < "$FILE" | wc -c | tr -d ' ')"

if [[ "$BEFORE_OPEN" != "$AFTER_OPEN" || "$BEFORE_CLOSE" != "$AFTER_CLOSE" ]]; then
  echo "ERROR: CSS rule structure changed; refusing to commit." >&2
  exit 1
fi

echo "CSS-layer guard passed: no selector/rule layer was added."

# Exactly one source stylesheet is allowed to change.
CHANGED="$(git diff --name-only)"
if [[ "$CHANGED" != "$FILE" ]]; then
  echo "ERROR: unexpected tracked files changed:" >&2
  printf '%s\n' "$CHANGED" >&2
  exit 1
fi

echo
echo "3D screen diff:"
git diff --stat -- "$FILE"

git add -- "$FILE"

STAGED="$(git diff --cached --name-only)"
if [[ "$STAGED" != "$FILE" ]]; then
  echo "ERROR: staged file set is not exactly $FILE." >&2
  exit 1
fi

echo
echo "Final 3D-light guardrails passed."
echo "Staged file only:"
git diff --cached --name-only

git commit \
  -m "Lighten MEMEFLOW pipeline screen without style overrides" \
  -- "$FILE"

COMMITTED=1
git push origin main

trap - EXIT

echo
echo "DONE — MEMEFLOW pipeline screen is now illuminated blue-graphite."
echo "Only memeflow-flow-v4.css changed."
echo "No HTML, JS, layout, 3D logic, extra selector or CSS override layer was added."
