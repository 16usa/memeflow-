#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / '.smart-vault-primary-cta-readability-v1-backup-20260830-193455'

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in ("memeflow-theme.css", "smart-vault.html"):
    src = BACKUP / name
    dst = APP / name
    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))
    shutil.copy2(src, dst)

print("[SMART VAULT CTA READABILITY V1] ROLLED BACK")
print("[SMART VAULT CTA READABILITY V1] restored:", BACKUP)
