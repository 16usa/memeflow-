#!/usr/bin/env bash
set -e
cd "$(git rev-parse --show-toplevel)"

echo "=== MEMEFLOW GLOBAL CANVAS REPAIR V2 ==="
echo "Current branch: $(git branch --show-current)"

python3 - <<'PY'
from pathlib import Path
import re

css = Path("memeflow-app/memeflow-theme.css")
text = css.read_text()

marker = "/* ===== MEMEFLOW_CANONICAL_PAGE_CANVAS_V1 ===== */"

block = r'''

/* ===== MEMEFLOW_CANONICAL_PAGE_CANVAS_V1 ===== */
:root {
  --mf-canvas-dark-base:#0f141a;
  --mf-canvas-dark-image:
    radial-gradient(circle at 52% -8%,rgba(85,217,255,.055),transparent 31%),
    linear-gradient(180deg,#111820 0%,#0f141a 38%,#0d1217 100%);
  --mf-canvas-light-base:#f4f6f8;
  --mf-canvas-light-image:
    radial-gradient(circle at 52% -8%,rgba(70,150,178,.08),transparent 31%),
    linear-gradient(180deg,#f7f9fb 0%,#f4f6f8 48%,#f1f4f6 100%);
}

html:not([data-theme="light"]),
html:not([data-theme="light"]) body,
html[data-theme="dark"],
html[data-theme="dark"] body{
  background-color:var(--mf-canvas-dark-base)!important;
  background-image:var(--mf-canvas-dark-image)!important;
  background-attachment:fixed!important;
}

html[data-theme="light"],
html[data-theme="light"] body,
html[data-theme="light"] body.mf-settings-standalone,
html[data-theme="light"] body.mf-trading-terminal,
html[data-theme="light"] body.mf-hiw-page,
html[data-theme="light"] body:has(.mf-vault-shell){
  background-color:var(--mf-canvas-light-base)!important;
  background-image:var(--mf-canvas-light-image)!important;
  background-attachment:fixed!important;
}

html[data-theme="light"] .system-shell,
html[data-theme="light"] .flow-page,
html[data-theme="light"] .mf-settings-page-shell,
html[data-theme="light"] .mf-vault-shell,
html[data-theme="light"] .mf-hiw-shell,
html[data-theme="light"] .shell{
  background:transparent!important;
}

html[data-theme="light"] .mf-site-header:not(.mf-site-header--sticky){
  background:transparent!important;
  box-shadow:none!important;
}

html[data-theme="light"] .mf-site-header.mf-site-header--sticky{
  background-color:var(--mf-canvas-light-base)!important;
  background-image:var(--mf-canvas-light-image)!important;
  background-attachment:fixed!important;
  background-position:0 0!important;
  box-shadow:none!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}

html:not([data-theme="light"]) .mf-site-header,
html[data-theme="dark"] .mf-site-header{
  background-color:var(--mf-canvas-dark-base)!important;
}

.mf-site-header{
  border-bottom-color:rgba(111,154,172,.055)!important;
}
html[data-theme="light"] .mf-site-header{
  border-bottom-color:rgba(38,59,74,.09)!important;
}
/* ===== /MEMEFLOW_CANONICAL_PAGE_CANVAS_V1 ===== */
'''

if marker not in text:
    css.write_text(text.rstrip() + "\n" + block + "\n")
    print("CSS layer added")
else:
    print("CSS layer already present")

pages = [
    "system.html",
    "trading.html",
    "system-tokens.html",
    "settings.html",
    "smart-vault.html",
    "how-it-works.html",
]

for name in pages:
    p = Path("memeflow-app") / name
    s = p.read_text()
    # Robust cache-bust: supports either quote style and any existing query.
    s2, n = re.subn(
        r'(/memeflow-theme\.css)(?:\?v=[^"\'>\s]+)?',
        r'\1?v=global-canvas-header-v1-20260901',
        s,
        count=1,
    )
    if n == 0:
        raise SystemExit(f"ERROR: theme CSS link missing in {p}")
    p.write_text(s2)
    print("OK:", name)
PY

git diff --check

git add memeflow-app/memeflow-theme.css \
  memeflow-app/system.html \
  memeflow-app/trading.html \
  memeflow-app/system-tokens.html \
  memeflow-app/settings.html \
  memeflow-app/smart-vault.html \
  memeflow-app/how-it-works.html \
  .patch-backups/global-canvas-header-v1-* 2>/dev/null || true

git commit -m "Unify MEMEFLOW global page background and header canvas" || true
git push -u origin "$(git branch --show-current)"

echo
echo "PATCH COMPLETE"
echo "BRANCH: $(git branch --show-current)"
