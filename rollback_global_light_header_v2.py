#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / '.global-light-header-v2-backup-20260830-185817'
FILES = ['memeflow-theme.css', 'system.html', 'trading.html', 'settings.html', 'system-tokens.html', 'smart-vault.html', 'how-it-works.html']

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in FILES:
    src = BACKUP / name
    dst = APP / name
    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))
    shutil.copy2(src, dst)

print("[GLOBAL LIGHT HEADER V2] ROLLED BACK")
print("[GLOBAL LIGHT HEADER V2] restored:", BACKUP)
