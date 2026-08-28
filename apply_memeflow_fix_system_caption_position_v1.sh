#!/usr/bin/env bash
set -euo pipefail

ROOT="${MEMEFLOW_ROOT:-$(pwd)}"
HTML="$ROOT/memeflow-app/system.html"
CSS="$ROOT/memeflow-app/system.css"

if [[ ! -f "$HTML" || ! -f "$CSS" ]]; then
  echo "ERROR: Run this script from the repository root." >&2
  echo "Expected: memeflow-app/system.html and memeflow-app/system.css" >&2
  exit 1
fi

python3 - "$HTML" "$CSS" <<'PY'
from pathlib import Path
import re
import sys

html_path = Path(sys.argv[1])
css_path = Path(sys.argv[2])

html = html_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")

MARKER = "mf-caption-flow-fix-v1"
CSS_START = "/* ===== MEMEFLOW_CAPTION_FLOW_FIX_V1 ===== */"
CSS_END = "/* ===== /MEMEFLOW_CAPTION_FLOW_FIX_V1 ===== */"

# Add a dedicated class only to this simplified System Overview shell.
old_main = '<main class="system-shell">'
new_main = f'<main class="system-shell {MARKER}">'

if old_main in html:
    html = html.replace(old_main, new_main, 1)
elif new_main not in html:
    raise SystemExit(
        "ERROR: Could not find the System Overview <main> element. No files were changed."
    )

# Remove an older copy of this fix if the patch is re-run.
css = re.sub(
    re.escape(CSS_START) + r".*?" + re.escape(CSS_END) + r"\s*",
    "",
    css,
    flags=re.S,
)

fix = r'''
/* ===== MEMEFLOW_CAPTION_FLOW_FIX_V1 =====
   The lower architecture/legend/telemetry/TOKEN FLOW cards were removed.
   The old <=900px shell grid depended on those extra siblings; without them
   the gallery row stretches and pushes/overlaps the page caption.
   This restores natural document flow without bringing any deleted block back.
*/
.system-shell.mf-caption-flow-fix-v1 {
  display: block !important;
  height: auto !important;
  min-height: 100dvh !important;
  overflow: visible !important;

  grid-template-rows: none !important;
  grid-auto-rows: auto !important;
  align-content: initial !important;
}

.system-shell.mf-caption-flow-fix-v1 > .topbar {
  margin: 0 !important;
}

.system-shell.mf-caption-flow-fix-v1 > .viewport-wrap {
  display: block !important;
  margin: 6px 0 0 !important;
  flex: none !important;
}

.system-shell.mf-caption-flow-fix-v1 > .mfpg-caption {
  position: relative !important;
  inset: auto !important;
  display: block !important;
  width: 100% !important;
  height: auto !important;
  min-height: 0 !important;

  margin: -2px 0 14px !important;
  padding-left: 18px !important;
  padding-right: 18px !important;

  transform: none !important;
  clear: both !important;
  z-index: 12 !important;
}

.system-shell.mf-caption-flow-fix-v1 > .mfpg-caption .mfpg-caption-inner {
  min-height: 74px !important;
}

@media (max-width: 600px) {
  .system-shell.mf-caption-flow-fix-v1 > .viewport-wrap {
    margin-top: 6px !important;
  }

  .system-shell.mf-caption-flow-fix-v1 > .mfpg-caption {
    margin-top: -1px !important;
    margin-bottom: 12px !important;
    padding-left: 14px !important;
    padding-right: 14px !important;
  }

  .system-shell.mf-caption-flow-fix-v1 > .mfpg-caption .mfpg-caption-inner {
    min-height: 68px !important;
  }
}
/* ===== /MEMEFLOW_CAPTION_FLOW_FIX_V1 ===== */
'''

css = css.rstrip() + "\n\n" + fix.strip() + "\n"

# Safety checks: the deleted blocks must stay deleted.
for forbidden in (
    'class="scene-title glass mf-architecture-title-standalone-v3"',
    'class="legend glass mf-legend-standalone-v4"',
    'class="telemetry glass mf-telemetry-standalone-v3"',
    'class="activity-panel glass"',
    "TOKEN FLOW",
    "Recent pipeline state",
    "Live MEMEFLOW pipeline",
):
    if forbidden in html:
        raise SystemExit(
            f"ERROR: Deleted block unexpectedly exists again: {forbidden}. "
            "No files were changed."
        )

if '<section id="mfPageCaption" class="mfpg-caption"' not in html:
    raise SystemExit("ERROR: mfPageCaption was not found. No files were changed.")

html_path.write_text(html, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")

print("OK: Caption flow restored without restoring any deleted blocks.")
PY

echo
echo "--- diff ---"
git diff -- memeflow-app/system.html memeflow-app/system.css

if git diff --quiet -- memeflow-app/system.html memeflow-app/system.css; then
  echo "No changes to commit."
  exit 0
fi

git add memeflow-app/system.html memeflow-app/system.css
git commit -m "Fix System Settings caption position after block removal"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "HEAD" || -z "$BRANCH" ]]; then
  echo "ERROR: Detached HEAD; commit created locally but push was not attempted." >&2
  exit 1
fi

git push origin "$BRANCH"

echo
echo "DONE: Caption layout fixed and pushed to $BRANCH."
