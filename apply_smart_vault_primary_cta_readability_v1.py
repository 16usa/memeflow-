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

START = "/* ===== MEMEFLOW_SMART_VAULT_PRIMARY_CTA_READABILITY_V1 ===== */"
CSS = '/* ===== MEMEFLOW_SMART_VAULT_PRIMARY_CTA_READABILITY_V1 ===== */\n/*\n  Smart Vault · Light only.\n  Only CONNECT WALLET and CREATE SMART VAULT.\n  Keep their existing enabled/disabled behavior; improve text contrast only.\n*/\nhtml[data-theme="light"] #connectBtn,\nhtml[data-theme="light"] #createBtn {\n  color: #3e7d91 !important;\n}\n\nhtml[data-theme="light"] #connectBtn:disabled,\nhtml[data-theme="light"] #createBtn:disabled {\n  opacity: .78 !important;\n  color: #4d8191 !important;\n  border-color: rgba(52,178,211,.24) !important;\n  background: rgba(85,217,255,.06) !important;\n}\n/* ===== /MEMEFLOW_SMART_VAULT_PRIMARY_CTA_READABILITY_V1 ===== */\n'

def die(msg):
    print(f"[SMART VAULT CTA READABILITY V1] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

if not THEME.exists():
    die(f"missing {THEME}")
if not PAGE.exists():
    die(f"missing {PAGE}")

theme_before = THEME.read_text(encoding="utf-8")
page_before = PAGE.read_text(encoding="utf-8")

if START in theme_before:
    print("[SMART VAULT CTA READABILITY V1] already installed")
    raise SystemExit(0)

if 'id="connectBtn"' not in page_before or 'id="createBtn"' not in page_before:
    die("connectBtn/createBtn not found in smart-vault.html")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".smart-vault-primary-cta-readability-v1-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)
shutil.copy2(THEME, backup / "memeflow-theme.css")
shutil.copy2(PAGE, backup / "smart-vault.html")

THEME.write_text(theme_before.rstrip() + "\n\n" + CSS, encoding="utf-8")

new_url = "/memeflow-theme.css?v=light-theme-v1-smart-vault-primary-cta-v1-20260830"
page_after, count = re.subn(
    r'/memeflow-theme\.css\?v=[^"\']+',
    new_url,
    page_before,
    count=1
)
if count == 0:
    die("theme stylesheet link not found in smart-vault.html")

PAGE.write_text(page_after, encoding="utf-8")

rollback = ROOT / "rollback_smart_vault_primary_cta_readability_v1.py"
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

print("[SMART VAULT CTA READABILITY V1] ROLLED BACK")
print("[SMART VAULT CTA READABILITY V1] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[SMART VAULT CTA READABILITY V1] INSTALLED")
print("[SMART VAULT CTA READABILITY V1] changed: CONNECT WALLET + CREATE SMART VAULT text contrast only")
print("[SMART VAULT CTA READABILITY V1] behavior / layout / other buttons untouched")
print("[SMART VAULT CTA READABILITY V1] Dark theme untouched")
print("[SMART VAULT CTA READABILITY V1] backup:", backup)
print("[SMART VAULT CTA READABILITY V1] rollback: python3 rollback_smart_vault_primary_cta_readability_v1.py")
