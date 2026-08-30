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

MARKER = "/* ===== MEMEFLOW_TOKEN_FLOW_SORT_SHEET_PREMIUM_LIGHT_V1 ===== */"
CSS = '/* ===== MEMEFLOW_TOKEN_FLOW_SORT_SHEET_PREMIUM_LIGHT_V1 ===== */\n/*\n  Token Flow · SORT BY bottom sheet · Light theme only.\n  Goal: same canvas tone as page, cleaner iOS-like sheet.\n  Layout / sizing / behavior / sorting logic untouched.\n*/\n\nhtml[data-theme="light"] .mf-sort-overlay-v25 {\n  background: rgba(226, 235, 239, .12) !important;\n  backdrop-filter: none !important;\n  -webkit-backdrop-filter: none !important;\n}\n\nhtml[data-theme="light"] .mf-sort-sheet-v25 {\n  background: #eef4f7 !important;\n  border: 1px solid rgba(70, 92, 105, .13) !important;\n  color: #172733 !important;\n\n  box-shadow:\n    0 -8px 26px rgba(33, 49, 60, .075) !important;\n}\n\nhtml[data-theme="light"] .mf-sort-handle-v25 {\n  width: 34px !important;\n  height: 4px !important;\n  background: rgba(78, 98, 110, .28) !important;\n  border-radius: 999px !important;\n}\n\nhtml[data-theme="light"] .mf-sort-sheet-head-v25 {\n  border-bottom-color: rgba(70, 92, 105, .08) !important;\n}\n\nhtml[data-theme="light"] .mf-sort-sheet-head-v25 h2 {\n  color: #172733 !important;\n  letter-spacing: -.015em !important;\n}\n\nhtml[data-theme="light"] .mf-sort-back-v25 {\n  color: #738791 !important;\n  background: transparent !important;\n}\n\n/* Segmented HIGH → LOW / LOW → HIGH */\nhtml[data-theme="light"] .mf-sort-direction-v25 {\n  background: rgba(224, 233, 237, .56) !important;\n  border: 1px solid rgba(70, 92, 105, .10) !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] .mf-sort-direction-v25 button {\n  background: transparent !important;\n  border: 1px solid transparent !important;\n  color: #768a94 !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] .mf-sort-direction-v25 button.is-active {\n  background: rgba(255,255,255,.52) !important;\n  border-color: rgba(85, 217, 255, .72) !important;\n  color: #203946 !important;\n  box-shadow: none !important;\n}\n\n/* One continuous list surface */\nhtml[data-theme="light"] .mf-sort-list-shell-v252 {\n  background: transparent !important;\n  border: 1px solid rgba(70, 92, 105, .11) !important;\n  box-shadow: none !important;\n  overflow: hidden !important;\n}\n\nhtml[data-theme="light"] .mf-sort-row-v25 {\n  background: transparent !important;\n  color: #263943 !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] .mf-sort-row-v25 + .mf-sort-row-v25::before {\n  background: rgba(70, 92, 105, .085) !important;\n}\n\nhtml[data-theme="light"] .mf-sort-row-v25:active {\n  background: rgba(85, 217, 255, .045) !important;\n}\n\nhtml[data-theme="light"] .mf-sort-option-label-v251 {\n  color: #263943 !important;\n}\n\nhtml[data-theme="light"] .mf-sort-option-icon-v251,\nhtml[data-theme="light"] .mf-sort-row-chevron-v251 {\n  color: #738791 !important;\n}\n\n/* Radio control */\nhtml[data-theme="light"] .mf-sort-radio-v25 {\n  background: transparent !important;\n  border-color: #8da0aa !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] .mf-sort-radio-v25.is-active {\n  border-color: #55d9ff !important;\n  background:\n    radial-gradient(circle at center,\n      #55d9ff 0 3px,\n      transparent 3.5px\n    ) !important;\n  box-shadow: none !important;\n}\n\n/* Age drill-down inherits same visual language */\nhtml[data-theme="light"] .mf-age-list-v25 {\n  background: transparent !important;\n  color: #263943 !important;\n}\n\nhtml[data-theme="light"] .mf-age-list-v25 .mf-sort-row-v25 {\n  background: transparent !important;\n}\n/* ===== /MEMEFLOW_TOKEN_FLOW_SORT_SHEET_PREMIUM_LIGHT_V1 ===== */\n'

def die(msg):
    print(f"[TOKEN FLOW SORT SHEET PREMIUM LIGHT V1] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

for path in (THEME, HTML):
    if not path.exists():
        die(f"missing {path}")

theme_before = THEME.read_text(encoding="utf-8")
html_before = HTML.read_text(encoding="utf-8")

if MARKER in theme_before:
    print("[TOKEN FLOW SORT SHEET PREMIUM LIGHT V1] already installed")
    raise SystemExit(0)

# Confirm the current Token Flow sort-sheet implementation exists.
required = (
    ".mf-sort-sheet-v25",
    ".mf-sort-direction-v25",
    ".mf-sort-list-shell-v252",
    ".mf-sort-row-v25",
    ".mf-sort-radio-v25",
)
for selector in required:
    if selector not in theme_before:
        die("expected sort selector not found: " + selector)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".token-flow-sort-sheet-premium-light-v1-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

shutil.copy2(THEME, backup / THEME.name)
shutil.copy2(HTML, backup / HTML.name)

# Final Light-only presentation layer.
THEME.write_text(
    theme_before.rstrip() + "\n\n" + CSS,
    encoding="utf-8"
)

# Cache-bust only the Token Flow page.
html_after, count = re.subn(
    r'/memeflow-theme\.css\?v=[^"\']+',
    '/memeflow-theme.css?v=token-flow-sort-sheet-premium-light-v1-20260830',
    html_before,
    count=1
)

if count == 0:
    head_close = html_before.lower().find("</head>")
    if head_close < 0:
        die("cannot find </head> in system-tokens.html")
    link = '\n<link rel="stylesheet" href="/memeflow-theme.css?v=token-flow-sort-sheet-premium-light-v1-20260830">\n'
    html_after = html_before[:head_close] + link + html_before[head_close:]

HTML.write_text(html_after, encoding="utf-8")

rollback = ROOT / "rollback_token_flow_sort_sheet_premium_light_v1.py"
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

print("[TOKEN FLOW SORT SHEET PREMIUM LIGHT V1] ROLLED BACK")
print("[TOKEN FLOW SORT SHEET PREMIUM LIGHT V1] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[TOKEN FLOW SORT SHEET PREMIUM LIGHT V1] INSTALLED")
print("[TOKEN FLOW SORT SHEET PREMIUM LIGHT V1] sheet background = Token Flow light canvas")
print("[TOKEN FLOW SORT SHEET PREMIUM LIGHT V1] cleaner segmented control + continuous list")
print("[TOKEN FLOW SORT SHEET PREMIUM LIGHT V1] geometry and sort logic untouched")
print("[TOKEN FLOW SORT SHEET PREMIUM LIGHT V1] Dark theme untouched")
print("[TOKEN FLOW SORT SHEET PREMIUM LIGHT V1] backup:", backup)
print("[TOKEN FLOW SORT SHEET PREMIUM LIGHT V1] rollback: python3 rollback_token_flow_sort_sheet_premium_light_v1.py")
