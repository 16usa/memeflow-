#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / '.token-flow-match-page-bg-v1-backup-20260830-214631'

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in ("memeflow-theme.css", "system-tokens.html"):
    src = BACKUP / name
    dst = APP / name

    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))

    shutil.copy2(src, dst)

print("[TOKEN FLOW MATCH PAGE BG V1] ROLLED BACK")
print("[TOKEN FLOW MATCH PAGE BG V1] restored:", BACKUP)
