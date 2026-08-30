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
SCRIPT = APP / "open-position-badge-unify-v2.js"

CSS_MARKER = "/* ===== MEMEFLOW_TRADING_OPEN_POSITION_BADGE_UNIFY_V2 ===== */"
SCRIPT_MARKER = "data-mf-open-position-badge-v2-scan"
CSS = '/* ===== MEMEFLOW_TRADING_OPEN_POSITION_BADGE_UNIFY_V2 ===== */\n/*\n  V2: enforce one visual rule for OPEN POSITION badges on Trading Terminal.\n  Fixes the chart/header badge so it matches the candidates badge and stays on one line.\n  Only OPEN POSITION badges are affected.\n*/\n\nhtml[data-theme="light"] [data-mf-open-position-badge-v2="1"] {\n  display: inline-flex !important;\n  flex-direction: row !important;\n  flex-wrap: nowrap !important;\n  align-items: center !important;\n  justify-content: center !important;\n  gap: 0 !important;\n  width: fit-content !important;\n  max-width: none !important;\n  min-width: 0 !important;\n  height: auto !important;\n  min-height: 30px !important;\n  padding: 0 12px !important;\n  border-radius: 999px !important;\n  border: 1px solid rgba(224, 176, 58, .42) !important;\n  background: rgba(236, 199, 97, .16) !important;\n  color: #b07a12 !important;\n  font-size: 12px !important;\n  line-height: 1 !important;\n  font-weight: 760 !important;\n  letter-spacing: .05em !important;\n  text-transform: uppercase !important;\n  text-decoration: none !important;\n  white-space: nowrap !important;\n  box-shadow: none !important;\n  overflow: visible !important;\n  vertical-align: middle !important;\n}\n\nhtml[data-theme="light"] [data-mf-open-position-badge-v2="1"] * {\n  display: inline !important;\n  width: auto !important;\n  max-width: none !important;\n  min-width: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  border: 0 !important;\n  background: transparent !important;\n  color: inherit !important;\n  font: inherit !important;\n  line-height: 1 !important;\n  letter-spacing: inherit !important;\n  text-transform: inherit !important;\n  white-space: nowrap !important;\n  box-shadow: none !important;\n}\n\nhtml:not([data-theme="light"]) [data-mf-open-position-badge-v2="1"] {\n  display: inline-flex !important;\n  flex-direction: row !important;\n  flex-wrap: nowrap !important;\n  align-items: center !important;\n  justify-content: center !important;\n  gap: 0 !important;\n  width: fit-content !important;\n  max-width: none !important;\n  min-width: 0 !important;\n  height: auto !important;\n  min-height: 30px !important;\n  padding: 0 12px !important;\n  border-radius: 999px !important;\n  border: 1px solid rgba(232, 187, 74, .28) !important;\n  background: rgba(233, 188, 73, .12) !important;\n  color: #f0ca72 !important;\n  font-size: 12px !important;\n  line-height: 1 !important;\n  font-weight: 760 !important;\n  letter-spacing: .05em !important;\n  text-transform: uppercase !important;\n  text-decoration: none !important;\n  white-space: nowrap !important;\n  box-shadow: none !important;\n  overflow: visible !important;\n  vertical-align: middle !important;\n}\n\nhtml:not([data-theme="light"]) [data-mf-open-position-badge-v2="1"] * {\n  display: inline !important;\n  width: auto !important;\n  max-width: none !important;\n  min-width: 0 !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  border: 0 !important;\n  background: transparent !important;\n  color: inherit !important;\n  font: inherit !important;\n  line-height: 1 !important;\n  letter-spacing: inherit !important;\n  text-transform: inherit !important;\n  white-space: nowrap !important;\n  box-shadow: none !important;\n}\n/* ===== /MEMEFLOW_TRADING_OPEN_POSITION_BADGE_UNIFY_V2 ===== */\n'
JS = "(() => {\n  const ATTR = 'data-mf-open-position-badge-v2';\n  const SENTINEL = 'data-mf-open-position-badge-v2-scan';\n\n  function norm(value) {\n    return String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();\n  }\n\n  function isVisible(el) {\n    if (!el || !el.isConnected) return false;\n    const rect = el.getBoundingClientRect();\n    return rect.width > 0 && rect.height > 0;\n  }\n\n  function eligible(el) {\n    if (!isVisible(el)) return false;\n    const tag = (el.tagName || '').toLowerCase();\n    if (['html', 'body', 'script', 'style', 'svg', 'path'].includes(tag)) return false;\n    const text = norm(el.textContent);\n    if (text !== 'open position') return false;\n    const rect = el.getBoundingClientRect();\n    if (rect.width > 280 || rect.height > 64) return false;\n    return true;\n  }\n\n  function scan() {\n    const all = Array.from(document.querySelectorAll('body *'));\n    const matches = all.filter(eligible);\n\n    for (const el of all) {\n      if (el.hasAttribute(ATTR)) el.removeAttribute(ATTR);\n    }\n\n    for (const el of matches) {\n      const hasEligibleChild = Array.from(el.children).some(eligible);\n      if (!hasEligibleChild) {\n        el.setAttribute(ATTR, '1');\n      }\n    }\n\n    document.documentElement.setAttribute(SENTINEL, '1');\n  }\n\n  let raf = 0;\n  function schedule() {\n    if (raf) return;\n    raf = requestAnimationFrame(() => {\n      raf = 0;\n      scan();\n    });\n  }\n\n  if (document.readyState === 'loading') {\n    document.addEventListener('DOMContentLoaded', schedule, { once: true });\n  } else {\n    schedule();\n  }\n\n  const startObserver = () => {\n    const root = document.body || document.documentElement;\n    if (!root) return;\n    const obs = new MutationObserver(schedule);\n    obs.observe(root, { childList: true, subtree: true, characterData: true, attributes: true });\n  };\n  startObserver();\n\n  window.addEventListener('load', schedule, { passive: true });\n  window.addEventListener('pageshow', schedule, { passive: true });\n})();"

def die(msg):
    print(f"[TRADING OPEN POSITION BADGE V2] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

for path in (THEME, HTML):
    if not path.exists():
        die(f"missing {path}")

theme_before = THEME.read_text(encoding="utf-8")
html_before = HTML.read_text(encoding="utf-8")
script_before = SCRIPT.read_text(encoding="utf-8") if SCRIPT.exists() else ""

if CSS_MARKER in theme_before or SCRIPT_MARKER in script_before or "open-position-badge-unify-v2.js" in html_before:
    print("[TRADING OPEN POSITION BADGE V2] already installed")
    raise SystemExit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".trading-open-position-badge-v2-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

for path in (THEME, HTML):
    shutil.copy2(path, backup / path.name)
if SCRIPT.exists():
    shutil.copy2(SCRIPT, backup / SCRIPT.name)

THEME.write_text(theme_before.rstrip() + "\n\n" + CSS, encoding="utf-8")
SCRIPT.write_text(JS, encoding="utf-8")

if "</body>" not in html_before.lower():
    die("cannot find </body> in trading.html")

script_tag = '\n<script src="/open-position-badge-unify-v2.js?v=20260830-v2"></script>\n'
idx = html_before.lower().rfind("</body>")
html_after = html_before[:idx] + script_tag + html_before[idx:]

html_after, css_count = re.subn(
    r'/memeflow-theme\.css\?v=[^"\']+',
    '/memeflow-theme.css?v=light-theme-v1-trading-open-position-badge-v2-20260830',
    html_after,
    count=1
)
if css_count == 0:
    die("memeflow-theme.css link not found in trading.html")

HTML.write_text(html_after, encoding="utf-8")

rollback = ROOT / "rollback_trading_open_position_badge_v2.py"
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

src_js = BACKUP / "open-position-badge-unify-v2.js"
dst_js = APP / "open-position-badge-unify-v2.js"
if src_js.exists():
    shutil.copy2(src_js, dst_js)
elif dst_js.exists():
    dst_js.unlink()

print("[TRADING OPEN POSITION BADGE V2] ROLLED BACK")
print("[TRADING OPEN POSITION BADGE V2] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[TRADING OPEN POSITION BADGE V2] INSTALLED")
print("[TRADING OPEN POSITION BADGE V2] changed: fixes chart/header OPEN POSITION badge to match page-wide rule")
print("[TRADING OPEN POSITION BADGE V2] scope: Trading Terminal only")
print("[TRADING OPEN POSITION BADGE V2] keeps one rule for all OPEN POSITION badges")
print("[TRADING OPEN POSITION BADGE V2] backup:", backup)
print("[TRADING OPEN POSITION BADGE V2] rollback: python3 rollback_trading_open_position_badge_v2.py")
