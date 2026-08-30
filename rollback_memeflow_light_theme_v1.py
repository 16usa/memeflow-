#!/usr/bin/env python3
from pathlib import Path
import json
import shutil

APP = Path("memeflow-app")
BACKUP = Path('memeflow-app/.light-theme-v1-backup-20260830-184145')
manifest = json.loads((BACKUP / "manifest.json").read_text(encoding="utf-8"))

for name in manifest["html"]:
    shutil.copy2(BACKUP / name, APP / name)

for name, key in (
    ("memeflow-theme.css", "preexisting_theme_css"),
    ("memeflow-theme.js", "preexisting_theme_js"),
):
    target = APP / name
    saved = BACKUP / name
    if manifest[key]:
        shutil.copy2(saved, target)
    elif target.exists():
        target.unlink()

print("[LIGHT THEME V1] rollback complete")
print("[LIGHT THEME V1] restored:", BACKUP)
