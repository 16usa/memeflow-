#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / '.hiw-light-buttons-v1-backup-20260830-190359'

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
