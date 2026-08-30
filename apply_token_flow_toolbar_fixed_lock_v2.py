#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"

CSS_FILE = APP / "system-tokens.css"
JS_FILE = APP / "system-tokens.js"
HTML_FILE = APP / "system-tokens.html"

V1_START = "/* ===== MEMEFLOW_TOKEN_FLOW_TOOLBAR_STICKY_V1 ===== */"
V1_END = "/* ===== /MEMEFLOW_TOKEN_FLOW_TOOLBAR_STICKY_V1 ===== */"

V2_CSS_START = "/* ===== MEMEFLOW_TOKEN_FLOW_TOOLBAR_FIXED_LOCK_V2 ===== */"
V2_JS_START = "/* ===== MEMEFLOW_TOKEN_FLOW_TOOLBAR_FIXED_LOCK_V2 ===== */"

CSS_BLOCK = '\n/* ===== MEMEFLOW_TOKEN_FLOW_TOOLBAR_FIXED_LOCK_V2 ===== */\n/*\n  Robust iOS/Safari lock for the complete Token Flow controls group.\n  JS moves .flow-toolbar to <body> only while it is pinned, so ancestor\n  overflow/transform/contain rules cannot defeat the lock.\n*/\n.mf-token-flow-toolbar-placeholder-v2 {\n  display: block;\n  width: 100%;\n  height: 0;\n  min-height: 0;\n  margin: 0;\n  padding: 0;\n  border: 0;\n  pointer-events: none;\n}\n\n.flow-toolbar.mf-token-flow-toolbar-fixed-v2 {\n  position: fixed !important;\n  top: 0 !important;\n  right: auto !important;\n  bottom: auto !important;\n  left: var(--mf-token-flow-toolbar-left-v2) !important;\n\n  width: var(--mf-token-flow-toolbar-width-v2) !important;\n  max-width: none !important;\n\n  margin: 0 !important;\n\n  z-index: 2147482500 !important;\n\n  box-sizing: border-box !important;\n  isolation: isolate;\n  transform: none !important;\n}\n\n/* Keep the dynamically injected SORT control inside the pinned surface. */\n.flow-toolbar.mf-token-flow-toolbar-fixed-v2 .mf-sort-toolbar-v25 {\n  position: relative;\n  z-index: 1;\n}\n/* ===== /MEMEFLOW_TOKEN_FLOW_TOOLBAR_FIXED_LOCK_V2 ===== */\n'
JS_BLOCK = "\n/* ===== MEMEFLOW_TOKEN_FLOW_TOOLBAR_FIXED_LOCK_V2 ===== */\n(() => {\n  const TOOLBAR_SELECTOR = '.flow-toolbar';\n  const FIXED_CLASS = 'mf-token-flow-toolbar-fixed-v2';\n  const PLACEHOLDER_CLASS = 'mf-token-flow-toolbar-placeholder-v2';\n\n  let toolbar = null;\n  let placeholder = null;\n  let homeParent = null;\n  let homeNextSibling = null;\n  let fixed = false;\n  let raf = 0;\n  let reservedSpace = 0;\n\n  const numberPx = (value) => {\n    const parsed = Number.parseFloat(value);\n    return Number.isFinite(parsed) ? parsed : 0;\n  };\n\n  function updatePlaceholderHeight() {\n    if (!toolbar || !placeholder || !fixed) return;\n\n    placeholder.style.height =\n      `${Math.ceil(toolbar.getBoundingClientRect().height + reservedSpace)}px`;\n  }\n\n  function syncFixedGeometry() {\n    if (!toolbar || !placeholder || !fixed) return;\n\n    const rect = placeholder.getBoundingClientRect();\n\n    toolbar.style.setProperty(\n      '--mf-token-flow-toolbar-left-v2',\n      `${Math.round(rect.left)}px`\n    );\n\n    toolbar.style.setProperty(\n      '--mf-token-flow-toolbar-width-v2',\n      `${Math.round(rect.width)}px`\n    );\n\n    updatePlaceholderHeight();\n  }\n\n  function lockToolbar() {\n    if (!toolbar || !placeholder || fixed) return;\n\n    const rect = toolbar.getBoundingClientRect();\n    const style = window.getComputedStyle(toolbar);\n\n    reservedSpace =\n      numberPx(style.marginTop) +\n      numberPx(style.marginBottom);\n\n    placeholder.style.height =\n      `${Math.ceil(rect.height + reservedSpace)}px`;\n\n    const holderRect = placeholder.getBoundingClientRect();\n\n    toolbar.style.setProperty(\n      '--mf-token-flow-toolbar-left-v2',\n      `${Math.round(holderRect.left)}px`\n    );\n\n    toolbar.style.setProperty(\n      '--mf-token-flow-toolbar-width-v2',\n      `${Math.round(holderRect.width)}px`\n    );\n\n    /*\n      Move the real interactive toolbar to body.\n      Inputs, Refresh and SORT listeners stay attached to the same DOM node.\n      This bypasses any ancestor overflow/transform containing block.\n    */\n    document.body.appendChild(toolbar);\n    toolbar.classList.add(FIXED_CLASS);\n\n    fixed = true;\n\n    requestAnimationFrame(syncFixedGeometry);\n  }\n\n  function unlockToolbar() {\n    if (!toolbar || !placeholder || !fixed) return;\n\n    toolbar.classList.remove(FIXED_CLASS);\n\n    toolbar.style.removeProperty('--mf-token-flow-toolbar-left-v2');\n    toolbar.style.removeProperty('--mf-token-flow-toolbar-width-v2');\n\n    if (\n      homeNextSibling &&\n      homeNextSibling.parentNode === homeParent\n    ) {\n      homeParent.insertBefore(toolbar, homeNextSibling);\n    } else {\n      homeParent.appendChild(toolbar);\n    }\n\n    placeholder.style.height = '0px';\n\n    fixed = false;\n    reservedSpace = 0;\n  }\n\n  function update() {\n    raf = 0;\n\n    if (!toolbar || !placeholder) return;\n\n    const triggerTop =\n      placeholder.getBoundingClientRect().top;\n\n    if (!fixed && triggerTop <= 0) {\n      lockToolbar();\n      return;\n    }\n\n    if (fixed && triggerTop > 0) {\n      unlockToolbar();\n      return;\n    }\n\n    if (fixed) {\n      syncFixedGeometry();\n    }\n  }\n\n  function scheduleUpdate() {\n    if (raf) return;\n    raf = requestAnimationFrame(update);\n  }\n\n  function init() {\n    toolbar = document.querySelector(TOOLBAR_SELECTOR);\n\n    if (!toolbar) {\n      console.warn(\n        '[TOKEN FLOW TOOLBAR FIXED LOCK V2] .flow-toolbar not found'\n      );\n      return;\n    }\n\n    if (toolbar.dataset.mfFixedLockV2 === '1') {\n      return;\n    }\n\n    homeParent = toolbar.parentNode;\n    homeNextSibling = toolbar.nextSibling;\n\n    if (!homeParent) return;\n\n    placeholder = document.createElement('div');\n    placeholder.className = PLACEHOLDER_CLASS;\n    placeholder.setAttribute('aria-hidden', 'true');\n\n    homeParent.insertBefore(placeholder, toolbar);\n\n    toolbar.dataset.mfFixedLockV2 = '1';\n\n    window.addEventListener(\n      'scroll',\n      scheduleUpdate,\n      { passive: true }\n    );\n\n    window.addEventListener(\n      'resize',\n      scheduleUpdate,\n      { passive: true }\n    );\n\n    window.addEventListener(\n      'orientationchange',\n      scheduleUpdate,\n      { passive: true }\n    );\n\n    if (window.visualViewport) {\n      window.visualViewport.addEventListener(\n        'resize',\n        scheduleUpdate,\n        { passive: true }\n      );\n    }\n\n    if ('ResizeObserver' in window) {\n      const observer = new ResizeObserver(() => {\n        if (fixed) {\n          syncFixedGeometry();\n        }\n      });\n\n      observer.observe(toolbar);\n      observer.observe(placeholder);\n    }\n\n    scheduleUpdate();\n\n    console.info(\n      '[TOKEN FLOW TOOLBAR FIXED LOCK V2] ready'\n    );\n  }\n\n  if (document.readyState === 'loading') {\n    document.addEventListener(\n      'DOMContentLoaded',\n      () => requestAnimationFrame(init),\n      { once: true }\n    );\n  } else {\n    requestAnimationFrame(init);\n  }\n})();\n/* ===== /MEMEFLOW_TOKEN_FLOW_TOOLBAR_FIXED_LOCK_V2 ===== */\n"

def die(message):
    print(f"[TOKEN FLOW TOOLBAR FIXED LOCK V2] ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)

for path in (CSS_FILE, JS_FILE, HTML_FILE):
    if not path.exists():
        die(f"missing {path}")

css_before = CSS_FILE.read_text(encoding="utf-8")
js_before = JS_FILE.read_text(encoding="utf-8")
html_before = HTML_FILE.read_text(encoding="utf-8")

# Verify the real current Token Flow structure before touching anything.
if ".flow-toolbar" not in css_before:
    die("expected .flow-toolbar CSS not found")

if 'class="flow-toolbar"' not in html_before:
    die("expected .flow-toolbar HTML not found")

if "__mfEnsureSortUiV25" not in js_before:
    die("expected current SORT UI installer not found")

if "searchRow.insertAdjacentElement('afterend',toolbar)" not in js_before:
    die("SORT is not being inserted into the expected toolbar structure")

if V2_CSS_START in css_before or V2_JS_START in js_before:
    print("[TOKEN FLOW TOOLBAR FIXED LOCK V2] already installed")
    raise SystemExit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".token-flow-toolbar-fixed-lock-v2-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

for src in (CSS_FILE, JS_FILE, HTML_FILE):
    shutil.copy2(src, backup / src.name)

# Remove the previous V1 experiment if it is present locally.
v1_pattern = re.compile(
    re.escape(V1_START) + r".*?" + re.escape(V1_END),
    re.S
)
css_clean = v1_pattern.sub("", css_before).rstrip()

CSS_FILE.write_text(
    css_clean + "\n\n" + CSS_BLOCK.strip() + "\n",
    encoding="utf-8"
)

JS_FILE.write_text(
    js_before.rstrip() + "\n\n" + JS_BLOCK.strip() + "\n",
    encoding="utf-8"
)

# Force Safari/Replit to load the new CSS + JS instead of cached V1 assets.
html_after = re.sub(
    r'/system-tokens\.css(?:\?v=[^"\']+)?',
    '/system-tokens.css?v=token-flow-toolbar-fixed-lock-v2-20260830',
    html_before,
    count=1
)

html_after = re.sub(
    r'/system-tokens\.js(?:\?v=[^"\']+)?',
    '/system-tokens.js?v=token-flow-toolbar-fixed-lock-v2-20260830',
    html_after,
    count=1
)

if html_after == html_before:
    die("could not cache-bust system-tokens assets")

HTML_FILE.write_text(html_after, encoding="utf-8")

rollback = ROOT / "rollback_token_flow_toolbar_fixed_lock_v2.py"
rollback.write_text(
    """#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / %r

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

for name in ("system-tokens.css", "system-tokens.js", "system-tokens.html"):
    src = BACKUP / name
    dst = APP / name

    if not src.exists():
        raise SystemExit("Backup file missing: " + str(src))

    shutil.copy2(src, dst)

print("[TOKEN FLOW TOOLBAR FIXED LOCK V2] ROLLED BACK")
print("[TOKEN FLOW TOOLBAR FIXED LOCK V2] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[TOKEN FLOW TOOLBAR FIXED LOCK V2] INSTALLED")
print("[TOKEN FLOW TOOLBAR FIXED LOCK V2] verified: Search + Refresh + SORT share .flow-toolbar")
print("[TOKEN FLOW TOOLBAR FIXED LOCK V2] old V1 sticky experiment removed if present")
print("[TOKEN FLOW TOOLBAR FIXED LOCK V2] behavior: toolbar locks to viewport after reaching top")
print("[TOKEN FLOW TOOLBAR FIXED LOCK V2] placeholder prevents card/page jump")
print("[TOKEN FLOW TOOLBAR FIXED LOCK V2] iOS/Safari ancestor overflow/transform bypassed")
print("[TOKEN FLOW TOOLBAR FIXED LOCK V2] backup:", backup)
print("[TOKEN FLOW TOOLBAR FIXED LOCK V2] rollback: python3 rollback_token_flow_toolbar_fixed_lock_v2.py")
