#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
THEME = APP / "memeflow-theme.css"
PAGE = APP / "how-it-works.html"

START = "/* ===== MEMEFLOW_HIW_LIGHT_SURFACES_V2 ===== */"
CSS = '/* ===== MEMEFLOW_HIW_LIGHT_SURFACES_V2 ===== */\n/*\n  How It Works · Light mode only.\n  Exact parent-level overrides. No layout/spacing/header-divider changes.\n*/\n\n/* Interactive Architecture selected-detail card */\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-map-detail {\n  background:\n    linear-gradient(180deg, rgba(255,255,255,.94), rgba(247,250,252,.94)) !important;\n  border-color: rgba(88,111,125,.14) !important;\n  box-shadow: 0 12px 34px rgba(27,42,53,.045) !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-detail-index {\n  color: #45c8ee !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-map-detail span {\n  color: #506a79 !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-map-detail h3 {\n  color: #172733 !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-map-detail p {\n  color: #6d818d !important;\n}\n\n/* WHO CONTROLS WHAT? — all three cards */\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-control-card {\n  background:\n    linear-gradient(180deg, rgba(255,255,255,.92), rgba(245,248,250,.96)) !important;\n  border-color: rgba(91,113,126,.16) !important;\n  box-shadow: 0 12px 32px rgba(27,42,53,.04) !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-control-card.mf-hiw-control-user {\n  border-color: rgba(52,178,211,.24) !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-control-label {\n  color: #4d8295 !important;\n  border-color: rgba(48,161,190,.22) !important;\n  background: rgba(85,217,255,.055) !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-control-card h3 {\n  color: #172733 !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-control-card li {\n  color: #667b87 !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-control-card li span {\n  color: #27bb80 !important;\n}\n\n/* IMPORTANT DISTINCTION — whole section, not inner text fragments */\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-money {\n  background:\n    radial-gradient(circle at 92% 0%, rgba(85,217,255,.075), transparent 30%),\n    linear-gradient(180deg, rgba(255,255,255,.94), rgba(244,248,250,.96)) !important;\n  border-color: rgba(47,170,203,.20) !important;\n  box-shadow: 0 16px 44px rgba(27,42,53,.05) !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-money h2 {\n  color: #172733 !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-money-copy p,\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-network-note {\n  color: #6b7f8b !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-money-flow > div {\n  background: rgba(255,255,255,.72) !important;\n  border-color: rgba(91,113,126,.15) !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-money-flow > div.is-vault {\n  background: rgba(77,230,161,.045) !important;\n  border-color: rgba(36,181,122,.22) !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-money-flow small {\n  color: #577080 !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-money-flow strong {\n  color: #1c2d38 !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-money-flow > span {\n  color: #159fc8 !important;\n}\n\n/* FAQ — whole accordion cards */\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-faq details {\n  background:\n    linear-gradient(180deg, rgba(255,255,255,.90), rgba(244,248,250,.96)) !important;\n  border-color: rgba(91,113,126,.16) !important;\n  box-shadow: 0 8px 24px rgba(27,42,53,.035) !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-faq details[open] {\n  background:\n    linear-gradient(180deg, rgba(255,255,255,.98), rgba(243,249,251,.98)) !important;\n  border-color: rgba(44,167,199,.27) !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-faq summary {\n  color: #233845 !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-faq summary::after {\n  color: #4e8295 !important;\n}\n\nhtml[data-theme="light"] body.mf-hiw-page .mf-hiw-faq details p {\n  color: #687d89 !important;\n}\n/* ===== /MEMEFLOW_HIW_LIGHT_SURFACES_V2 ===== */\n'

def die(msg):
    print(f"[HIW LIGHT SURFACES V2] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

if not THEME.exists():
    die(f"missing {THEME}")
if not PAGE.exists():
    die(f"missing {PAGE}")

theme_before = THEME.read_text(encoding="utf-8")
page_before = PAGE.read_text(encoding="utf-8")

if START in theme_before:
    print("[HIW LIGHT SURFACES V2] already installed")
    raise SystemExit(0)

# Refuse to stack on top of the failed V1 if it is somehow still active.
if "hiw-light-dark-blocks-v1.js" in page_before:
    die("failed V1 is still active; run rollback_hiw_light_dark_blocks_v1.py first")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".hiw-light-surfaces-v2-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)
shutil.copy2(THEME, backup / "memeflow-theme.css")
shutil.copy2(PAGE, backup / "how-it-works.html")

THEME.write_text(theme_before.rstrip() + "\n\n" + CSS, encoding="utf-8")

new_url = "/memeflow-theme.css?v=light-theme-v1-hiw-surfaces-v2-20260830"
page_after, count = re.subn(
    r'/memeflow-theme\.css\?v=[^"\']+',
    new_url,
    page_before,
    count=1
)
if count == 0:
    die("theme stylesheet link not found in how-it-works.html")

PAGE.write_text(page_after, encoding="utf-8")

rollback = ROOT / "rollback_hiw_light_surfaces_v2.py"
rollback.write_text(
    """#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / %r

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in ("memeflow-theme.css", "how-it-works.html"):
    src = BACKUP / name
    dst = APP / name
    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))
    shutil.copy2(src, dst)

print("[HIW LIGHT SURFACES V2] ROLLED BACK")
print("[HIW LIGHT SURFACES V2] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[HIW LIGHT SURFACES V2] INSTALLED")
print("[HIW LIGHT SURFACES V2] exact parent selectors only")
print("[HIW LIGHT SURFACES V2] changed: map detail, control cards, Important Distinction, FAQ")
print("[HIW LIGHT SURFACES V2] layout / spacing / header divider untouched")
print("[HIW LIGHT SURFACES V2] Dark theme untouched")
print("[HIW LIGHT SURFACES V2] backup:", backup)
print("[HIW LIGHT SURFACES V2] rollback: python3 rollback_hiw_light_surfaces_v2.py")
