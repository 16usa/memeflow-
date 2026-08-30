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

START = "/* ===== MEMEFLOW_HIW_LIGHT_CTA_BG_V1 ===== */"
CSS = '/* ===== MEMEFLOW_HIW_LIGHT_CTA_BG_V1 ===== */\n/*\n  How It Works · Light only.\n  The final READY TO USE MEMEFLOW CTA should continue the page canvas,\n  not render as a separate white sheet.\n  No layout, spacing, buttons, borders, header or Dark-theme changes.\n*/\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-cta {\n  background: transparent !important;\n  background-image: none !important;\n  box-shadow: none !important;\n}\n/* ===== /MEMEFLOW_HIW_LIGHT_CTA_BG_V1 ===== */\n'

def die(msg):
    print(f"[HIW LIGHT CTA BG V1] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

if not THEME.exists():
    die(f"missing {THEME}")
if not PAGE.exists():
    die(f"missing {PAGE}")

theme_before = THEME.read_text(encoding="utf-8")
page_before = PAGE.read_text(encoding="utf-8")

if START in theme_before:
    print("[HIW LIGHT CTA BG V1] already installed")
    raise SystemExit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".hiw-light-cta-bg-v1-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)
shutil.copy2(THEME, backup / "memeflow-theme.css")
shutil.copy2(PAGE, backup / "how-it-works.html")

THEME.write_text(theme_before.rstrip() + "\n\n" + CSS, encoding="utf-8")

new_url = "/memeflow-theme.css?v=light-theme-v1-hiw-cta-bg-v1-20260830"
page_after, count = re.subn(
    r'/memeflow-theme\.css\?v=[^"\']+',
    new_url,
    page_before,
    count=1
)
if count == 0:
    die("theme stylesheet link not found in how-it-works.html")

PAGE.write_text(page_after, encoding="utf-8")

rollback = ROOT / "rollback_hiw_light_cta_bg_v1.py"
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

print("[HIW LIGHT CTA BG V1] ROLLED BACK")
print("[HIW LIGHT CTA BG V1] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[HIW LIGHT CTA BG V1] INSTALLED")
print("[HIW LIGHT CTA BG V1] changed: final How It Works CTA background only")
print("[HIW LIGHT CTA BG V1] layout / buttons / header untouched")
print("[HIW LIGHT CTA BG V1] Dark theme untouched")
print("[HIW LIGHT CTA BG V1] backup:", backup)
print("[HIW LIGHT CTA BG V1] rollback: python3 rollback_hiw_light_cta_bg_v1.py")
