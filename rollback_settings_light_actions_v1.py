#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / '.settings-light-actions-v1-backup-20260830-204651'

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in ("system.css", "settings.html"):
    src = BACKUP / name
    dst = APP / name
    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))
    shutil.copy2(src, dst)

src_js = BACKUP / "settings-light-actions-v1.js"
dst_js = APP / "settings-light-actions-v1.js"

if src_js.exists():
    shutil.copy2(src_js, dst_js)
elif dst_js.exists():
    dst_js.unlink()

print("[SETTINGS LIGHT ACTIONS V1] ROLLED BACK")
print("[SETTINGS LIGHT ACTIONS V1] restored:", BACKUP)
