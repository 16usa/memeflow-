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

V1_CSS_START = "/* ===== MEMEFLOW_TOKEN_FLOW_TOOLBAR_STICKY_V1 ===== */"
V1_CSS_END = "/* ===== /MEMEFLOW_TOKEN_FLOW_TOOLBAR_STICKY_V1 ===== */"

V2_CSS_START = "/* ===== MEMEFLOW_TOKEN_FLOW_TOOLBAR_FIXED_LOCK_V2 ===== */"
V2_CSS_END = "/* ===== /MEMEFLOW_TOKEN_FLOW_TOOLBAR_FIXED_LOCK_V2 ===== */"

V2_JS_START = "/* ===== MEMEFLOW_TOKEN_FLOW_TOOLBAR_FIXED_LOCK_V2 ===== */"
V2_JS_END = "/* ===== /MEMEFLOW_TOKEN_FLOW_TOOLBAR_FIXED_LOCK_V2 ===== */"

V3_MARKER = "/* ===== MEMEFLOW_TOKEN_FLOW_TOOLBAR_PIN_V3 ===== */"

CSS_BLOCK = '/* ===== MEMEFLOW_TOKEN_FLOW_TOOLBAR_PIN_V3 ===== */\n/*\n  Token Flow controls pin V3.\n  Native sticky is intentionally disabled: JS pins the original toolbar\n  at its measured document position and keeps a spacer in normal flow.\n*/\n\n.flow-toolbar {\n  position: relative !important;\n  top: auto !important;\n}\n\n.mf-token-flow-toolbar-spacer-v3 {\n  display: none;\n  width: 100%;\n  height: 0;\n  min-height: 0;\n  margin: 0;\n  padding: 0;\n  border: 0;\n  pointer-events: none;\n}\n\n.mf-token-flow-toolbar-spacer-v3.is-active {\n  display: block;\n}\n\n.flow-toolbar.mf-token-flow-toolbar-pinned-v3 {\n  position: fixed !important;\n  top: var(--mf-token-flow-toolbar-top-v3, 0px) !important;\n  left: var(--mf-token-flow-toolbar-left-v3) !important;\n  right: auto !important;\n  bottom: auto !important;\n\n  width: var(--mf-token-flow-toolbar-width-v3) !important;\n  max-width: none !important;\n\n  margin: 0 !important;\n\n  z-index: 2147482500 !important;\n\n  box-sizing: border-box !important;\n  transform: none !important;\n  isolation: isolate;\n}\n\n/* Opaque canvas while cards scroll underneath. */\nhtml[data-theme="light"] .flow-toolbar.mf-token-flow-toolbar-pinned-v3 {\n  background: #f4f6f8 !important;\n}\n\nhtml[data-theme="dark"] .flow-toolbar.mf-token-flow-toolbar-pinned-v3,\nhtml:not([data-theme="light"]) .flow-toolbar.mf-token-flow-toolbar-pinned-v3 {\n  background: #0f141a !important;\n}\n\n/* SORT SMART remains part of the same pinned block. */\n.flow-toolbar.mf-token-flow-toolbar-pinned-v3 .mf-sort-toolbar-v25 {\n  position: relative;\n  z-index: 1;\n}\n\n/* ===== /MEMEFLOW_TOKEN_FLOW_TOOLBAR_PIN_V3 ===== */\n'
JS_BLOCK = "/* ===== MEMEFLOW_TOKEN_FLOW_TOOLBAR_PIN_V3 ===== */\n(() => {\n  const TOOLBAR_SELECTOR = '.flow-toolbar';\n  const PINNED_CLASS = 'mf-token-flow-toolbar-pinned-v3';\n  const SPACER_CLASS = 'mf-token-flow-toolbar-spacer-v3';\n\n  let toolbar = null;\n  let spacer = null;\n\n  let pinned = false;\n  let naturalTop = 0;\n  let raf = 0;\n  let outerHeight = 0;\n\n  function scrollTop() {\n    return Math.max(\n      0,\n      Number(window.pageYOffset) || 0,\n      Number(document.documentElement?.scrollTop) || 0,\n      Number(document.body?.scrollTop) || 0\n    );\n  }\n\n  function px(value) {\n    const n = Number.parseFloat(value);\n    return Number.isFinite(n) ? n : 0;\n  }\n\n  function visualTop() {\n    const vv = window.visualViewport;\n    return vv && Number.isFinite(vv.offsetTop)\n      ? Math.max(0, vv.offsetTop)\n      : 0;\n  }\n\n  function measureNaturalPosition() {\n    if (!toolbar || pinned) return;\n\n    const rect = toolbar.getBoundingClientRect();\n    const style = window.getComputedStyle(toolbar);\n\n    naturalTop = rect.top + scrollTop();\n\n    outerHeight =\n      rect.height +\n      px(style.marginTop) +\n      px(style.marginBottom);\n  }\n\n  function syncPinnedGeometry() {\n    if (!toolbar || !spacer || !pinned) return;\n\n    const holderRect = spacer.getBoundingClientRect();\n\n    toolbar.style.setProperty(\n      '--mf-token-flow-toolbar-top-v3',\n      `${Math.round(visualTop())}px`\n    );\n\n    toolbar.style.setProperty(\n      '--mf-token-flow-toolbar-left-v3',\n      `${Math.round(holderRect.left)}px`\n    );\n\n    toolbar.style.setProperty(\n      '--mf-token-flow-toolbar-width-v3',\n      `${Math.round(holderRect.width)}px`\n    );\n\n    const rect = toolbar.getBoundingClientRect();\n    const style = window.getComputedStyle(toolbar);\n\n    outerHeight =\n      rect.height +\n      px(style.marginTop) +\n      px(style.marginBottom);\n\n    spacer.style.height =\n      `${Math.ceil(outerHeight)}px`;\n  }\n\n  function pin() {\n    if (!toolbar || !spacer || pinned) return;\n\n    const rect = toolbar.getBoundingClientRect();\n    const style = window.getComputedStyle(toolbar);\n\n    outerHeight =\n      rect.height +\n      px(style.marginTop) +\n      px(style.marginBottom);\n\n    spacer.style.height =\n      `${Math.ceil(outerHeight)}px`;\n\n    spacer.classList.add('is-active');\n\n    const holderRect = spacer.getBoundingClientRect();\n\n    toolbar.style.setProperty(\n      '--mf-token-flow-toolbar-top-v3',\n      `${Math.round(visualTop())}px`\n    );\n\n    toolbar.style.setProperty(\n      '--mf-token-flow-toolbar-left-v3',\n      `${Math.round(holderRect.left)}px`\n    );\n\n    toolbar.style.setProperty(\n      '--mf-token-flow-toolbar-width-v3',\n      `${Math.round(holderRect.width)}px`\n    );\n\n    toolbar.classList.add(PINNED_CLASS);\n    pinned = true;\n\n    requestAnimationFrame(syncPinnedGeometry);\n  }\n\n  function unpin() {\n    if (!toolbar || !spacer || !pinned) return;\n\n    toolbar.classList.remove(PINNED_CLASS);\n\n    toolbar.style.removeProperty(\n      '--mf-token-flow-toolbar-top-v3'\n    );\n    toolbar.style.removeProperty(\n      '--mf-token-flow-toolbar-left-v3'\n    );\n    toolbar.style.removeProperty(\n      '--mf-token-flow-toolbar-width-v3'\n    );\n\n    spacer.classList.remove('is-active');\n    spacer.style.height = '0px';\n\n    pinned = false;\n\n    requestAnimationFrame(measureNaturalPosition);\n  }\n\n  function reconcile() {\n    raf = 0;\n\n    if (!toolbar || !spacer) return;\n\n    const y = scrollTop();\n\n    if (!pinned) {\n      /*\n        Re-measure while the toolbar is in normal flow.\n        This makes the threshold survive dynamic data above it.\n      */\n      measureNaturalPosition();\n\n      if (y >= naturalTop) {\n        pin();\n      }\n\n      return;\n    }\n\n    /*\n      Small hysteresis prevents boundary flicker.\n    */\n    if (y < naturalTop - 2) {\n      unpin();\n      return;\n    }\n\n    syncPinnedGeometry();\n  }\n\n  function schedule() {\n    if (raf) return;\n    raf = requestAnimationFrame(reconcile);\n  }\n\n  function init() {\n    toolbar = document.querySelector(TOOLBAR_SELECTOR);\n\n    if (!toolbar) {\n      console.warn(\n        '[TOKEN FLOW TOOLBAR PIN V3] .flow-toolbar not found'\n      );\n      return;\n    }\n\n    if (toolbar.dataset.mfToolbarPinV3 === '1') {\n      return;\n    }\n\n    spacer = document.createElement('div');\n    spacer.className = SPACER_CLASS;\n    spacer.setAttribute('aria-hidden', 'true');\n\n    toolbar.parentNode.insertBefore(\n      spacer,\n      toolbar.nextSibling\n    );\n\n    toolbar.dataset.mfToolbarPinV3 = '1';\n\n    /*\n      Listen to every scroll source that matters on iOS Safari.\n    */\n    window.addEventListener(\n      'scroll',\n      schedule,\n      { passive: true }\n    );\n\n    document.addEventListener(\n      'scroll',\n      schedule,\n      { passive: true, capture: true }\n    );\n\n    window.addEventListener(\n      'resize',\n      schedule,\n      { passive: true }\n    );\n\n    window.addEventListener(\n      'orientationchange',\n      schedule,\n      { passive: true }\n    );\n\n    if (window.visualViewport) {\n      window.visualViewport.addEventListener(\n        'scroll',\n        schedule,\n        { passive: true }\n      );\n\n      window.visualViewport.addEventListener(\n        'resize',\n        schedule,\n        { passive: true }\n      );\n    }\n\n    if ('ResizeObserver' in window) {\n      const observer = new ResizeObserver(() => {\n        if (pinned) {\n          syncPinnedGeometry();\n        } else {\n          measureNaturalPosition();\n        }\n      });\n\n      observer.observe(toolbar);\n    }\n\n    measureNaturalPosition();\n    schedule();\n\n    console.info(\n      '[TOKEN FLOW TOOLBAR PIN V3] ready',\n      { naturalTop }\n    );\n  }\n\n  if (document.readyState === 'loading') {\n    document.addEventListener(\n      'DOMContentLoaded',\n      () => requestAnimationFrame(init),\n      { once: true }\n    );\n  } else {\n    requestAnimationFrame(init);\n  }\n})();\n/* ===== /MEMEFLOW_TOKEN_FLOW_TOOLBAR_PIN_V3 ===== */\n"

def die(message):
    print(f"[TOKEN FLOW TOOLBAR PIN V3] ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)

def remove_marked(text, start, end):
    if start not in text:
        return text

    if end not in text:
        die("found start marker without end marker: " + start)

    pattern = (
        re.escape(start) +
        r".*?" +
        re.escape(end) +
        r"\s*"
    )

    return re.sub(
        pattern,
        "",
        text,
        flags=re.S
    )

for path in (CSS_FILE, JS_FILE, HTML_FILE):
    if not path.exists():
        die(f"missing {path}")

css_before = CSS_FILE.read_text(encoding="utf-8")
js_before = JS_FILE.read_text(encoding="utf-8")
html_before = HTML_FILE.read_text(encoding="utf-8")

# Verify the exact fresh structure that was pushed.
if 'class="flow-toolbar"' not in html_before:
    die("current .flow-toolbar HTML not found")

if ".flow-toolbar" not in css_before:
    die("current .flow-toolbar CSS not found")

if "__mfEnsureSortUiV25" not in js_before:
    die("current SORT SMART installer not found")

if V3_MARKER in css_before or V3_MARKER in js_before:
    print("[TOKEN FLOW TOOLBAR PIN V3] already installed")
    raise SystemExit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".token-flow-toolbar-pin-v3-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

for src in (CSS_FILE, JS_FILE, HTML_FILE):
    shutil.copy2(src, backup / src.name)

# Remove previous toolbar experiments only.
css_after = remove_marked(
    css_before,
    V1_CSS_START,
    V1_CSS_END
)

css_after = remove_marked(
    css_after,
    V2_CSS_START,
    V2_CSS_END
)

js_after = remove_marked(
    js_before,
    V2_JS_START,
    V2_JS_END
)

# Add one clean V3 owner.
css_after = (
    css_after.rstrip() +
    "\n\n" +
    CSS_BLOCK.strip() +
    "\n"
)

js_after = (
    js_after.rstrip() +
    "\n\n" +
    JS_BLOCK.strip() +
    "\n"
)

CSS_FILE.write_text(
    css_after,
    encoding="utf-8"
)

JS_FILE.write_text(
    js_after,
    encoding="utf-8"
)

# Bust only Token Flow CSS/JS caches.
html_after, css_count = re.subn(
    r'/system-tokens\.css(?:\?v=[^"\']+)?',
    '/system-tokens.css?v=token-flow-toolbar-pin-v3-20260830',
    html_before,
    count=1
)

html_after, js_count = re.subn(
    r'/system-tokens\.js(?:\?v=[^"\']+)?',
    '/system-tokens.js?v=token-flow-toolbar-pin-v3-20260830',
    html_after,
    count=1
)

if css_count != 1:
    die("system-tokens.css asset link not found exactly once")

if js_count != 1:
    die("system-tokens.js asset link not found exactly once")

HTML_FILE.write_text(
    html_after,
    encoding="utf-8"
)

rollback = ROOT / "rollback_token_flow_toolbar_pin_v3.py"

rollback.write_text(
    """#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / %r

if not BACKUP.exists():
    raise SystemExit(
        "Backup not found: " + str(BACKUP)
    )

for name in (
    "system-tokens.css",
    "system-tokens.js",
    "system-tokens.html",
):
    src = BACKUP / name
    dst = APP / name

    if not src.exists():
        raise SystemExit(
            "Backup file missing: " + str(src)
        )

    shutil.copy2(src, dst)

print("[TOKEN FLOW TOOLBAR PIN V3] ROLLED BACK")
print(
    "[TOKEN FLOW TOOLBAR PIN V3] restored:",
    BACKUP
)
""" % backup.name,
    encoding="utf-8"
)

print("[TOKEN FLOW TOOLBAR PIN V3] INSTALLED")
print("[TOKEN FLOW TOOLBAR PIN V3] verified current pushed Token Flow structure")
print("[TOKEN FLOW TOOLBAR PIN V3] removed old V1/V2 toolbar experiments")
print("[TOKEN FLOW TOOLBAR PIN V3] Search + Refresh + SORT SMART pin as one original DOM block")
print("[TOKEN FLOW TOOLBAR PIN V3] iOS: window + document + visualViewport scroll handled")
print("[TOKEN FLOW TOOLBAR PIN V3] spacer prevents layout jump")
print("[TOKEN FLOW TOOLBAR PIN V3] backup:", backup)
print("[TOKEN FLOW TOOLBAR PIN V3] rollback: python3 rollback_token_flow_toolbar_pin_v3.py")
