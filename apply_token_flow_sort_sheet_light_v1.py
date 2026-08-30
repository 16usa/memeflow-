#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"

THEME = APP / "memeflow-theme.css"
HTML = APP / "system-tokens.html"

MARKER = "/* ===== MEMEFLOW_TOKEN_FLOW_SORT_SHEET_LIGHT_V1 ===== */"
CSS = '/* ===== MEMEFLOW_TOKEN_FLOW_SORT_SHEET_LIGHT_V1 ===== */\n/*\n  Real-Time Pipeline / Token Flow\n  SORT · SMART bottom sheet — Light theme only.\n  Geometry, behavior, scrolling, sort logic and Dark theme are untouched.\n*/\n\nhtml[data-theme="light"] .mf-sort-overlay-v25 {\n  background: rgba(224, 233, 238, .22) !important;\n  backdrop-filter: none !important;\n  -webkit-backdrop-filter: none !important;\n}\n\nhtml[data-theme="light"] .mf-sort-sheet-v25 {\n  background:\n    linear-gradient(\n      180deg,\n      rgba(255,255,255,.985),\n      rgba(244,249,251,.992)\n    ) !important;\n\n  border-color: rgba(55,79,94,.14) !important;\n  color: #172733 !important;\n\n  box-shadow:\n    0 -10px 30px rgba(27,42,53,.10) !important;\n}\n\nhtml[data-theme="light"] .mf-sort-handle-v25 {\n  background: rgba(91,113,126,.28) !important;\n}\n\nhtml[data-theme="light"] .mf-sort-sheet-head-v25 h2 {\n  color: #172733 !important;\n}\n\nhtml[data-theme="light"] .mf-sort-back-v25 {\n  background: transparent !important;\n  color: #71858f !important;\n}\n\nhtml[data-theme="light"] .mf-sort-direction-v25 {\n  background:\n    linear-gradient(\n      180deg,\n      #f3f7f9,\n      #edf3f6\n    ) !important;\n\n  border-color: rgba(55,79,94,.12) !important;\n}\n\nhtml[data-theme="light"] .mf-sort-direction-v25 button {\n  background: transparent !important;\n  border-color: transparent !important;\n  color: #71858f !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] .mf-sort-direction-v25 button.is-active {\n  background: #ffffff !important;\n  border-color: rgba(85,217,255,.66) !important;\n  color: #25404c !important;\n\n  box-shadow:\n    0 1px 4px rgba(27,42,53,.05) !important;\n}\n\nhtml[data-theme="light"] .mf-sort-list-shell-v252 {\n  background:\n    linear-gradient(\n      180deg,\n      rgba(255,255,255,.98),\n      rgba(247,250,252,.99)\n    ) !important;\n\n  border-color: rgba(55,79,94,.12) !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] .mf-sort-row-v25 {\n  background: transparent !important;\n  color: #263943 !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] .mf-sort-row-v25 + .mf-sort-row-v25::before {\n  background: rgba(55,79,94,.09) !important;\n}\n\nhtml[data-theme="light"] .mf-sort-row-v25:active {\n  background: rgba(85,217,255,.055) !important;\n}\n\nhtml[data-theme="light"] .mf-sort-option-label-v251 {\n  color: #263943 !important;\n}\n\nhtml[data-theme="light"] .mf-sort-option-icon-v251 {\n  color: #71858f !important;\n}\n\nhtml[data-theme="light"] .mf-sort-row-chevron-v251 {\n  color: #71858f !important;\n}\n\nhtml[data-theme="light"] .mf-sort-radio-v25 {\n  border-color: #8da1ab !important;\n  background: transparent !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] .mf-sort-radio-v25.is-active {\n  border-color: #55d9ff !important;\n\n  background:\n    radial-gradient(\n      circle at center,\n      #55d9ff 0 2.1px,\n      transparent 2.45px\n    ) !important;\n\n  box-shadow: none !important;\n}\n\n/* Keep age drill-in on the same Light surface. */\nhtml[data-theme="light"] .mf-age-list-v25 {\n  background: transparent !important;\n  color: #263943 !important;\n}\n/* ===== /MEMEFLOW_TOKEN_FLOW_SORT_SHEET_LIGHT_V1 ===== */\n'

def die(msg):
    print(f"[TOKEN FLOW SORT SHEET LIGHT V1] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

for path in (THEME, HTML):
    if not path.exists():
        die(f"missing {path}")

theme_before = THEME.read_text(encoding="utf-8")
html_before = HTML.read_text(encoding="utf-8")

if MARKER in theme_before:
    print("[TOKEN FLOW SORT SHEET LIGHT V1] already installed")
    raise SystemExit(0)

# Safety check: Token Flow page must still be the expected page.
if "system-tokens" not in HTML.name:
    die("unexpected target page")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".token-flow-sort-sheet-light-v1-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

shutil.copy2(THEME, backup / THEME.name)
shutil.copy2(HTML, backup / HTML.name)

# Final Light-only layer; no existing styles are deleted.
THEME.write_text(
    theme_before.rstrip() + "\n\n" + CSS,
    encoding="utf-8"
)

# Cache-bust shared theme on Token Flow only.
html_after, count = re.subn(
    r'/memeflow-theme\.css\?v=[^"\']+',
    '/memeflow-theme.css?v=token-flow-sort-sheet-light-v1-20260830',
    html_before,
    count=1
)

if count == 0:
    head_close = html_before.lower().find("</head>")
    if head_close < 0:
        die("cannot find </head> in system-tokens.html")

    link = '\n<link rel="stylesheet" href="/memeflow-theme.css?v=token-flow-sort-sheet-light-v1-20260830">\n'
    html_after = html_before[:head_close] + link + html_before[head_close:]

HTML.write_text(html_after, encoding="utf-8")

rollback = ROOT / "rollback_token_flow_sort_sheet_light_v1.py"
rollback.write_text(
    """#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / %r

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in ("memeflow-theme.css", "system-tokens.html"):
    src = BACKUP / name
    dst = APP / name

    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))

    shutil.copy2(src, dst)

print("[TOKEN FLOW SORT SHEET LIGHT V1] ROLLED BACK")
print("[TOKEN FLOW SORT SHEET LIGHT V1] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[TOKEN FLOW SORT SHEET LIGHT V1] INSTALLED")
print("[TOKEN FLOW SORT SHEET LIGHT V1] scope: SORT · SMART sheet only")
print("[TOKEN FLOW SORT SHEET LIGHT V1] Light theme only")
print("[TOKEN FLOW SORT SHEET LIGHT V1] geometry / behavior / sorting logic untouched")
print("[TOKEN FLOW SORT SHEET LIGHT V1] Dark theme untouched")
print("[TOKEN FLOW SORT SHEET LIGHT V1] backup:", backup)
print("[TOKEN FLOW SORT SHEET LIGHT V1] rollback: python3 rollback_token_flow_sort_sheet_light_v1.py")
