#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / '.trading-open-position-pipeline-v3-backup-20260830-203208'

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

# Restore mandatory files.
for name in ("memeflow-theme.css", "trading.html"):
    src = BACKUP / name
    dst = APP / name

    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))

    shutil.copy2(src, dst)

# Restore/remove optional JS files to exactly match pre-patch state.
for name in (
    "open-position-badge-unify-v1.js",
    "open-position-badge-unify-v2.js",
    "open-position-pipeline-v3.js"
):
    src = BACKUP / name
    dst = APP / name

    if src.exists():
        shutil.copy2(src, dst)
    elif dst.exists():
        dst.unlink()

print("[TRADING OPEN POSITION PIPELINE V3] ROLLED BACK")
print("[TRADING OPEN POSITION PIPELINE V3] restored:", BACKUP)
