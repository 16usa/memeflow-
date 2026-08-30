#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
CSS_FILE = APP / "system.css"
PAGE = APP / "settings.html"

MARKER = "/* ===== MEMEFLOW_SETTINGS_LIGHT_SURFACES_V1 ===== */"
CSS = '/* ===== MEMEFLOW_SETTINGS_LIGHT_SURFACES_V1 ===== */\n/*\n  System Settings · Light mode only.\n  Fixes only surfaces that still inherit Dark-theme colors:\n  - LIVE CONFIGURATION title\n  - Platform / AI Policy / Kill Switch summary cells\n  - opened accordion/group containers\n  No layout, spacing, settings logic, switches, field geometry or Dark-theme changes.\n*/\n\n/* LIVE CONFIGURATION / System Settings heading */\nhtml[data-theme="light"] body.mf-settings-standalone .mf293-settings-head h2 {\n  color: #172733 !important;\n}\n\n/* Top summary cards: Platform / AI Policy / Kill Switch (+ any same meta cell) */\nhtml[data-theme="light"] body.mf-settings-standalone .mf293-settings-meta > span,\nhtml[data-theme="light"] body.mf-settings-standalone .mf293-settings-meta > label {\n  background:\n    linear-gradient(\n      180deg,\n      rgba(255,255,255,.94),\n      rgba(244,248,250,.96)\n    ) !important;\n  border-color: rgba(91,113,126,.15) !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] body.mf-settings-standalone .mf293-settings-meta span,\nhtml[data-theme="light"] body.mf-settings-standalone .mf293-dex-filter-meta {\n  color: #6b808c !important;\n}\n\nhtml[data-theme="light"] body.mf-settings-standalone .mf293-settings-meta strong,\nhtml[data-theme="light"] body.mf-settings-standalone .mf293-dex-filter-meta strong,\nhtml[data-theme="light"] body.mf-settings-standalone .mf293-settings-meta select {\n  color: #20323e !important;\n}\n\n/* Opened sections only — collapsed sections are already correct in Light. */\nhtml[data-theme="light"] body.mf-settings-standalone .mf293-settings-group[open] {\n  background:\n    linear-gradient(\n      180deg,\n      rgba(255,255,255,.94),\n      rgba(245,248,250,.97)\n    ) !important;\n  border-color: rgba(91,113,126,.16) !important;\n  box-shadow: 0 10px 28px rgba(27,42,53,.035) !important;\n}\n\n/* Open section heading and description */\nhtml[data-theme="light"] body.mf-settings-standalone\n.mf293-settings-group[open] summary strong {\n  color: #172733 !important;\n}\n\nhtml[data-theme="light"] body.mf-settings-standalone\n.mf293-settings-group[open] summary small {\n  color: #71858f !important;\n}\n\nhtml[data-theme="light"] body.mf-settings-standalone\n.mf293-settings-group[open] summary i {\n  border-color: #6f8792 !important;\n}\n\n/*\n  Keep the existing Light field cards, but make sure no open-parent rule\n  washes their labels/value text back toward Dark-theme colors.\n*/\nhtml[data-theme="light"] body.mf-settings-standalone\n.mf293-settings-group[open] .mf293-field-label {\n  color: #70848f !important;\n}\n\nhtml[data-theme="light"] body.mf-settings-standalone\n.mf293-settings-group[open] .mf293-field input:not([type="checkbox"]),\nhtml[data-theme="light"] body.mf-settings-standalone\n.mf293-settings-group[open] .mf293-field select,\nhtml[data-theme="light"] body.mf-settings-standalone\n.mf293-settings-group[open] .mf293-field textarea {\n  color: #182833 !important;\n}\n/* ===== /MEMEFLOW_SETTINGS_LIGHT_SURFACES_V1 ===== */\n'

def die(msg):
    print(f"[SETTINGS LIGHT SURFACES V1] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

for path in (CSS_FILE, PAGE):
    if not path.exists():
        die(f"missing {path}")

css_before = CSS_FILE.read_text(encoding="utf-8")
page_before = PAGE.read_text(encoding="utf-8")

if MARKER in css_before:
    print("[SETTINGS LIGHT SURFACES V1] already installed")
    raise SystemExit(0)

# Safety: exact production selectors verified before modifying anything.
required_css = (
    "body.mf-settings-standalone .mf293-settings-group[open]",
    "body.mf-settings-standalone .mf293-settings-meta > span",
    "body.mf-settings-standalone .mf293-settings-head h2",
)
for needle in required_css:
    if needle not in css_before:
        die("expected System Settings selector not found: " + needle)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".settings-light-surfaces-v1-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

shutil.copy2(CSS_FILE, backup / "system.css")
shutil.copy2(PAGE, backup / "settings.html")

# Append one final Light-only layer. Existing Dark CSS is not edited.
CSS_FILE.write_text(css_before.rstrip() + "\n\n" + CSS, encoding="utf-8")

# Cache-bust System Settings only.
new_url = "/system.css?v=settings-light-surfaces-v1-20260830"
page_after, count = re.subn(
    r'/system\.css\?v=[^"\']+',
    new_url,
    page_before,
    count=1
)
if count == 0:
    die("system.css stylesheet link not found in settings.html")

PAGE.write_text(page_after, encoding="utf-8")

rollback = ROOT / "rollback_settings_light_surfaces_v1.py"
rollback.write_text(
    """#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / %r

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in ("system.css", "settings.html"):
    src = BACKUP / name
    dst = APP / name
    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))
    shutil.copy2(src, dst)

print("[SETTINGS LIGHT SURFACES V1] ROLLED BACK")
print("[SETTINGS LIGHT SURFACES V1] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[SETTINGS LIGHT SURFACES V1] INSTALLED")
print("[SETTINGS LIGHT SURFACES V1] Light only")
print("[SETTINGS LIGHT SURFACES V1] changed: opened section surfaces + top meta cards + System Settings title")
print("[SETTINGS LIGHT SURFACES V1] collapsed sections / layout / switches / settings logic untouched")
print("[SETTINGS LIGHT SURFACES V1] Dark theme untouched")
print("[SETTINGS LIGHT SURFACES V1] backup:", backup)
print("[SETTINGS LIGHT SURFACES V1] rollback: python3 rollback_settings_light_surfaces_v1.py")
