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
SCRIPT = APP / "settings-light-actions-v1.js"

CSS_MARKER = "/* ===== MEMEFLOW_SETTINGS_LIGHT_ACTIONS_V1 ===== */"
SCRIPT_NAME = "settings-light-actions-v1.js"

CSS = '/* ===== MEMEFLOW_SETTINGS_LIGHT_ACTIONS_V1 ===== */\n/*\n  System Settings · Light mode only.\n  Fixes only these visible controls:\n    - Review manually\n    - Pause new entries\n    - Emergency entry lock · OFF\n    - Restore defaults\n  No behavior, disabled state, layout, spacing, or Dark-theme changes.\n*/\n\nhtml[data-theme="light"] body.mf-settings-standalone\n[data-mf-settings-action-light="neutral-disabled"] {\n  background: rgba(239,243,246,.96) !important;\n  border: 1px solid rgba(91,113,126,.16) !important;\n  color: #6f858f !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] body.mf-settings-standalone\n[data-mf-settings-action-light="neutral-disabled"]:disabled {\n  opacity: 1 !important;\n  cursor: default !important;\n}\n\nhtml[data-theme="light"] body.mf-settings-standalone\n[data-mf-settings-action-light="emergency-off"] {\n  background: rgba(255,102,121,.055) !important;\n  border: 1px solid rgba(255,102,121,.20) !important;\n  color: #d45f70 !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] body.mf-settings-standalone\n#mf293RestoreDefaults {\n  background:\n    linear-gradient(180deg, rgba(255,255,255,.94), rgba(242,246,248,.97)) !important;\n  border: 1px solid rgba(91,113,126,.17) !important;\n  color: #667d88 !important;\n  box-shadow: none !important;\n}\n\nhtml[data-theme="light"] body.mf-settings-standalone\n#mf293RestoreDefaults:disabled {\n  opacity: .58 !important;\n}\n/* ===== /MEMEFLOW_SETTINGS_LIGHT_ACTIONS_V1 ===== */\n'
JS = "(() => {\n  const ATTR = 'data-mf-settings-action-light';\n\n  const RULES = new Map([\n    ['review manually', 'neutral-disabled'],\n    ['pause new entries', 'neutral-disabled'],\n    ['emergency entry lock · off', 'emergency-off'],\n    ['emergency entry lock ·off', 'emergency-off'],\n    ['emergency entry lock off', 'emergency-off']\n  ]);\n\n  function norm(value) {\n    return String(value || '')\n      .replace(/\\s+/g, ' ')\n      .trim()\n      .toLowerCase();\n  }\n\n  function scan() {\n    const root =\n      document.querySelector('body.mf-settings-standalone') ||\n      document.body;\n\n    if (!root) return;\n\n    root.querySelectorAll('button').forEach(button => {\n      const key = norm(button.textContent);\n      const style = RULES.get(key);\n\n      if (style) {\n        button.setAttribute(ATTR, style);\n      } else if (button.hasAttribute(ATTR)) {\n        button.removeAttribute(ATTR);\n      }\n    });\n  }\n\n  let raf = 0;\n  function schedule() {\n    if (raf) return;\n    raf = requestAnimationFrame(() => {\n      raf = 0;\n      scan();\n    });\n  }\n\n  if (document.readyState === 'loading') {\n    document.addEventListener('DOMContentLoaded', schedule, { once: true });\n  } else {\n    schedule();\n  }\n\n  const root = document.body || document.documentElement;\n  if (root) {\n    new MutationObserver(schedule).observe(root, {\n      childList: true,\n      subtree: true,\n      characterData: true\n    });\n  }\n\n  window.addEventListener('pageshow', schedule, { passive: true });\n})();"

def die(msg):
    print(f"[SETTINGS LIGHT ACTIONS V1] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

for path in (CSS_FILE, PAGE):
    if not path.exists():
        die(f"missing {path}")

css_before = CSS_FILE.read_text(encoding="utf-8")
page_before = PAGE.read_text(encoding="utf-8")
script_before = SCRIPT.read_text(encoding="utf-8") if SCRIPT.exists() else ""

if CSS_MARKER in css_before or SCRIPT_NAME in page_before:
    print("[SETTINGS LIGHT ACTIONS V1] already installed")
    raise SystemExit(0)

# Safety checks against expected Settings structure.
if "#mf293RestoreDefaults" not in css_before and "mf293-secondary" not in css_before:
    die("expected Restore defaults styling not found in system.css")

if "</body>" not in page_before.lower():
    die("cannot find </body> in settings.html")

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".settings-light-actions-v1-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

shutil.copy2(CSS_FILE, backup / "system.css")
shutil.copy2(PAGE, backup / "settings.html")
if SCRIPT.exists():
    shutil.copy2(SCRIPT, backup / SCRIPT.name)

# Append a Light-only final layer.
CSS_FILE.write_text(css_before.rstrip() + "\n\n" + CSS, encoding="utf-8")
SCRIPT.write_text(JS, encoding="utf-8")

# Install the tiny marker script on Settings page only.
idx = page_before.lower().rfind("</body>")
script_tag = '\n<script src="/settings-light-actions-v1.js?v=20260830-v1"></script>\n'
page_after = page_before[:idx] + script_tag + page_before[idx:]

# Cache-bust system.css on Settings only.
page_after, count = re.subn(
    r'/system\.css\?v=[^"\']+',
    '/system.css?v=settings-light-actions-v1-20260830',
    page_after,
    count=1
)
if count == 0:
    die("system.css stylesheet link not found in settings.html")

PAGE.write_text(page_after, encoding="utf-8")

rollback = ROOT / "rollback_settings_light_actions_v1.py"
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

src_js = BACKUP / "settings-light-actions-v1.js"
dst_js = APP / "settings-light-actions-v1.js"

if src_js.exists():
    shutil.copy2(src_js, dst_js)
elif dst_js.exists():
    dst_js.unlink()

print("[SETTINGS LIGHT ACTIONS V1] ROLLED BACK")
print("[SETTINGS LIGHT ACTIONS V1] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[SETTINGS LIGHT ACTIONS V1] INSTALLED")
print("[SETTINGS LIGHT ACTIONS V1] Light only")
print("[SETTINGS LIGHT ACTIONS V1] fixed: Review manually / Pause new entries / Emergency lock OFF / Restore defaults")
print("[SETTINGS LIGHT ACTIONS V1] button behavior and disabled states untouched")
print("[SETTINGS LIGHT ACTIONS V1] Dark theme untouched")
print("[SETTINGS LIGHT ACTIONS V1] backup:", backup)
print("[SETTINGS LIGHT ACTIONS V1] rollback: python3 rollback_settings_light_actions_v1.py")
