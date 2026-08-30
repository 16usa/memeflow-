#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / '.trading-open-position-badge-v1-backup-20260830-200739'

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in ("memeflow-theme.css", "trading.html"):
    src = BACKUP / name
    dst = APP / name
    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))
    shutil.copy2(src, dst)

src_js = BACKUP / "open-position-badge-unify-v1.js"
dst_js = APP / "open-position-badge-unify-v1.js"
if src_js.exists():
    shutil.copy2(src_js, dst_js)
elif dst_js.exists():
    dst_js.unlink()

print("[TRADING OPEN POSITION BADGE V1] ROLLED BACK")
print("[TRADING OPEN POSITION BADGE V1] restored:", BACKUP)
