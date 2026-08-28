#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_REALTIME_PAGE_GALLERY_TOP_V5_1"
COMMIT_MESSAGE="Move realtime page gallery directly below header"
DO_PUSH=1

for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=1 ;;
    --no-push) DO_PUSH=0 ;;
    *)
      echo "Usage: $0 [--push|--no-push]" >&2
      exit 2
      ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this inside the MEMEFLOW git repository." >&2
  exit 1
fi

if [[ -d "$ROOT/memeflow-app" ]]; then
  APP="$ROOT/memeflow-app"
elif [[ -f "$ROOT/system.html" ]]; then
  APP="$ROOT"
else
  echo "ERROR: memeflow-app was not found." >&2
  exit 1
fi

HTML="$APP/system.html"
[[ -f "$HTML" ]] || { echo "ERROR: missing $HTML" >&2; exit 1; }

echo
echo "MEMEFLOW Page Gallery TOP V5.1"
echo "Move SYSTEM OVERVIEW / 3D gallery directly under the MEMEFLOW header."
echo "V5.1 fixes the whitespace failure from V5."
echo

grep -Fq 'mf-page-gallery-clean-v2' "$HTML" || {
  echo "ERROR: CLEAN V2 gallery viewport marker is missing." >&2
  exit 1
}
grep -Fq 'page-gallery-chrome-off-v4' "$HTML" || {
  echo "ERROR: CHROME OFF V4 marker is missing." >&2
  exit 1
}
grep -Fq 'REAL-TIME ARCHITECTURE' "$HTML" || {
  echo "ERROR: Real-Time Architecture title not found." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$HTML"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ -n "$BRANCH" ]] || { echo "ERROR: detached HEAD." >&2; exit 1; }

REL_HTML="${HTML#"$ROOT"/}"

if ! git -C "$ROOT" diff --quiet -- "$REL_HTML" || \
   ! git -C "$ROOT" diff --cached --quiet -- "$REL_HTML"; then
  echo "ERROR: $REL_HTML has local/staged edits." >&2
  echo "Commit or stash it first; nothing was changed." >&2
  exit 1
fi

if [[ -n "$(git -C "$ROOT" diff --cached --name-only)" ]]; then
  echo "ERROR: unrelated files are already staged. Unstage them first." >&2
  git -C "$ROOT" diff --cached --name-only >&2
  exit 1
fi

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" fetch origin "$BRANCH"
  LOCAL_HEAD="$(git -C "$ROOT" rev-parse HEAD)"
  REMOTE_HEAD="$(git -C "$ROOT" rev-parse "origin/$BRANCH")"
  if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
    echo "ERROR: local $BRANCH differs from origin/$BRANCH." >&2
    echo "Local : $LOCAL_HEAD" >&2
    echo "Remote: $REMOTE_HEAD" >&2
    echo "Nothing changed." >&2
    exit 1
  fi
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.patch-backups/page-gallery-top-v5_1-$STAMP"
mkdir -p "$BACKUP"
cp -p "$HTML" "$BACKUP/system.html"
echo "Backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-patch system.html..."
    cp -p "$BACKUP/system.html" "$HTML"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

export MF_HTML="$HTML"

python3 <<'PY'
from pathlib import Path
import os
import re

html_path = Path(os.environ["MF_HTML"])
PATCH_ID = "MEMEFLOW_REALTIME_PAGE_GALLERY_TOP_V5_1"

html = html_path.read_text(encoding="utf-8")

if PATCH_ID in html:
    raise SystemExit("ERROR: TOP V5.1 marker already exists")

# Extract the exact existing viewport block. Do NOT re-indent it:
# the V5 failure came from inserting spaces onto blank lines.
viewport_re = re.compile(
    r'\n[ \t]*(<section class="viewport-wrap[^"]*mf-page-gallery-clean-v2[^"]*">.*?</section>)\s*',
    re.S,
)

matches = list(viewport_re.finditer(html))
if len(matches) != 1:
    raise SystemExit(
        f"ERROR: expected exactly one page-gallery viewport, found {len(matches)}"
    )

match = matches[0]
viewport_block = match.group(1)

# Remove it from its old location.
html_without = html[:match.start()] + "\n" + html[match.end():]

# Insert immediately after the top header, before REAL-TIME ARCHITECTURE.
header_close = "</header>"
header_pos = html_without.find(header_close)
if header_pos < 0:
    raise SystemExit("ERROR: topbar </header> not found")

insert_at = header_pos + len(header_close)
insertion = (
    "\n\n"
    f"<!-- {PATCH_ID} -->\n"
    f"{viewport_block}\n"
)

html = html_without[:insert_at] + insertion + html_without[insert_at:]

# Explicitly strip trailing spaces/tabs only. This is the exact bug fix for V5.
lines = html.splitlines()
html = "\n".join(line.rstrip(" \t") for line in lines)
if not html.endswith("\n"):
    html += "\n"

# Structural order validation.
header_idx = html.index("</header>")
marker_idx = html.index(PATCH_ID)
viewport_idx = html.index('class="viewport-wrap')
title_idx = html.index("REAL-TIME ARCHITECTURE")
legend_idx = html.index('aria-label="Decision legend"')
telemetry_idx = html.index('aria-label="Live telemetry"')

if not (
    header_idx
    < marker_idx
    < viewport_idx
    < title_idx
    < legend_idx
    < telemetry_idx
):
    raise SystemExit(
        "ERROR: final order is wrong; expected "
        "HEADER -> SYSTEM OVERVIEW/3D -> REAL-TIME ARCHITECTURE -> LEGEND -> TELEMETRY"
    )

# Important elements must still exist exactly once.
required_once = [
    'id="systemCanvas"',
    'id="memeflowTrue3DHost"',
    'id="labels"',
    'id="inspector"',
    'class="scene-title glass mf-architecture-title-standalone-v3"',
    'class="legend glass mf-legend-standalone-v4"',
    'class="telemetry glass mf-telemetry-standalone-v3"',
]
for needle in required_once:
    count = html.count(needle)
    if count != 1:
        raise SystemExit(f"ERROR: {needle!r} count={count}; expected exactly 1")

# Prove there is no trailing whitespace before writing.
bad = [
    i for i, line in enumerate(html.splitlines(), start=1)
    if line.endswith((" ", "\t"))
]
if bad:
    raise SystemExit(f"ERROR: trailing whitespace remains on lines: {bad[:10]}")

html_path.write_text(html, encoding="utf-8")

print("TOP V5.1 structural validation: PASS")
print("Trailing-whitespace validation: PASS")
print("Final order:")
print("  HEADER")
print("  SYSTEM OVERVIEW / 3D gallery")
print("  REAL-TIME ARCHITECTURE")
print("  decision legend")
print("  telemetry")
PY

git -C "$ROOT" diff --check -- "$REL_HTML"

echo
echo "Diff:"
git -C "$ROOT" diff --stat -- "$REL_HTML"

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" add -- "$REL_HTML"
  git -C "$ROOT" diff --cached --check

  ACTUAL="$(git -C "$ROOT" diff --cached --name-only)"
  if [[ "$ACTUAL" != "$REL_HTML" ]]; then
    echo "ERROR: staged set is not exactly $REL_HTML" >&2
    echo "Actual staged files:" >&2
    printf '%s\n' "$ACTUAL" >&2
    git -C "$ROOT" reset -- "$REL_HTML" >/dev/null 2>&1 || true
    exit 1
  fi

  git -C "$ROOT" commit -m "$COMMIT_MESSAGE"

  git -C "$ROOT" fetch origin "$BRANCH"
  if [[ "$(git -C "$ROOT" rev-parse HEAD^)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]]; then
    echo "ERROR: origin/$BRANCH changed while TOP V5.1 was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: TOP V5.1 committed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: TOP V5.1 installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - SYSTEM OVERVIEW / 3D gallery is directly below the top header"
echo "  - REAL-TIME ARCHITECTURE is below it"
echo "  - swipe/click behavior preserved"
echo "  - telemetry/inspector/trading logic untouched"
echo "Backup: $BACKUP"
