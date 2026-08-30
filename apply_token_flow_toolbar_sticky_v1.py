#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"

CSS_FILE = APP / "system-tokens.css"
HTML_FILE = APP / "system-tokens.html"

MARKER = "/* ===== MEMEFLOW_TOKEN_FLOW_TOOLBAR_STICKY_V1 ===== */"
CSS = '/* ===== MEMEFLOW_TOKEN_FLOW_TOOLBAR_STICKY_V1 ===== */\n/*\n  Token Flow controls:\n  Search mint + Refresh + SORT SMART\n\n  Keep the complete controls block sticky while token cards scroll below it.\n  No visual geometry, sort logic, filters, cards or pagination behavior changed.\n*/\n.flow-toolbar {\n  position: -webkit-sticky !important;\n  position: sticky !important;\n  top: 0 !important;\n  z-index: 120 !important;\n  align-self: start !important;\n  isolation: isolate;\n}\n\n/* SORT SMART is rendered inside the toolbar and must travel with it. */\n.flow-toolbar .mf-sort-toolbar-v25 {\n  position: relative;\n  z-index: 1;\n}\n\n/* Keep token cards below the sticky control layer. */\n.token-list,\n.flow-token {\n  z-index: auto;\n}\n/* ===== /MEMEFLOW_TOKEN_FLOW_TOOLBAR_STICKY_V1 ===== */\n'

def die(message):
    print(f"[TOKEN FLOW TOOLBAR STICKY V1] ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)

for path in (CSS_FILE, HTML_FILE):
    if not path.exists():
        die(f"missing {path}")

css_before = CSS_FILE.read_text(encoding="utf-8")
html_before = HTML_FILE.read_text(encoding="utf-8")

if MARKER in css_before:
    print("[TOKEN FLOW TOOLBAR STICKY V1] already installed")
    raise SystemExit(0)

if ".flow-toolbar" not in css_before:
    die("expected .flow-toolbar rule not found")

if 'class="flow-toolbar"' not in html_before:
    die("expected flow-toolbar section not found in system-tokens.html")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".token-flow-toolbar-sticky-v1-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

shutil.copy2(CSS_FILE, backup / CSS_FILE.name)
shutil.copy2(HTML_FILE, backup / HTML_FILE.name)

CSS_FILE.write_text(
    css_before.rstrip() + "\n\n" + CSS,
    encoding="utf-8"
)

html_after, count = re.subn(
    r'/system-tokens\.css\?v=[^"\']+',
    '/system-tokens.css?v=token-flow-toolbar-sticky-v1-20260830',
    html_before,
    count=1
)

if count == 0:
    html_after, count = re.subn(
        r'/system-tokens\.css',
        '/system-tokens.css?v=token-flow-toolbar-sticky-v1-20260830',
        html_before,
        count=1
    )

if count == 0:
    die("system-tokens.css link not found in system-tokens.html")

HTML_FILE.write_text(html_after, encoding="utf-8")

rollback = ROOT / "rollback_token_flow_toolbar_sticky_v1.py"
rollback.write_text(
    '''#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / %r

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in ("system-tokens.css", "system-tokens.html"):
    src = BACKUP / name
    dst = APP / name
    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))
    shutil.copy2(src, dst)

print("[TOKEN FLOW TOOLBAR STICKY V1] ROLLED BACK")
print("[TOKEN FLOW TOOLBAR STICKY V1] restored:", BACKUP)
''' % backup.name,
    encoding="utf-8"
)

print("[TOKEN FLOW TOOLBAR STICKY V1] INSTALLED")
print("[TOKEN FLOW TOOLBAR STICKY V1] sticky: Search mint + Refresh + SORT SMART")
print("[TOKEN FLOW TOOLBAR STICKY V1] cards scroll underneath")
print("[TOKEN FLOW TOOLBAR STICKY V1] filters / sort logic / pagination untouched")
print("[TOKEN FLOW TOOLBAR STICKY V1] backup:", backup)
print("[TOKEN FLOW TOOLBAR STICKY V1] rollback: python3 rollback_token_flow_toolbar_sticky_v1.py")
