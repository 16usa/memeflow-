#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / '.token-flow-light-surfaces-v2-backup-20260830-212406'

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in ("memeflow-theme.css", "system-tokens.html"):
    src = BACKUP / name
    dst = APP / name
    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))
    shutil.copy2(src, dst)

src_js = BACKUP / "token-flow-light-surfaces-v1.js"
dst_js = APP / "token-flow-light-surfaces-v1.js"

if src_js.exists():
    shutil.copy2(src_js, dst_js)
elif dst_js.exists():
    dst_js.unlink()

print("[TOKEN FLOW LIGHT SURFACES V2] ROLLED BACK")
print("[TOKEN FLOW LIGHT SURFACES V2] restored:", BACKUP)
