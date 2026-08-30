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

MARKER = "/* ===== MEMEFLOW_TOKEN_FLOW_SURFACES_MATCH_PAGE_BG_V1 ===== */"
CSS = '/* ===== MEMEFLOW_TOKEN_FLOW_SURFACES_MATCH_PAGE_BG_V1 ===== */\n/*\n  Token Flow · Light theme only.\n  Experiment: white surfaces use the exact page background by becoming transparent.\n  IMPORTANT:\n  - borders untouched\n  - shadows untouched\n  - geometry untouched\n  - OPEN POSITION untouched\n  - Dark theme untouched\n*/\n\n/* Main top content surfaces */\nhtml[data-theme="light"] .flow-hero,\nhtml[data-theme="light"] .summary-card,\nhtml[data-theme="light"] .flow-toolbar,\nhtml[data-theme="light"] .search-wrap,\nhtml[data-theme="light"] .refresh-info button,\nhtml[data-theme="light"] .mf-sort-trigger-v25,\nhtml[data-theme="light"] .mf-sort-trigger-v25.is-active,\n\n/* Token cards and their light nested surfaces */\nhtml[data-theme="light"] .flow-token,\nhtml[data-theme="light"] .flow-token .token-avatar,\nhtml[data-theme="light"] .flow-token .details-button,\nhtml[data-theme="light"] .flow-token .detail-block,\n\n/* Bottom pagination */\nhtml[data-theme="light"] .pagination,\nhtml[data-theme="light"] .pagination button {\n  background: transparent !important;\n}\n\n/*\n  Preserve the canonical OPEN POSITION semantic fill exactly.\n  This is intentionally NOT part of the transparent-surface experiment.\n*/\nhtml[data-theme="light"] .flow-token .token-state.open {\n  color: #4de6a1 !important;\n  border-color: rgba(77, 230, 161, .72) !important;\n  background: rgba(77, 230, 161, .07) !important;\n}\n\n/* Preserve active semantic status backgrounds only where the page needs them. */\nhtml[data-theme="light"] .summary-card.ready.active {\n  background: rgba(239, 198, 106, .065) !important;\n}\n\nhtml[data-theme="light"] .summary-card.watch.active {\n  background: rgba(92, 141, 255, .065) !important;\n}\n\nhtml[data-theme="light"] .summary-card.waiting.active {\n  background: rgba(163, 180, 192, .045) !important;\n}\n\nhtml[data-theme="light"] .summary-card.blocked.active {\n  background: rgba(255, 102, 121, .06) !important;\n}\n/* ===== /MEMEFLOW_TOKEN_FLOW_SURFACES_MATCH_PAGE_BG_V1 ===== */\n'

def die(msg):
    print(f"[TOKEN FLOW MATCH PAGE BG V1] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

for path in (THEME, HTML):
    if not path.exists():
        die(f"missing {path}")

theme_before = THEME.read_text(encoding="utf-8")
html_before = HTML.read_text(encoding="utf-8")

if MARKER in theme_before:
    print("[TOKEN FLOW MATCH PAGE BG V1] already installed")
    raise SystemExit(0)

# Safety checks: make sure this is the expected Token Flow build.
expected = (
    'html[data-theme="light"] .flow-token',
    'html[data-theme="light"] .pagination',
)
for needle in expected:
    if needle not in theme_before:
        die("expected previous Token Flow Light rule not found: " + needle)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".token-flow-match-page-bg-v1-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

shutil.copy2(THEME, backup / THEME.name)
shutil.copy2(HTML, backup / HTML.name)

# Final Light-only layer. We change ONLY background fills.
THEME.write_text(
    theme_before.rstrip() + "\n\n" + CSS,
    encoding="utf-8"
)

# Cache-bust Token Flow only.
html_after, count = re.subn(
    r'/memeflow-theme\.css\?v=[^"\']+',
    '/memeflow-theme.css?v=token-flow-match-page-bg-v1-20260830',
    html_before,
    count=1
)

if count == 0:
    head_close = html_before.lower().find("</head>")
    if head_close < 0:
        die("cannot find </head> in system-tokens.html")

    link = '\n<link rel="stylesheet" href="/memeflow-theme.css?v=token-flow-match-page-bg-v1-20260830">\n'
    html_after = html_before[:head_close] + link + html_before[head_close:]

HTML.write_text(html_after, encoding="utf-8")

rollback = ROOT / "rollback_token_flow_surfaces_match_page_bg_v1.py"
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

print("[TOKEN FLOW MATCH PAGE BG V1] ROLLED BACK")
print("[TOKEN FLOW MATCH PAGE BG V1] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[TOKEN FLOW MATCH PAGE BG V1] INSTALLED")
print("[TOKEN FLOW MATCH PAGE BG V1] Light surfaces now show the exact page background")
print("[TOKEN FLOW MATCH PAGE BG V1] borders / shadows / dimensions untouched")
print("[TOKEN FLOW MATCH PAGE BG V1] OPEN POSITION preserved")
print("[TOKEN FLOW MATCH PAGE BG V1] Dark theme untouched")
print("[TOKEN FLOW MATCH PAGE BG V1] backup:", backup)
print("[TOKEN FLOW MATCH PAGE BG V1] rollback: python3 rollback_token_flow_surfaces_match_page_bg_v1.py")
