#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / '.token-flow-toolbar-pin-v3-backup-20260830-223214'

if not BACKUP.exists():
    raise SystemExit(
        "Backup not found: " + str(BACKUP)
    )

for name in (
    "system-tokens.css",
    "system-tokens.js",
    "system-tokens.html",
):
    src = BACKUP / name
    dst = APP / name

    if not src.exists():
        raise SystemExit(
            "Backup file missing: " + str(src)
        )

    shutil.copy2(src, dst)

print("[TOKEN FLOW TOOLBAR PIN V3] ROLLED BACK")
print(
    "[TOKEN FLOW TOOLBAR PIN V3] restored:",
    BACKUP
)
