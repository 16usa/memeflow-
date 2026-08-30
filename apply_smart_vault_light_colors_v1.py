#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
THEME = APP / "memeflow-theme.css"
PAGE = APP / "smart-vault.html"

START = "/* ===== MEMEFLOW_SMART_VAULT_LIGHT_COLORS_V1 ===== */"
CSS = '/* ===== MEMEFLOW_SMART_VAULT_LIGHT_COLORS_V1 ===== */\n/*\n  Smart Vault · Light mode only.\n  Color/contrast fixes only:\n  - CURRENT PRODUCTION STATE panel becomes a light surface\n  - disabled buttons remain disabled but readable\n  No layout, spacing, header divider, behavior, or Dark-theme changes.\n*/\n\n/* Final production-state panel */\nhtml[data-theme="light"] .mf-vault-status-panel {\n  background:\n    radial-gradient(circle at 92% 0%, rgba(85,217,255,.06), transparent 30%),\n    linear-gradient(180deg, rgba(255,255,255,.94), rgba(244,248,250,.97)) !important;\n  border-color: rgba(91,113,126,.16) !important;\n  box-shadow: 0 14px 36px rgba(27,42,53,.045) !important;\n}\n\nhtml[data-theme="light"] .mf-vault-status-copy h2 {\n  color: #172733 !important;\n}\n\nhtml[data-theme="light"] .mf-vault-status-copy p {\n  color: #687d89 !important;\n}\n\nhtml[data-theme="light"] .mf-vault-status-flow span {\n  color: #657985 !important;\n  background: rgba(255,255,255,.58) !important;\n  border-color: rgba(91,113,126,.15) !important;\n}\n\nhtml[data-theme="light"] .mf-vault-status-flow span.is-ready {\n  color: #248e67 !important;\n  background: rgba(77,230,161,.055) !important;\n  border-color: rgba(36,181,122,.22) !important;\n}\n\nhtml[data-theme="light"] .mf-vault-status-flow b {\n  color: #7d909a !important;\n}\n\n/* Disabled controls: visibly disabled, but no washed-out text */\nhtml[data-theme="light"] .mf-vault-btn:disabled {\n  opacity: .68 !important;\n  color: #7f929d !important;\n  border-color: rgba(91,113,126,.14) !important;\n  background: rgba(255,255,255,.22) !important;\n}\n\nhtml[data-theme="light"] .mf-vault-btn-primary:disabled {\n  color: #56899a !important;\n  border-color: rgba(52,178,211,.22) !important;\n  background: rgba(85,217,255,.055) !important;\n}\n/* ===== /MEMEFLOW_SMART_VAULT_LIGHT_COLORS_V1 ===== */\n'

def die(msg):
    print(f"[SMART VAULT LIGHT COLORS V1] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

if not THEME.exists():
    die(f"missing {THEME}")
if not PAGE.exists():
    die(f"missing {PAGE}")

theme_before = THEME.read_text(encoding="utf-8")
page_before = PAGE.read_text(encoding="utf-8")

if START in theme_before:
    print("[SMART VAULT LIGHT COLORS V1] already installed")
    raise SystemExit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".smart-vault-light-colors-v1-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)
shutil.copy2(THEME, backup / "memeflow-theme.css")
shutil.copy2(PAGE, backup / "smart-vault.html")

THEME.write_text(theme_before.rstrip() + "\n\n" + CSS, encoding="utf-8")

new_url = "/memeflow-theme.css?v=light-theme-v1-smart-vault-colors-v1-20260830"
page_after, count = re.subn(
    r'/memeflow-theme\.css\?v=[^"\']+',
    new_url,
    page_before,
    count=1
)
if count == 0:
    die("theme stylesheet link not found in smart-vault.html")

PAGE.write_text(page_after, encoding="utf-8")

rollback = ROOT / "rollback_smart_vault_light_colors_v1.py"
rollback.write_text(
    """#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / %r

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in ("memeflow-theme.css", "smart-vault.html"):
    src = BACKUP / name
    dst = APP / name
    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))
    shutil.copy2(src, dst)

print("[SMART VAULT LIGHT COLORS V1] ROLLED BACK")
print("[SMART VAULT LIGHT COLORS V1] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[SMART VAULT LIGHT COLORS V1] INSTALLED")
print("[SMART VAULT LIGHT COLORS V1] changed: production-state panel + disabled button contrast")
print("[SMART VAULT LIGHT COLORS V1] colors only; layout and behavior untouched")
print("[SMART VAULT LIGHT COLORS V1] Dark theme untouched")
print("[SMART VAULT LIGHT COLORS V1] backup:", backup)
print("[SMART VAULT LIGHT COLORS V1] rollback: python3 rollback_smart_vault_light_colors_v1.py")
