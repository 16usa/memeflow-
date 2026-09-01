#!/usr/bin/env bash
set -e

cd "$(git rev-parse --show-toplevel)"

BASE="replit-live-20260901-131808"
STAMP="$(date +%Y%m%d-%H%M%S)"
BRANCH="global-canvas-header-v1-$STAMP"
BACKUP=".patch-backups/global-canvas-header-v1-$STAMP"

git fetch origin
git switch "$BASE"
git switch -c "$BRANCH"

mkdir -p "$BACKUP"
cp memeflow-app/memeflow-theme.css "$BACKUP/memeflow-theme.css"

for f in system.html trading.html system-tokens.html settings.html smart-vault.html how-it-works.html; do
  cp "memeflow-app/$f" "$BACKUP/$f"
done

python3 - <<'PY'
from pathlib import Path
import re

css_path = Path("memeflow-app/memeflow-theme.css")
text = css_path.read_text()
marker = "/* ===== MEMEFLOW_CANONICAL_PAGE_CANVAS_V1 ===== */"

block = r'''

/* ===== MEMEFLOW_CANONICAL_PAGE_CANVAS_V1 ===== */
:root {
  --mf-canvas-dark-base: #0f141a;
  --mf-canvas-dark-image:
    radial-gradient(circle at 52% -8%, rgba(85,217,255,.055), transparent 31%),
    linear-gradient(180deg, #111820 0%, #0f141a 38%, #0d1217 100%);

  --mf-canvas-light-base: #f4f6f8;
  --mf-canvas-light-image:
    radial-gradient(circle at 52% -8%, rgba(70,150,178,.08), transparent 31%),
    linear-gradient(180deg, #f7f9fb 0%, #f4f6f8 48%, #f1f4f6 100%);
}

html:not([data-theme="light"]),
html:not([data-theme="light"]) body,
html[data-theme="dark"],
html[data-theme="dark"] body {
  background-color: var(--mf-canvas-dark-base) !important;
  background-image: var(--mf-canvas-dark-image) !important;
  background-attachment: fixed !important;
}

html[data-theme="light"],
html[data-theme="light"] body,
html[data-theme="light"] body.mf-settings-standalone,
html[data-theme="light"] body.mf-trading-terminal,
html[data-theme="light"] body.mf-hiw-page,
html[data-theme="light"] body:has(.mf-vault-shell) {
  background-color: var(--mf-canvas-light-base) !important;
  background-image: var(--mf-canvas-light-image) !important;
  background-attachment: fixed !important;
}

html[data-theme="light"] .system-shell,
html[data-theme="light"] .flow-page,
html[data-theme="light"] .mf-settings-page-shell,
html[data-theme="light"] .mf-vault-shell,
html[data-theme="light"] .mf-hiw-shell,
html[data-theme="light"] .shell {
  background-color: transparent !important;
  background-image: none !important;
}

html[data-theme="light"] .mf-site-header:not(.mf-site-header--sticky) {
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

html[data-theme="light"] .mf-site-header.mf-site-header--sticky {
  background-color: var(--mf-canvas-light-base) !important;
  background-image: var(--mf-canvas-light-image) !important;
  background-attachment: fixed !important;
  background-position: 0 0 !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

html:not([data-theme="light"]) .mf-site-header,
html[data-theme="dark"] .mf-site-header {
  background-color: var(--mf-canvas-dark-base) !important;
}

.mf-site-header {
  border-bottom-color: rgba(111,154,172,.055) !important;
}

html[data-theme="light"] .mf-site-header {
  border-bottom-color: rgba(38,59,74,.09) !important;
}
/* ===== /MEMEFLOW_CANONICAL_PAGE_CANVAS_V1 ===== */
'''

if marker not in text:
    css_path.write_text(text.rstrip() + "\n" + block + "\n")

version = "global-canvas-header-v1-20260901"
pages = [
    "memeflow-app/system.html",
    "memeflow-app/trading.html",
    "memeflow-app/system-tokens.html",
    "memeflow-app/settings.html",
    "memeflow-app/smart-vault.html",
    "memeflow-app/how-it-works.html",
]

for filename in pages:
    p = Path(filename)
    s = p.read_text()
    s2 = re.sub(
        r'/memeflow-theme\.css\?v=[^"\']+',
        f'/memeflow-theme.css?v={version}',
        s,
    )
    if s2 == s:
        raise SystemExit(f"Theme stylesheet link not found in {filename}")
    p.write_text(s2)
PY

git diff --check

git add \
  memeflow-app/memeflow-theme.css \
  memeflow-app/system.html \
  memeflow-app/trading.html \
  memeflow-app/system-tokens.html \
  memeflow-app/settings.html \
  memeflow-app/smart-vault.html \
  memeflow-app/how-it-works.html \
  "$BACKUP"

git commit -m "Unify MEMEFLOW global page background and header canvas"
git push -u origin "$BRANCH"

echo
echo "PATCH COMPLETE"
echo "BRANCH: $BRANCH"
echo "BACKUP: $BACKUP"
