#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / '.settings-light-page-bg-v1-backup-20260830-205657'

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
