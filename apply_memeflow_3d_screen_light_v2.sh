#!/usr/bin/env bash
set -euo pipefail

EXPECTED_HEAD="dd381042acc3e6b08926ec3594e8479397138e9e"
EXPECTED_CSS_BLOB="dd0d81d6c2710133ae8436c8639c9234ff6bfcba"
EXPECTED_HTML_BLOB="456cee129e19e76a9a2d14f667cc12680938e39f"

REPO="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$REPO" ]]; then
  echo "ERROR: Run this inside the MEMEFLOW git repository." >&2
  exit 1
fi
cd "$REPO"

CSS="memeflow-app/memeflow-flow-v4.css"
HTML="memeflow-app/system.html"

for f in "$CSS" "$HTML"; do
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
  echo "ERROR: GitHub main changed since this patch was audited." >&2
  echo "Expected: $EXPECTED_HEAD" >&2
  echo "Current : $REMOTE_HEAD" >&2
  echo "Nothing changed." >&2
  exit 1
fi

# Unrelated dirty/staged files are allowed.
for f in "$CSS" "$HTML"; do
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
done

ACTUAL_CSS_BLOB="$(git hash-object "$CSS")"
ACTUAL_HTML_BLOB="$(git hash-object "$HTML")"

[[ "$ACTUAL_CSS_BLOB" == "$EXPECTED_CSS_BLOB" ]] || {
  echo "ERROR: $CSS differs from audited GitHub CSS." >&2
  exit 1
}
[[ "$ACTUAL_HTML_BLOB" == "$EXPECTED_HTML_BLOB" ]] || {
  echo "ERROR: $HTML differs from audited GitHub HTML." >&2
  exit 1
}

echo "Exact audited target verification passed."
echo "Unrelated runtime/backup changes are allowed and will remain untouched."

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-3d-screen-light-v2-$STAMP"
mkdir -p "$BACKUP"
cp "$CSS" "$BACKUP/memeflow-flow-v4.css"
cp "$HTML" "$BACKUP/system.html"
echo "Backup: $BACKUP"

APPLIED=0
COMMITTED=0

restore_targets() {
  git reset -- "$CSS" "$HTML" >/dev/null 2>&1 || true
  cp "$BACKUP/memeflow-flow-v4.css" "$CSS"
  cp "$BACKUP/system.html" "$HTML"
}

on_exit() {
  rc=$?
  if [[ "$rc" -ne 0 && "$APPLIED" -eq 1 && "$COMMITTED" -eq 0 ]]; then
    echo
    echo "Validation failed — restoring ONLY the two target files..."
    restore_targets
    echo "Targets restored. Unrelated local files were not touched."
  fi
  exit "$rc"
}
trap on_exit EXIT

python3 - "$CSS" "$BACKUP/css-non-background.json" <<'PY'
from pathlib import Path
import json, re, sys
p = Path(sys.argv[1])
out = Path(sys.argv[2])
css = p.read_text(encoding="utf-8")
rx = re.compile(r"(?m)([-\w]+)\s*:\s*([^;{}]+);")
items = []
for m in rx.finditer(css):
    prop = m.group(1).lower().strip()
    val = " ".join(m.group(2).split())
    if prop not in {"background", "background-color", "background-image"}:
        items.append((prop, val))
out.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
PY

python3 - "$CSS" "$HTML" <<'PY'
from pathlib import Path
import sys

css_path = Path(sys.argv[1])
html_path = Path(sys.argv[2])

css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

old_viewport = """  background:
    radial-gradient(ellipse at 50% 52%, rgba(34,120,144,.05), transparent 30%),
    linear-gradient(180deg,#04090d 0%,#03070a 100%) !important;"""

new_viewport = """  background:
    radial-gradient(ellipse at 50% 50%, rgba(83,196,230,.18), transparent 34%),
    radial-gradient(ellipse at 50% 43%, rgba(40,105,136,.28), transparent 64%),
    linear-gradient(180deg,#122a38 0%,#0f2230 48%,#0c1a24 100%) !important;"""

old_flow = """  background:
    radial-gradient(
      ellipse at 52% 52%,
      rgba(31,89,104,.030),
      transparent 37%
    ) !important;"""

new_flow = """  background:
    radial-gradient(
      ellipse at 52% 50%,
      rgba(91,205,236,.095),
      transparent 40%
    ),
    radial-gradient(
      ellipse at 50% 50%,
      rgba(35,96,124,.075),
      transparent 72%
    ) !important;"""

old_href = 'href="/memeflow-flow-v4.css?v=4.5-pro-truth"'
new_href = 'href="/memeflow-flow-v4.css?v=4.5-pro-truth-light-v2"'

for text, old, label in [
    (css, old_viewport, "viewport background"),
    (css, old_flow, "V4.5 flow atmosphere"),
    (html, old_href, "flow stylesheet href"),
]:
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"ERROR [{label}]: expected exactly 1 match, found {n}")

css = css.replace(old_viewport, new_viewport, 1)
css = css.replace(old_flow, new_flow, 1)
html = html.replace(old_href, new_href, 1)

if "#122a38" not in css or "rgba(83,196,230,.18)" not in css:
    raise SystemExit("ERROR: illuminated 3D background values are missing.")
if "4.5-pro-truth-light-v2" not in html:
    raise SystemExit("ERROR: cache-busting stylesheet version is missing.")

css_path.write_text(css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")
print("Existing 3D backgrounds edited in place.")
print("Existing CSS link cache version updated.")
PY

APPLIED=1

git diff --check -- "$CSS" "$HTML"

python3 - "$CSS" "$BACKUP/css-non-background.json" <<'PY'
from pathlib import Path
import json, re, sys
p = Path(sys.argv[1])
before_path = Path(sys.argv[2])
css = p.read_text(encoding="utf-8")
before = [tuple(x) for x in json.loads(before_path.read_text(encoding="utf-8"))]
rx = re.compile(r"(?m)([-\w]+)\s*:\s*([^;{}]+);")
after = []
for m in rx.finditer(css):
    prop = m.group(1).lower().strip()
    val = " ".join(m.group(2).split())
    if prop not in {"background", "background-color", "background-image"}:
        after.append((prop, val))
if before != after:
    print("ERROR: a non-background CSS declaration changed.", file=sys.stderr)
    sys.exit(1)
print("CSS safety guard passed: only background paint changed.")
PY

B_OPEN="$(tr -cd '{' < "$BACKUP/memeflow-flow-v4.css" | wc -c | tr -d ' ')"
A_OPEN="$(tr -cd '{' < "$CSS" | wc -c | tr -d ' ')"
B_CLOSE="$(tr -cd '}' < "$BACKUP/memeflow-flow-v4.css" | wc -c | tr -d ' ')"
A_CLOSE="$(tr -cd '}' < "$CSS" | wc -c | tr -d ' ')"

if [[ "$B_OPEN" != "$A_OPEN" || "$B_CLOSE" != "$A_CLOSE" ]]; then
  echo "ERROR: CSS rule structure changed." >&2
  exit 1
fi
echo "CSS layer guard passed: no selector/rule layer was added."

python3 - "$BACKUP/system.html" "$HTML" <<'PY'
from pathlib import Path
import sys
before = Path(sys.argv[1]).read_text(encoding="utf-8")
after = Path(sys.argv[2]).read_text(encoding="utf-8")
old = 'href="/memeflow-flow-v4.css?v=4.5-pro-truth"'
new = 'href="/memeflow-flow-v4.css?v=4.5-pro-truth-light-v2"'
if before.replace(old, new, 1) != after:
    raise SystemExit("ERROR: system.html changed beyond the CSS cache version.")
print("HTML safety guard passed: only stylesheet cache version changed.")
PY

TARGET_CHANGED="$(git diff --name-only -- "$CSS" "$HTML" | sort)"
EXPECTED_TARGETS="$(printf '%s\n' "$CSS" "$HTML" | sort)"

if [[ "$TARGET_CHANGED" != "$EXPECTED_TARGETS" ]]; then
  echo "ERROR: target diff does not contain exactly CSS + cache-bust HTML." >&2
  printf 'Target diff:\n%s\n' "$TARGET_CHANGED" >&2
  exit 1
fi

echo
echo "Target-only diff:"
git diff --stat -- "$CSS" "$HTML"

# Commit ONLY our two paths. Any unrelated staged or unstaged files remain untouched.
git add -- "$CSS" "$HTML"
git commit --only \
  -m "Illuminate MEMEFLOW pipeline screen and refresh stylesheet cache" \
  -- "$CSS" "$HTML"

COMMITTED=1

git push origin main

trap - EXIT

echo
echo "DONE — illuminated blue-graphite 3D screen installed."
echo "Changed only:"
echo "  $CSS"
echo "  $HTML (stylesheet cache query only)"
echo "Unrelated runtime/backup files were left untouched."
echo "No new CSS layer, selector, JS, layout or 3D logic was added."
