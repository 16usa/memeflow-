#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
THEME = APP / "memeflow-theme.css"
PAGE = APP / "how-it-works.html"

START = "/* ===== MEMEFLOW_HIW_LIGHT_BUTTON_CONTRAST_V1 ===== */"
CSS = '/* ===== MEMEFLOW_HIW_LIGHT_BUTTON_CONTRAST_V1 ===== */\n/*\n  How It Works · Light only.\n  Improve CTA readability without changing header, header divider,\n  page background, spacing, layout, or Dark theme.\n*/\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-btn {\n  color: #405563 !important;\n  border-color: rgba(67, 92, 106, .22) !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-btn-primary {\n  color: #0f6076 !important;\n  background: rgba(85, 217, 255, .13) !important;\n  border-color: rgba(37, 166, 198, .42) !important;\n  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .34) !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-btn-primary:hover,\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-btn-primary:focus-visible {\n  color: #0b5062 !important;\n  background: rgba(85, 217, 255, .18) !important;\n  border-color: rgba(28, 145, 176, .56) !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-btn-ghost {\n  color: #405563 !important;\n  background: rgba(255, 255, 255, .28) !important;\n  border-color: rgba(73, 98, 112, .22) !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-btn-ghost:hover,\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-btn-ghost:focus-visible {\n  color: #17242c !important;\n  background: rgba(255, 255, 255, .48) !important;\n  border-color: rgba(64, 88, 102, .34) !important;\n}\n/* ===== /MEMEFLOW_HIW_LIGHT_BUTTON_CONTRAST_V1 ===== */\n'

def die(msg):
    print(f"[HIW LIGHT BUTTONS V1] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

if not THEME.exists():
    die(f"missing {THEME}")
if not PAGE.exists():
    die(f"missing {PAGE}")

theme_before = THEME.read_text(encoding="utf-8")
page_before = PAGE.read_text(encoding="utf-8")

if START in theme_before:
    print("[HIW LIGHT BUTTONS V1] already installed")
    raise SystemExit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".hiw-light-buttons-v1-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)
shutil.copy2(THEME, backup / "memeflow-theme.css")
shutil.copy2(PAGE, backup / "how-it-works.html")

THEME.write_text(theme_before.rstrip() + "\n\n" + CSS, encoding="utf-8")

new_url = "/memeflow-theme.css?v=light-theme-v1-hiw-buttons-v1-20260830"
page_after, count = re.subn(
    r'/memeflow-theme\.css\?v=[^"\']+',
    new_url,
    page_before,
    count=1
)
if count == 0:
    die("theme stylesheet link not found in how-it-works.html")

PAGE.write_text(page_after, encoding="utf-8")

rollback = ROOT / "rollback_hiw_light_buttons_v1.py"
rollback.write_text(
    """#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / %r

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in ("memeflow-theme.css", "how-it-works.html"):
    src = BACKUP / name
    dst = APP / name
    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))
    shutil.copy2(src, dst)

print("[HIW LIGHT BUTTONS V1] ROLLED BACK")
print("[HIW LIGHT BUTTONS V1] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[HIW LIGHT BUTTONS V1] INSTALLED")
print("[HIW LIGHT BUTTONS V1] changed: How It Works Light CTA buttons only")
print("[HIW LIGHT BUTTONS V1] header and divider untouched")
print("[HIW LIGHT BUTTONS V1] Dark theme untouched")
print("[HIW LIGHT BUTTONS V1] backup:", backup)
print("[HIW LIGHT BUTTONS V1] rollback: python3 rollback_hiw_light_buttons_v1.py")
