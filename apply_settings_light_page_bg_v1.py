#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"

CSS_FILE = APP / "system.css"
PAGE = APP / "settings.html"

MARKER = "/* ===== MEMEFLOW_SETTINGS_LIGHT_PAGE_BG_V1 ===== */"
CSS = '/* ===== MEMEFLOW_SETTINGS_LIGHT_PAGE_BG_V1 ===== */\n/*\n  System Settings · Light mode only.\n  Unifies the page canvas with the rest of MEMEFLOW Light pages.\n  Only the rear/page background is changed.\n  Header, settings panel, cards, fields, layout and logic are untouched.\n*/\n\nhtml[data-theme="light"] {\n  background: #eef4f7 !important;\n}\n\nhtml[data-theme="light"] body.mf-settings-standalone {\n  --mf-ui-bg: #eef4f7;\n\n  background:\n    radial-gradient(\n      circle at 50% -6%,\n      rgba(85, 217, 255, .055),\n      transparent 31%\n    ),\n    linear-gradient(\n      180deg,\n      #f3f8fa 0%,\n      #eef5f7 32%,\n      #edf4f7 100%\n    ) !important;\n\n  background-color: #eef4f7 !important;\n}\n\nhtml[data-theme="light"] body.mf-settings-standalone .mf-settings-page-shell,\nhtml[data-theme="light"] body.mf-settings-standalone .mf293-settings-backdrop {\n  background: transparent !important;\n}\n/* ===== /MEMEFLOW_SETTINGS_LIGHT_PAGE_BG_V1 ===== */\n'

def die(msg):
    print(f"[SETTINGS LIGHT PAGE BG V1] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

for path in (CSS_FILE, PAGE):
    if not path.exists():
        die(f"missing {path}")

css_before = CSS_FILE.read_text(encoding="utf-8")
page_before = PAGE.read_text(encoding="utf-8")

if MARKER in css_before:
    print("[SETTINGS LIGHT PAGE BG V1] already installed")
    raise SystemExit(0)

# Verify the exact standalone Settings background owners before touching anything.
required = (
    "body.mf-settings-standalone",
    ".mf-settings-page-shell",
    ".mf293-settings-backdrop",
)
for needle in required:
    if needle not in css_before:
        die("expected Settings background selector not found: " + needle)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".settings-light-page-bg-v1-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

shutil.copy2(CSS_FILE, backup / "system.css")
shutil.copy2(PAGE, backup / "settings.html")

# One final Light-only canvas layer. Existing cards/panels remain untouched.
CSS_FILE.write_text(css_before.rstrip() + "\n\n" + CSS, encoding="utf-8")

# Cache-bust Settings CSS only.
page_after, count = re.subn(
    r'/system\.css\?v=[^"\']+',
    '/system.css?v=settings-light-page-bg-v1-20260830',
    page_before,
    count=1
)

if count == 0:
    die("system.css stylesheet link not found in settings.html")

# Also update browser chrome hint only for the Settings light-page version.
page_after = re.sub(
    r'<meta name="theme-color" content="[^"]*">',
    '<meta name="theme-color" content="#eef4f7">',
    page_after,
    count=1
)

PAGE.write_text(page_after, encoding="utf-8")

rollback = ROOT / "rollback_settings_light_page_bg_v1.py"
rollback.write_text(
    """#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / %r

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in ("system.css", "settings.html"):
    src = BACKUP / name
    dst = APP / name

    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))

    shutil.copy2(src, dst)

print("[SETTINGS LIGHT PAGE BG V1] ROLLED BACK")
print("[SETTINGS LIGHT PAGE BG V1] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[SETTINGS LIGHT PAGE BG V1] INSTALLED")
print("[SETTINGS LIGHT PAGE BG V1] changed: rear/page background only")
print("[SETTINGS LIGHT PAGE BG V1] Light theme only")
print("[SETTINGS LIGHT PAGE BG V1] cards / sections / header / layout / logic untouched")
print("[SETTINGS LIGHT PAGE BG V1] backup:", backup)
print("[SETTINGS LIGHT PAGE BG V1] rollback: python3 rollback_settings_light_page_bg_v1.py")
