#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"

JS_FILE = APP / "system-tokens.js"
HTML_FILE = APP / "system-tokens.html"

START = "/* ===== MEMEFLOW_TOKEN_FLOW_TOOLBAR_FIXED_LOCK_V2 ===== */"
END = "/* ===== /MEMEFLOW_TOKEN_FLOW_TOOLBAR_FIXED_LOCK_V2 ===== */"

def die(message):
    print(f"[TOKEN FLOW TOOLBAR CLEANUP] ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)

for path in (JS_FILE, HTML_FILE):
    if not path.exists():
        die(f"missing {path}")

js_before = JS_FILE.read_text(encoding="utf-8")
html_before = HTML_FILE.read_text(encoding="utf-8")

if START not in js_before:
    print("[TOKEN FLOW TOOLBAR CLEANUP] V2 block already absent")
    raise SystemExit(0)

if END not in js_before:
    die("V2 start marker found without end marker")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".token-flow-toolbar-cleanup-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

shutil.copy2(JS_FILE, backup / JS_FILE.name)
shutil.copy2(HTML_FILE, backup / HTML_FILE.name)

pattern = re.compile(
    re.escape(START) + r".*?" + re.escape(END) + r"\s*",
    re.S
)

js_after, count = pattern.subn("", js_before, count=1)

if count != 1:
    die(f"expected to remove exactly one V2 block, removed {count}")

# Safety: do not leave any toolbar experiment markers in runtime JS.
for marker in (
    "MEMEFLOW_TOKEN_FLOW_TOOLBAR_STICKY_V1",
    "MEMEFLOW_TOKEN_FLOW_TOOLBAR_FIXED_LOCK_V2",
    "MEMEFLOW_TOKEN_FLOW_TOOLBAR_PIN_V3",
):
    if marker in js_after:
        die("toolbar experiment marker still remains in JS: " + marker)

JS_FILE.write_text(js_after.rstrip() + "\n", encoding="utf-8")

# Cache-bust only system-tokens.js.
html_after, count = re.subn(
    r'/system-tokens\.js(?:\?v=[^"\']+)?',
    '/system-tokens.js?v=toolbar-experiments-clean-20260830',
    html_before,
    count=1
)

if count != 1:
    die("system-tokens.js asset link not found exactly once")

HTML_FILE.write_text(html_after, encoding="utf-8")

rollback = ROOT / "rollback_token_flow_toolbar_cleanup.py"
rollback.write_text(
    """#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / %r

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in ("system-tokens.js", "system-tokens.html"):
    src = BACKUP / name
    dst = APP / name
    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))
    shutil.copy2(src, dst)

print("[TOKEN FLOW TOOLBAR CLEANUP] ROLLED BACK")
print("[TOKEN FLOW TOOLBAR CLEANUP] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[TOKEN FLOW TOOLBAR CLEANUP] INSTALLED")
print("[TOKEN FLOW TOOLBAR CLEANUP] removed V2 fixed-lock runtime block only")
print("[TOKEN FLOW TOOLBAR CLEANUP] native Token Flow toolbar behavior preserved")
print("[TOKEN FLOW TOOLBAR CLEANUP] backup:", backup)
print("[TOKEN FLOW TOOLBAR CLEANUP] rollback: python3 rollback_token_flow_toolbar_cleanup.py")
