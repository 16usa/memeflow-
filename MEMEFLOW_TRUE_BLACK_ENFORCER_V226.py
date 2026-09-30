#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
JS_NAME = "memeflow-true-black-enforcer-v226.js"
LINK_MARKER = "MEMEFLOW_TRUE_BLACK_ENFORCER_V226_ASSET"

def fail(msg):
    print(f"\n[FAIL] {msg}")
    sys.exit(1)

root = Path.cwd()
app = root / "memeflow-app"
if not app.is_dir() and root.name == "memeflow-app":
    app = root
if not app.is_dir():
    fail("memeflow-app not found. Run this from the existing Replit workspace Shell.")

try:
    origin = subprocess.check_output(
        ["git", "config", "--get", "remote.origin.url"],
        cwd=root,
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
except Exception:
    origin = ""

if origin and EXPECTED_REPO_FRAGMENT not in origin:
    fail(f"Unexpected git origin: {origin}")

html_names = [
    "index.html",
    "system.html",
    "system-tokens.html",
    "trading.html",
    "settings.html",
    "smart-vault.html",
    "how-it-works.html",
    "agent-performance.html",
    "owner-intelligence.html",
    "system-source.html",
    "x100.html",
]
html_paths = [app / name for name in html_names if (app / name).is_file()]
js_path = app / JS_NAME

runtime_js = r'''/* MEMEFLOW TRUE BLACK ENFORCER V226
   Runtime visual normalizer for DARK theme only.

   MEMEFLOW has multiple legacy/page-specific stylesheets with high-specificity
   !important dark-surface rules. A normal final stylesheet can still lose the
   cascade. This enforcer evaluates the actual computed color after all CSS has
   loaded, then uses inline !important only for neutral dark surfaces.

   Result:
   - neutral dark blocks become true #000000
   - gradients on those neutral structural surfaces are removed
   - semantic colored accents remain colored
   - every real CSS border becomes 0.5px
   - light theme restores the original inline values
*/
(() => {
  'use strict';

  if (window.__mfTrueBlackEnforcerV226) return;
  window.__mfTrueBlackEnforcerV226 = true;

  const root = document.documentElement;
  const touched = new Set();
  const saved = new WeakMap();
  let raf = 0;
  let timer = 0;

  const PROPS = [
    'background-color',
    'background-image',
    'box-shadow',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width'
  ];

  const structuralRe =
    /(panel|card|block|module|surface|shell|wrap|list|row|metric|toolbar|drawer|header|head|footer|strategy|candidate|approval|position|history|setting|vault|hiw|activity|infra|sidebar|terminal|selected-metrics|chart)/i;

  function remember(el) {
    if (saved.has(el)) return;
    const snap = {};
    for (const prop of PROPS) {
      snap[prop] = {
        value: el.style.getPropertyValue(prop),
        priority: el.style.getPropertyPriority(prop)
      };
    }
    saved.set(el, snap);
    touched.add(el);
  }

  function setImportant(el, prop, value) {
    remember(el);
    el.style.setProperty(prop, value, 'important');
  }

  function restore() {
    for (const el of touched) {
      if (!el || !el.style) continue;
      const snap = saved.get(el);
      if (!snap) continue;

      for (const prop of PROPS) {
        const prev = snap[prop];
        if (prev?.value) {
          el.style.setProperty(prop, prev.value, prev.priority || '');
        } else {
          el.style.removeProperty(prop);
        }
      }
    }
    touched.clear();
  }

  function parseColor(value) {
    const m = String(value || '').match(
      /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i
    );
    if (!m) return null;
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] == null ? 1 : Number(m[4])
    };
  }

  function isNeutralDark(color) {
    if (!color || !(color.a > 0)) return false;
    const max = Math.max(color.r, color.g, color.b);
    const min = Math.min(color.r, color.g, color.b);

    return max <= 58 && (max - min) <= 18;
  }

  function isStructural(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (
      tag === 'BODY' || tag === 'MAIN' || tag === 'SECTION' ||
      tag === 'ASIDE' || tag === 'HEADER' || tag === 'FOOTER' ||
      tag === 'NAV'
    ) return true;

    return structuralRe.test(
      `${el.id || ''} ${typeof el.className === 'string' ? el.className : ''}`
    );
  }

  function normalizeElement(el) {
    if (!el || el.nodeType !== 1) return;

    const cs = getComputedStyle(el);
    const bg = parseColor(cs.backgroundColor);
    const neutralDark = isNeutralDark(bg);
    const structural = isStructural(el);

    if (neutralDark) {
      setImportant(el, 'background-color', '#000000');

      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        setImportant(el, 'background-image', 'none');
      }

      if (cs.boxShadow && cs.boxShadow !== 'none' && structural) {
        setImportant(el, 'box-shadow', 'none');
      }
    } else if (
      structural &&
      cs.backgroundImage &&
      cs.backgroundImage !== 'none'
    ) {
      setImportant(el, 'background-color', '#000000');
      setImportant(el, 'background-image', 'none');
      setImportant(el, 'box-shadow', 'none');
    }

    const sides = ['Top', 'Right', 'Bottom', 'Left'];
    for (const side of sides) {
      const width = Number.parseFloat(cs[`border${side}Width`]) || 0;
      const style = cs[`border${side}Style`];

      if (width > 0 && style && style !== 'none' && style !== 'hidden') {
        setImportant(
          el,
          `border-${side.toLowerCase()}-width`,
          '0.5px'
        );
      }
    }
  }

  function enforce() {
    raf = 0;
    timer = 0;

    if (root.getAttribute('data-theme') === 'light') {
      restore();
      return;
    }

    remember(root);
    root.style.setProperty('background-color', '#000000', 'important');
    root.style.setProperty('background-image', 'none', 'important');

    normalizeElement(document.body);

    const all = document.body ? document.body.querySelectorAll('*') : [];
    for (const el of all) normalizeElement(el);
  }

  function schedule() {
    if (timer || raf) return;

    timer = window.setTimeout(() => {
      timer = 0;
      raf = requestAnimationFrame(enforce);
    }, 80);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enforce, { once: true });
  } else {
    enforce();
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
    childList: true,
    subtree: true
  });

  window.addEventListener('pageshow', schedule, { passive: true });
})();
'''

originals = {}
for p in html_paths:
    originals[p] = p.read_text(encoding="utf-8")
if js_path.exists():
    originals[js_path] = js_path.read_text(encoding="utf-8")

changed = False

if (not js_path.exists()) or js_path.read_text(encoding="utf-8") != runtime_js:
    js_path.write_text(runtime_js, encoding="utf-8")
    changed = True

script_block = (
    f'<!-- {LINK_MARKER} -->\n'
    f'<script src="/{JS_NAME}?v=226-20260928" defer></script>\n'
    f'<!-- /{LINK_MARKER} -->\n'
)

for path in html_paths:
    content = originals[path]
    if LINK_MARKER in content:
        continue

    idx = content.lower().rfind("</head>")
    if idx < 0:
        fail(f"</head> not found in {path}")

    content = content[:idx] + script_block + content[idx:]
    path.write_text(content, encoding="utf-8")
    changed = True

if not changed:
    print("\n[OK] V226 is already installed. No files changed.")
    sys.exit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = root / f".memeflow-true-black-enforcer-v226-backup-{stamp}"
backup_dir.mkdir(parents=True, exist_ok=False)

for path, content in originals.items():
    rel = path.relative_to(root)
    target = backup_dir / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")

try:
    subprocess.run(["node", "--check", str(js_path)], cwd=root, check=True)
except FileNotFoundError:
    print("[WARN] node is unavailable; JS syntax check skipped.")
except subprocess.CalledProcessError:
    fail("node --check failed. Restore from backup: " + str(backup_dir))

try:
    subprocess.run(
        ["git", "diff", "--check", "--", "memeflow-app"],
        cwd=root,
        check=True
    )
except Exception:
    print("[WARN] git diff --check could not run.")

print("\n[OK] MEMEFLOW TRUE BLACK ENFORCER V226 installed.")
print(f"[BACKUP] {backup_dir}")
print("\nV226 fixes the actual remaining problem:")
print("  • detects the final computed background after all old CSS has loaded")
print("  • neutral #0A / #111 / #171717 / blue-gray dark surfaces -> #000000")
print("  • neutral structural gradients -> removed")
print("  • semantic BUY READY / WATCH / LIVE / P&L colors remain colored")
print("  • every visible CSS border/divider -> 0.5px")
print("  • light theme restores original inline values")
print("\nNo process/server restart was performed.")
print("\nPush after visual check:")
files = [f"memeflow-app/{JS_NAME}"] + [
    str(p.relative_to(root)) for p in html_paths
]
print(
    "git add " + " ".join(files)
    + ' && git commit -m "Enforce true black dark surfaces at runtime" && git push'
)
