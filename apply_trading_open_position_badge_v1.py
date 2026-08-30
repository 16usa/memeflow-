#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
THEME = APP / "memeflow-theme.css"
HTML = APP / "trading.html"
SCRIPT = APP / "open-position-badge-unify-v1.js"

CSS_MARKER = "/* ===== MEMEFLOW_TRADING_OPEN_POSITION_BADGE_UNIFY_V1 ===== */"
SCRIPT_MARKER = "data-mf-open-position-badge-scan-v1"
CSS = '/* ===== MEMEFLOW_TRADING_OPEN_POSITION_BADGE_UNIFY_V1 ===== */\n/*\n  Trading Terminal: one visual rule for every OPEN POSITION badge on this page.\n  This targets badges marked by open-position-badge-unify-v1.js.\n  Layout, logic, and all non-OPEN-POSITION badges remain untouched.\n*/\n\nhtml[data-theme="light"] [data-mf-open-position-badge="1"] {\n  display: inline-flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n  min-height: 22px !important;\n  padding: 0 9px !important;\n  border-radius: 999px !important;\n  border: 1px solid rgba(220, 169, 46, .34) !important;\n  background: rgba(233, 188, 73, .14) !important;\n  color: #8a6518 !important;\n  font-weight: 760 !important;\n  letter-spacing: .05em !important;\n  text-transform: uppercase !important;\n  box-shadow: none !important;\n}\n\nhtml:not([data-theme="light"]) [data-mf-open-position-badge="1"] {\n  display: inline-flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n  min-height: 22px !important;\n  padding: 0 9px !important;\n  border-radius: 999px !important;\n  border: 1px solid rgba(232, 187, 74, .26) !important;\n  background: rgba(233, 188, 73, .11) !important;\n  color: #f0ca72 !important;\n  font-weight: 760 !important;\n  letter-spacing: .05em !important;\n  text-transform: uppercase !important;\n  box-shadow: none !important;\n}\n/* ===== /MEMEFLOW_TRADING_OPEN_POSITION_BADGE_UNIFY_V1 ===== */\n'
JS = "(() => {\n  const ATTR = 'data-mf-open-position-badge';\n  const SENTINEL = 'data-mf-open-position-badge-scan-v1';\n\n  function norm(value) {\n    return String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();\n  }\n\n  function shouldMark(el) {\n    if (!el || !el.isConnected) return false;\n    const text = norm(el.textContent);\n    if (text !== 'open position') return false;\n    if (el.children.length > 0) return false;\n\n    const rect = el.getBoundingClientRect();\n    if (rect.width <= 0 || rect.height <= 0) return false;\n    if (rect.width > 220 || rect.height > 42) return false;\n    return true;\n  }\n\n  function scan() {\n    const all = document.querySelectorAll('body *');\n    for (const el of all) {\n      if (shouldMark(el)) {\n        el.setAttribute(ATTR, '1');\n      } else if (el.hasAttribute(ATTR) && norm(el.textContent) !== 'open position') {\n        el.removeAttribute(ATTR);\n      }\n    }\n    document.documentElement.setAttribute(SENTINEL, '1');\n  }\n\n  let raf = 0;\n  function schedule() {\n    if (raf) return;\n    raf = requestAnimationFrame(() => {\n      raf = 0;\n      scan();\n    });\n  }\n\n  if (document.readyState === 'loading') {\n    document.addEventListener('DOMContentLoaded', schedule, { once: true });\n  } else {\n    schedule();\n  }\n\n  const obs = new MutationObserver(schedule);\n  obs.observe(document.body || document.documentElement, {\n    childList: true,\n    subtree: true,\n    characterData: true\n  });\n\n  window.addEventListener('load', schedule, { passive: true });\n  window.addEventListener('pageshow', schedule, { passive: true });\n})();"

def die(msg):
    print(f"[TRADING OPEN POSITION BADGE V1] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

for path in (THEME, HTML):
    if not path.exists():
        die(f"missing {path}")

theme_before = THEME.read_text(encoding="utf-8")
html_before = HTML.read_text(encoding="utf-8")
script_before = SCRIPT.read_text(encoding="utf-8") if SCRIPT.exists() else ""

if CSS_MARKER in theme_before or SCRIPT_MARKER in script_before or "open-position-badge-unify-v1.js" in html_before:
    print("[TRADING OPEN POSITION BADGE V1] already installed")
    raise SystemExit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".trading-open-position-badge-v1-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

for path in (THEME, HTML):
    shutil.copy2(path, backup / path.name)
if SCRIPT.exists():
    shutil.copy2(SCRIPT, backup / SCRIPT.name)

THEME.write_text(theme_before.rstrip() + "\n\n" + CSS, encoding="utf-8")
SCRIPT.write_text(JS, encoding="utf-8")

if "</body>" not in html_before.lower():
    die("cannot find </body> in trading.html")

script_tag = '\n<script src="/open-position-badge-unify-v1.js?v=20260830-v1"></script>\n'
idx = html_before.lower().rfind("</body>")
html_after = html_before[:idx] + script_tag + html_before[idx:]

html_after, css_count = re.subn(
    r'/memeflow-theme\.css\?v=[^"\']+',
    '/memeflow-theme.css?v=light-theme-v1-trading-open-position-badge-v1-20260830',
    html_after,
    count=1
)
if css_count == 0:
    die("memeflow-theme.css link not found in trading.html")

HTML.write_text(html_after, encoding="utf-8")

rollback = ROOT / "rollback_trading_open_position_badge_v1.py"
rollback.write_text(
    """#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / %r

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
""" % backup.name,
    encoding="utf-8"
)

print("[TRADING OPEN POSITION BADGE V1] INSTALLED")
print("[TRADING OPEN POSITION BADGE V1] changed: unify OPEN POSITION badge on Trading Terminal")
print("[TRADING OPEN POSITION BADGE V1] scope: chart + candidates + any other OPEN POSITION badge on this page")
print("[TRADING OPEN POSITION BADGE V1] other badges untouched")
print("[TRADING OPEN POSITION BADGE V1] backup:", backup)
print("[TRADING OPEN POSITION BADGE V1] rollback: python3 rollback_trading_open_position_badge_v1.py")
