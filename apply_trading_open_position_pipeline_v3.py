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

OLD_V1_JS = APP / "open-position-badge-unify-v1.js"
OLD_V2_JS = APP / "open-position-badge-unify-v2.js"
NEW_JS = APP / "open-position-pipeline-v3.js"

NEW_CSS_MARKER = "/* ===== MEMEFLOW_TRADING_OPEN_POSITION_PIPELINE_V3 ===== */"
NEW_SCRIPT_NAME = "open-position-pipeline-v3.js"

CSS = '/* ===== MEMEFLOW_TRADING_OPEN_POSITION_PIPELINE_V3 ===== */\n/*\n  Trading Terminal OPEN POSITION badge.\n  Canonical source: Real-Time Pipeline / system-tokens.css\n    .token-state.open:\n      color: #4de6a1;\n      border-color: rgba(77,230,161,.72);\n      background: rgba(77,230,161,.07);\n  Mobile token-state geometry:\n      height: 21px;\n      padding: 0 6px;\n*/\n\n[data-mf-open-position-pipeline-v3="1"] {\n  flex: none !important;\n\n  height: 21px !important;\n  min-height: 21px !important;\n  width: auto !important;\n  min-width: 0 !important;\n  max-width: none !important;\n\n  display: inline-flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n\n  padding: 0 6px !important;\n  margin: 0 !important;\n\n  border: 1px solid rgba(77, 230, 161, .72) !important;\n  border-radius: 6px !important;\n\n  background: rgba(77, 230, 161, .07) !important;\n  color: #4de6a1 !important;\n\n  font-size: var(--mf-type-micro, 10px) !important;\n  font-weight: 900 !important;\n  line-height: 1 !important;\n  letter-spacing: .07em !important;\n  text-transform: uppercase !important;\n\n  white-space: nowrap !important;\n  overflow: visible !important;\n\n  box-shadow: none !important;\n}\n\n[data-mf-open-position-pipeline-v3="1"] * {\n  display: inline !important;\n  width: auto !important;\n  min-width: 0 !important;\n  max-width: none !important;\n  height: auto !important;\n  min-height: 0 !important;\n\n  margin: 0 !important;\n  padding: 0 !important;\n\n  border: 0 !important;\n  background: transparent !important;\n  color: inherit !important;\n\n  font: inherit !important;\n  line-height: 1 !important;\n  letter-spacing: inherit !important;\n  text-transform: inherit !important;\n  white-space: nowrap !important;\n\n  box-shadow: none !important;\n}\n/* ===== /MEMEFLOW_TRADING_OPEN_POSITION_PIPELINE_V3 ===== */\n'
JS = "(() => {\n  const ATTR = 'data-mf-open-position-pipeline-v3';\n\n  function normalize(value) {\n    return String(value || '')\n      .replace(/\\s+/g, ' ')\n      .trim()\n      .toUpperCase();\n  }\n\n  function visible(el) {\n    if (!el || !el.isConnected) return false;\n    const rect = el.getBoundingClientRect();\n    return rect.width > 0 && rect.height > 0;\n  }\n\n  function isCandidate(el) {\n    if (!visible(el)) return false;\n\n    const tag = String(el.tagName || '').toUpperCase();\n    if (['HTML','BODY','SCRIPT','STYLE','SVG','PATH'].includes(tag)) return false;\n\n    if (normalize(el.textContent) !== 'OPEN POSITION') return false;\n\n    const rect = el.getBoundingClientRect();\n\n    // Status badges only; never mark a large container.\n    if (rect.width > 220 || rect.height > 60) return false;\n\n    return true;\n  }\n\n  function scan() {\n    const all = Array.from(document.querySelectorAll('body *'));\n\n    for (const el of all) {\n      if (el.hasAttribute(ATTR)) {\n        el.removeAttribute(ATTR);\n      }\n    }\n\n    const matches = all.filter(isCandidate);\n\n    // Mark the smallest matching node, not a wrapping container.\n    for (const el of matches) {\n      const matchingChild =\n        Array.from(el.children).some(child => isCandidate(child));\n\n      if (!matchingChild) {\n        el.setAttribute(ATTR, '1');\n      }\n    }\n  }\n\n  let raf = 0;\n\n  function schedule() {\n    if (raf) return;\n\n    raf = requestAnimationFrame(() => {\n      raf = 0;\n      scan();\n    });\n  }\n\n  if (document.readyState === 'loading') {\n    document.addEventListener('DOMContentLoaded', schedule, { once: true });\n  } else {\n    schedule();\n  }\n\n  const startObserver = () => {\n    const root = document.body || document.documentElement;\n    if (!root) return;\n\n    const observer = new MutationObserver(schedule);\n\n    observer.observe(root, {\n      childList: true,\n      subtree: true,\n      characterData: true\n    });\n  };\n\n  startObserver();\n\n  window.addEventListener('load', schedule, { passive: true });\n  window.addEventListener('pageshow', schedule, { passive: true });\n})();"

OLD_BLOCKS = [
    (
        "/* ===== MEMEFLOW_TRADING_OPEN_POSITION_BADGE_UNIFY_V1 ===== */",
        "/* ===== /MEMEFLOW_TRADING_OPEN_POSITION_BADGE_UNIFY_V1 ===== */"
    ),
    (
        "/* ===== MEMEFLOW_TRADING_OPEN_POSITION_BADGE_UNIFY_V2 ===== */",
        "/* ===== /MEMEFLOW_TRADING_OPEN_POSITION_BADGE_UNIFY_V2 ===== */"
    ),
]

def die(msg):
    print(f"[TRADING OPEN POSITION PIPELINE V3] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

for path in (THEME, HTML):
    if not path.exists():
        die(f"missing {path}")

theme_before = THEME.read_text(encoding="utf-8")
html_before = HTML.read_text(encoding="utf-8")

if NEW_CSS_MARKER in theme_before or NEW_SCRIPT_NAME in html_before:
    print("[TRADING OPEN POSITION PIPELINE V3] already installed")
    raise SystemExit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".trading-open-position-pipeline-v3-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

# Backup every file this patch may modify/remove.
for path in (THEME, HTML, OLD_V1_JS, OLD_V2_JS, NEW_JS):
    if path.exists():
        shutil.copy2(path, backup / path.name)

# Remove old V1/V2 CSS blocks cleanly.
theme_after = theme_before

for start, end in OLD_BLOCKS:
    pattern = re.compile(
        re.escape(start) + r".*?" + re.escape(end) + r"\s*",
        re.S
    )
    theme_after = pattern.sub("", theme_after)

theme_after = theme_after.rstrip() + "\n\n" + CSS
THEME.write_text(theme_after, encoding="utf-8")

# Remove old V1/V2 script tags from Trading Terminal.
html_after = html_before

html_after = re.sub(
    r'\s*<script[^>]+src=["\']/open-position-badge-unify-v1\.js[^"\']*["\'][^>]*></script>\s*',
    "\n",
    html_after,
    flags=re.I
)

html_after = re.sub(
    r'\s*<script[^>]+src=["\']/open-position-badge-unify-v2\.js[^"\']*["\'][^>]*></script>\s*',
    "\n",
    html_after,
    flags=re.I
)

if "</body>" not in html_after.lower():
    die("cannot find </body> in trading.html")

idx = html_after.lower().rfind("</body>")
script_tag = '\n<script src="/open-position-pipeline-v3.js?v=20260830-v3"></script>\n'
html_after = html_after[:idx] + script_tag + html_after[idx:]

# Cache-bust global theme on Trading Terminal only.
html_after, count = re.subn(
    r'/memeflow-theme\.css\?v=[^"\']+',
    '/memeflow-theme.css?v=light-theme-v1-open-position-pipeline-v3-20260830',
    html_after,
    count=1
)

if count == 0:
    die("memeflow-theme.css link not found in trading.html")

HTML.write_text(html_after, encoding="utf-8")
NEW_JS.write_text(JS, encoding="utf-8")

# Old scripts are no longer active and are removed from the working tree.
for old in (OLD_V1_JS, OLD_V2_JS):
    if old.exists():
        old.unlink()

rollback = ROOT / "rollback_trading_open_position_pipeline_v3.py"

rollback.write_text(
    """#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / %r

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

# Restore mandatory files.
for name in ("memeflow-theme.css", "trading.html"):
    src = BACKUP / name
    dst = APP / name

    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))

    shutil.copy2(src, dst)

# Restore/remove optional JS files to exactly match pre-patch state.
for name in (
    "open-position-badge-unify-v1.js",
    "open-position-badge-unify-v2.js",
    "open-position-pipeline-v3.js"
):
    src = BACKUP / name
    dst = APP / name

    if src.exists():
        shutil.copy2(src, dst)
    elif dst.exists():
        dst.unlink()

print("[TRADING OPEN POSITION PIPELINE V3] ROLLED BACK")
print("[TRADING OPEN POSITION PIPELINE V3] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[TRADING OPEN POSITION PIPELINE V3] INSTALLED")
print("[TRADING OPEN POSITION PIPELINE V3] removed: old V1/V2 badge overrides")
print("[TRADING OPEN POSITION PIPELINE V3] source: Real-Time Pipeline .token-state.open")
print("[TRADING OPEN POSITION PIPELINE V3] size: 21px high / 0 6px padding / 6px radius")
print("[TRADING OPEN POSITION PIPELINE V3] color: #4de6a1")
print("[TRADING OPEN POSITION PIPELINE V3] scope: OPEN POSITION badges on Trading Terminal only")
print("[TRADING OPEN POSITION PIPELINE V3] backup:", backup)
print("[TRADING OPEN POSITION PIPELINE V3] rollback: python3 rollback_trading_open_position_pipeline_v3.py")
