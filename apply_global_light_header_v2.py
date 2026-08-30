#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
THEME = APP / "memeflow-theme.css"

PAGES = [
    "system.html",
    "trading.html",
    "settings.html",
    "system-tokens.html",
    "smart-vault.html",
    "how-it-works.html",
]

OLD_SYSTEM_START = "/* ===== MEMEFLOW_SYSTEM_OVERVIEW_LIGHT_HEADER_MATCH_V1 ===== */"
OLD_SYSTEM_END = "/* ===== /MEMEFLOW_SYSTEM_OVERVIEW_LIGHT_HEADER_MATCH_V1 ===== */"
START = "/* ===== MEMEFLOW_GLOBAL_LIGHT_HEADER_MATCH_V2 ===== */"
CSS = '/* ===== MEMEFLOW_GLOBAL_LIGHT_HEADER_MATCH_V2 ===== */\n/*\n  Global Light header alignment:\n  - normal-flow headers inherit the page background\n  - Trading Terminal sticky header stays opaque while matching the Light canvas\n  Dark theme is untouched.\n*/\nhtml[data-theme="light"] .mf-site-header:not(.mf-site-header--sticky) {\n  background: transparent !important;\n  background-image: none !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] .mf-site-header.mf-site-header--sticky {\n  background: rgba(244, 246, 248, .97) !important;\n  background-image: none !important;\n  box-shadow: none !important;\n}\n/* ===== /MEMEFLOW_GLOBAL_LIGHT_HEADER_MATCH_V2 ===== */\n'

def die(msg):
    print(f"[GLOBAL LIGHT HEADER V2] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

if not THEME.exists():
    die(f"missing {THEME}")

missing = [name for name in PAGES if not (APP / name).exists()]
if missing:
    die("missing pages: " + ", ".join(missing))

theme_before = THEME.read_text(encoding="utf-8")
if START in theme_before:
    print("[GLOBAL LIGHT HEADER V2] already installed")
    raise SystemExit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".global-light-header-v2-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

shutil.copy2(THEME, backup / "memeflow-theme.css")
for name in PAGES:
    shutil.copy2(APP / name, backup / name)

# If the earlier System Overview-only header patch was installed,
# remove only its exact marked block so V2 becomes the single owner.
theme_after = theme_before
if OLD_SYSTEM_START in theme_after and OLD_SYSTEM_END in theme_after:
    pattern = re.escape(OLD_SYSTEM_START) + r".*?" + re.escape(OLD_SYSTEM_END) + r"\s*"
    theme_after = re.sub(pattern, "", theme_after, flags=re.S)

theme_after = theme_after.rstrip() + "\n\n" + CSS
THEME.write_text(theme_after, encoding="utf-8")

# Bust the theme CSS cache on every active page without touching other assets.
new_url = "/memeflow-theme.css?v=light-theme-v1-global-header-v2-20260830"
for name in PAGES:
    path = APP / name
    text = path.read_text(encoding="utf-8")
    updated, count = re.subn(
        r'/memeflow-theme\.css\?v=[^"\']+',
        new_url,
        text,
        count=1
    )
    if count == 0:
        die(f"theme stylesheet link not found in {name}")
    path.write_text(updated, encoding="utf-8")

rollback = ROOT / "rollback_global_light_header_v2.py"
rollback.write_text(
    """#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / %r
FILES = %r

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
""" % (backup.name, ["memeflow-theme.css"] + PAGES),
    encoding="utf-8"
)

print("[GLOBAL LIGHT HEADER V2] INSTALLED")
print("[GLOBAL LIGHT HEADER V2] scope: all active site headers in Light mode")
print("[GLOBAL LIGHT HEADER V2] Dark theme untouched")
print("[GLOBAL LIGHT HEADER V2] backup:", backup)
print("[GLOBAL LIGHT HEADER V2] rollback: python3 rollback_global_light_header_v2.py")
