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
OLD_JS = APP / "token-flow-light-surfaces-v1.js"

V1_START = "/* ===== MEMEFLOW_TOKEN_FLOW_LIGHT_SURFACES_V1 ===== */"
V1_END = "/* ===== /MEMEFLOW_TOKEN_FLOW_LIGHT_SURFACES_V1 ===== */"

V2_MARKER = "/* ===== MEMEFLOW_TOKEN_FLOW_LIGHT_SURFACES_V2 ===== */"
CSS = '/* ===== MEMEFLOW_TOKEN_FLOW_LIGHT_SURFACES_V2 ===== */\n/*\n  Real-Time Pipeline / Token Flow · Light theme only.\n  Uses the page\'s native classes directly — no DOM scanning.\n  V2 replaces the experimental V1 marker-based layer.\n*/\n\n/* Main token cards — collapsed and expanded */\nhtml[data-theme="light"] .flow-token {\n  background:\n    linear-gradient(180deg, #ffffff 0%, #f8fbfc 100%) !important;\n  border-color: rgba(55, 79, 94, .12) !important;\n  color: #172733 !important;\n  box-shadow: 0 8px 24px rgba(27, 42, 53, .045) !important;\n}\n\nhtml[data-theme="light"] .flow-token.open {\n  border-color: rgba(77, 230, 161, .27) !important;\n  box-shadow:\n    inset 2px 0 0 rgba(77, 230, 161, .92),\n    0 8px 24px rgba(27, 42, 53, .045) !important;\n}\n\nhtml[data-theme="light"] .flow-token.open::before {\n  background: #4de6a1 !important;\n  box-shadow: none !important;\n}\n\n/* Identity */\nhtml[data-theme="light"] .flow-token .token-name,\nhtml[data-theme="light"] .flow-token .token-mint {\n  color: #172733 !important;\n}\n\nhtml[data-theme="light"] .flow-token .token-avatar {\n  background:\n    linear-gradient(180deg, #f8fbfc 0%, #eef4f7 100%) !important;\n  border-color: rgba(55, 79, 94, .14) !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] .flow-token .token-avatar.open {\n  border-color: rgba(77, 230, 161, .40) !important;\n}\n\nhtml[data-theme="light"] .flow-token .token-avatar span {\n  color: #405964 !important;\n}\n\n/* Canonical OPEN POSITION — keep exact Pipeline green rule */\nhtml[data-theme="light"] .flow-token .token-state.open {\n  color: #4de6a1 !important;\n  border-color: rgba(77, 230, 161, .72) !important;\n  background: rgba(77, 230, 161, .07) !important;\n}\n\n/* Score / P&L / market strip */\nhtml[data-theme="light"] .flow-token .token-metric {\n  border-color: rgba(55, 79, 94, .10) !important;\n}\n\nhtml[data-theme="light"] .flow-token .token-metric span,\nhtml[data-theme="light"] .flow-token .mf-open-market-stat span,\nhtml[data-theme="light"] .flow-token .mf-regular-market-stat span {\n  color: #71858f !important;\n}\n\nhtml[data-theme="light"] .flow-token .token-metric strong,\nhtml[data-theme="light"] .flow-token .mf-open-market-stat strong,\nhtml[data-theme="light"] .flow-token .mf-regular-market-stat strong {\n  color: #263943 !important;\n}\n\nhtml[data-theme="light"] .flow-token .mf-open-market-strip,\nhtml[data-theme="light"] .flow-token .mf-regular-market-strip {\n  border-top-color: rgba(55, 79, 94, .10) !important;\n}\n\nhtml[data-theme="light"] .flow-token .mf-open-market-stat,\nhtml[data-theme="light"] .flow-token .mf-regular-market-stat {\n  border-color: rgba(55, 79, 94, .10) !important;\n}\n\n/* Preserve semantic P&L colors */\nhtml[data-theme="light"] .flow-token.open .mf-open-position-pnl.is-profit,\nhtml[data-theme="light"] .flow-token .mf-open-market-stat strong.is-profit,\nhtml[data-theme="light"] .flow-token .mf-regular-market-stat strong.is-profit {\n  color: #36c98a !important;\n}\n\nhtml[data-theme="light"] .flow-token.open .mf-open-position-pnl.is-loss,\nhtml[data-theme="light"] .flow-token .mf-open-market-stat strong.is-loss,\nhtml[data-theme="light"] .flow-token .mf-regular-market-stat strong.is-loss {\n  color: #ef6677 !important;\n}\n\nhtml[data-theme="light"] .flow-token.open .mf-open-position-pnl.is-flat,\nhtml[data-theme="light"] .flow-token .mf-open-market-stat strong.is-flat,\nhtml[data-theme="light"] .flow-token .mf-regular-market-stat strong.is-flat {\n  color: #71858f !important;\n}\n\n/* Details / Close */\nhtml[data-theme="light"] .flow-token .details-button {\n  background: #ffffff !important;\n  border-color: rgba(55, 79, 94, .13) !important;\n  color: #536a75 !important;\n  box-shadow: none !important;\n}\n\n/* Expanded detail area */\nhtml[data-theme="light"] .flow-token .token-details {\n  border-top-color: rgba(55, 79, 94, .10) !important;\n}\n\nhtml[data-theme="light"] .flow-token .detail-block {\n  background:\n    linear-gradient(180deg, #fafcfd 0%, #f5f9fa 100%) !important;\n  border-color: rgba(55, 79, 94, .10) !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] .flow-token .detail-block span {\n  color: #71858f !important;\n}\n\nhtml[data-theme="light"] .flow-token .detail-block p {\n  color: #405762 !important;\n}\n\n/* Search / Refresh toolbar */\nhtml[data-theme="light"] .flow-toolbar {\n  background: rgba(249, 252, 253, .96) !important;\n  border-color: rgba(55, 79, 94, .11) !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] .search-wrap {\n  background:\n    linear-gradient(180deg, #f7fafb 0%, #f0f5f7 100%) !important;\n  border-color: rgba(55, 79, 94, .12) !important;\n}\n\nhtml[data-theme="light"] .search-wrap span {\n  color: #71858f !important;\n}\n\nhtml[data-theme="light"] .search-wrap input {\n  color: #263943 !important;\n}\n\nhtml[data-theme="light"] .search-wrap input::placeholder {\n  color: #71858f !important;\n}\n\nhtml[data-theme="light"] .refresh-info button {\n  background: #ffffff !important;\n  border-color: rgba(55, 79, 94, .12) !important;\n  color: #405762 !important;\n}\n\n/* SORT · SMART trigger */\nhtml[data-theme="light"] .mf-sort-trigger-v25,\nhtml[data-theme="light"] .mf-sort-trigger-v25.is-active {\n  background:\n    linear-gradient(180deg, #f5f9fa 0%, #edf4f6 100%) !important;\n  border-color: rgba(77, 230, 161, .24) !important;\n  color: #647b86 !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] .mf-sort-trigger-icon-v251,\nhtml[data-theme="light"] .mf-sort-trigger-chevron-v251,\nhtml[data-theme="light"] .mf-sort-trigger-chevron-v251.is-active {\n  color: #78909a !important;\n}\n\n/* Sticky pagination */\nhtml[data-theme="light"] .pagination {\n  background: rgba(245, 249, 251, .97) !important;\n  border-color: rgba(55, 79, 94, .11) !important;\n  box-shadow: 0 8px 24px rgba(27, 42, 53, .055) !important;\n}\n\nhtml[data-theme="light"] .pagination button {\n  background: #ffffff !important;\n  border-color: rgba(55, 79, 94, .12) !important;\n  color: #536a75 !important;\n}\n\nhtml[data-theme="light"] .pagination button:disabled {\n  opacity: .34 !important;\n}\n\nhtml[data-theme="light"] .page-state {\n  color: #71858f !important;\n}\n\nhtml[data-theme="light"] .page-state strong {\n  color: #405762 !important;\n}\n/* ===== /MEMEFLOW_TOKEN_FLOW_LIGHT_SURFACES_V2 ===== */\n'

def die(msg):
    print(f"[TOKEN FLOW LIGHT SURFACES V2] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

for path in (THEME, HTML):
    if not path.exists():
        die(f"missing {path}")

theme_before = THEME.read_text(encoding="utf-8")
html_before = HTML.read_text(encoding="utf-8")

if V2_MARKER in theme_before:
    print("[TOKEN FLOW LIGHT SURFACES V2] already installed")
    raise SystemExit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".token-flow-light-surfaces-v2-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

for path in (THEME, HTML, OLD_JS):
    if path.exists():
        shutil.copy2(path, backup / path.name)

# Remove V1 marker-based CSS completely.
theme_after = theme_before
v1_pattern = re.compile(
    re.escape(V1_START) + r".*?" + re.escape(V1_END) + r"\s*",
    re.S
)
theme_after = v1_pattern.sub("", theme_after)

# Add exact class-based V2 as the final Light layer.
theme_after = theme_after.rstrip() + "\n\n" + CSS
THEME.write_text(theme_after, encoding="utf-8")

# Remove V1 DOM scanner from Token Flow page.
html_after = re.sub(
    r'\s*<script[^>]+src=["\']/token-flow-light-surfaces-v1\.js[^"\']*["\'][^>]*></script>\s*',
    "\n",
    html_before,
    flags=re.I
)

# Cache bust memeflow-theme on this page.
html_after, count = re.subn(
    r'/memeflow-theme\.css\?v=[^"\']+',
    '/memeflow-theme.css?v=token-flow-light-surfaces-v2-20260830',
    html_after,
    count=1
)

# Robust fallback: if this page somehow lacks the shared theme link, insert it.
if count == 0:
    head_close = html_after.lower().find("</head>")
    if head_close < 0:
        die("cannot find </head> in system-tokens.html")
    link = '\n<link rel="stylesheet" href="/memeflow-theme.css?v=token-flow-light-surfaces-v2-20260830">\n'
    html_after = html_after[:head_close] + link + html_after[head_close:]

HTML.write_text(html_after, encoding="utf-8")

# V1 scanner is intentionally retired.
if OLD_JS.exists():
    OLD_JS.unlink()

rollback = ROOT / "rollback_token_flow_light_surfaces_v2.py"
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

src_js = BACKUP / "token-flow-light-surfaces-v1.js"
dst_js = APP / "token-flow-light-surfaces-v1.js"

if src_js.exists():
    shutil.copy2(src_js, dst_js)
elif dst_js.exists():
    dst_js.unlink()

print("[TOKEN FLOW LIGHT SURFACES V2] ROLLED BACK")
print("[TOKEN FLOW LIGHT SURFACES V2] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[TOKEN FLOW LIGHT SURFACES V2] INSTALLED")
print("[TOKEN FLOW LIGHT SURFACES V2] removed: V1 DOM scanner + V1 marker CSS")
print("[TOKEN FLOW LIGHT SURFACES V2] Light: ALL .flow-token cards are now native light surfaces")
print("[TOKEN FLOW LIGHT SURFACES V2] OPEN POSITION restored to canonical green")
print("[TOKEN FLOW LIGHT SURFACES V2] expanded details / search / sort / pager unified")
print("[TOKEN FLOW LIGHT SURFACES V2] Dark theme untouched")
print("[TOKEN FLOW LIGHT SURFACES V2] backup:", backup)
print("[TOKEN FLOW LIGHT SURFACES V2] rollback: python3 rollback_token_flow_light_surfaces_v2.py")
