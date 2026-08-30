#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / '.hiw-light-dark-blocks-v1-backup-20260830-191838'

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

src_html = BACKUP / "how-it-works.html"
dst_html = APP / "how-it-works.html"
if not src_html.exists():
    raise SystemExit("Backup file missing: " + str(src_html))
shutil.copy2(src_html, dst_html)

src_js = BACKUP / "hiw-light-dark-blocks-v1.js"
dst_js = APP / "hiw-light-dark-blocks-v1.js"
if src_js.exists():
    shutil.copy2(src_js, dst_js)
elif dst_js.exists():
    dst_js.unlink()

print("[HIW LIGHT DARK BLOCKS V1] ROLLED BACK")
print("[HIW LIGHT DARK BLOCKS V1] restored:", BACKUP)
