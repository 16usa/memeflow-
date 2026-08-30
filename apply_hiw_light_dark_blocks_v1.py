#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil
import sys

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
PAGE = APP / "how-it-works.html"
SCRIPT = APP / "hiw-light-dark-blocks-v1.js"

MARKER = "hiw-light-dark-blocks-v1.js"
JS = "(() => {\n  const LIGHT_ONLY = () => document.documentElement.getAttribute('data-theme') === 'light';\n\n  const STANDARD_PHRASES = [\n    'your wallet starts the relationship.',\n    'owner authority',\n    'on-chain gatekeeper',\n    'automation engine',\n    'funding your vault is not the same as paying memeflow.'\n  ];\n\n  const FAQ_PHRASES = [\n    'is a vault pda another normal wallet?',\n    'does memeflow get my connected wallet private key?',\n    'why move trading funds into a vault pda?',\n    'can the executor ignore my rules?',\n    'do users pay the smart vault deployment cost every time?',\n    'does this remove trading risk?'\n  ];\n\n  const SKIP_TAGS = new Set(['HTML', 'BODY', 'SCRIPT', 'STYLE', 'SVG', 'PATH', 'IMG', 'VIDEO', 'CANVAS']);\n  const ROOT_ATTR = 'data-hiw-light-dark-blocks-v1-root';\n  const STYLE_ATTR = 'data-hiw-light-dark-blocks-v1-style';\n\n  function norm(value) {\n    return String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();\n  }\n\n  function rememberStyle(el) {\n    if (!el.hasAttribute(STYLE_ATTR)) {\n      el.setAttribute(STYLE_ATTR, el.getAttribute('style') || '');\n    }\n  }\n\n  function applyStyles(el, styles) {\n    if (!el) return;\n    rememberStyle(el);\n    Object.assign(el.style, styles);\n  }\n\n  function restoreAll() {\n    document.querySelectorAll('[' + STYLE_ATTR + ']').forEach((el) => {\n      const prev = el.getAttribute(STYLE_ATTR);\n      if (prev) {\n        el.setAttribute('style', prev);\n      } else {\n        el.removeAttribute('style');\n      }\n      el.removeAttribute(STYLE_ATTR);\n      el.removeAttribute(ROOT_ATTR);\n    });\n  }\n\n  function textNodesContaining(phrase) {\n    const target = norm(phrase);\n    const all = Array.from(document.querySelectorAll('body *'));\n    return all\n      .filter((el) => {\n        if (!el || SKIP_TAGS.has(el.tagName)) return false;\n        if (!norm(el.textContent).includes(target)) return false;\n        const rect = el.getBoundingClientRect();\n        return rect.width > 20 && rect.height > 10;\n      })\n      .sort((a, b) => norm(a.textContent).length - norm(b.textContent).length);\n  }\n\n  function pickContainer(node) {\n    let el = node;\n    while (el && el !== document.body) {\n      const rect = el.getBoundingClientRect();\n      if (rect.width >= 240 && rect.height >= 70) return el;\n      el = el.parentElement;\n    }\n    return node && node.parentElement ? node.parentElement : node;\n  }\n\n  function findCards(phrases) {\n    const seen = new Set();\n    const cards = [];\n    phrases.forEach((phrase) => {\n      const node = textNodesContaining(phrase)[0];\n      if (!node) return;\n      const card = pickContainer(node);\n      if (!card || seen.has(card)) return;\n      seen.add(card);\n      cards.push(card);\n    });\n    return cards;\n  }\n\n  function isShortAccentText(text) {\n    const t = String(text || '').trim();\n    if (!t) return false;\n    const letters = t.replace(/[^A-Za-z]/g, '');\n    if (!letters) return false;\n    const upper = letters.replace(/[^A-Z]/g, '').length;\n    const upperRatio = upper / letters.length;\n    return t.length <= 32 && upperRatio >= 0.55;\n  }\n\n  function styleTextualDescendants(card, variant) {\n    const nodes = Array.from(card.querySelectorAll('*'));\n    nodes.forEach((el) => {\n      if (SKIP_TAGS.has(el.tagName)) return;\n      const text = (el.textContent || '').trim();\n      if (!text) return;\n\n      const fs = parseFloat(getComputedStyle(el).fontSize) || 0;\n      const fw = parseInt(getComputedStyle(el).fontWeight, 10) || 400;\n\n      if (/^[+＋]$/.test(text)) {\n        applyStyles(el, { color: '#66caee' });\n        return;\n      }\n      if (/^\\d{2}$/.test(text)) {\n        applyStyles(el, { color: '#4fcaf2', fontWeight: '820' });\n        return;\n      }\n      if (/^[✓✔]$/.test(text)) {\n        applyStyles(el, { color: '#4ad89a' });\n        return;\n      }\n      if (/^[✕✖×]$/.test(text)) {\n        applyStyles(el, { color: '#4ad89a' });\n        return;\n      }\n\n      if (fs >= 30 || fw >= 760) {\n        applyStyles(el, { color: '#162736' });\n        return;\n      }\n      if (fw >= 650 && fs >= 18) {\n        applyStyles(el, { color: '#223846' });\n        return;\n      }\n      if (isShortAccentText(text)) {\n        applyStyles(el, { color: '#5e7482' });\n        return;\n      }\n      if (variant === 'faq') {\n        applyStyles(el, { color: fw >= 600 ? '#2a3f4d' : '#6a7e89' });\n        return;\n      }\n      applyStyles(el, { color: '#6c808b' });\n    });\n  }\n\n  function styleFaqCard(card) {\n    card.setAttribute(ROOT_ATTR, 'faq');\n    applyStyles(card, {\n      background: 'linear-gradient(180deg, rgba(244,246,248,.98), rgba(238,242,245,.98))',\n      border: '1px solid rgba(96,112,122,.18)',\n      boxShadow: '0 10px 28px rgba(28, 42, 53, .04)',\n      color: '#233847'\n    });\n    styleTextualDescendants(card, 'faq');\n  }\n\n  function styleStandardCard(card) {\n    card.setAttribute(ROOT_ATTR, 'standard');\n    applyStyles(card, {\n      background: 'linear-gradient(180deg, rgba(247,249,251,.98), rgba(240,244,247,.98))',\n      border: '1px solid rgba(96,112,122,.16)',\n      boxShadow: '0 12px 34px rgba(28, 42, 53, .04)',\n      color: '#203544'\n    });\n    styleTextualDescendants(card, 'standard');\n\n    const nested = Array.from(card.querySelectorAll('div, article, section')).filter((el) => {\n      const rect = el.getBoundingClientRect();\n      const text = norm(el.textContent);\n      if (rect.width < 180 || rect.height < 60) return false;\n      return text.includes('sol / tokens') || text.includes('trading capital');\n    });\n\n    nested.forEach((el) => {\n      applyStyles(el, {\n        background: 'rgba(241,245,247,.86)',\n        border: '1px solid rgba(96,112,122,.14)',\n        boxShadow: 'none'\n      });\n      styleTextualDescendants(el, 'standard');\n    });\n  }\n\n  function applyAll() {\n    restoreAll();\n    if (!LIGHT_ONLY()) return;\n\n    findCards(STANDARD_PHRASES).forEach(styleStandardCard);\n    findCards(FAQ_PHRASES).forEach(styleFaqCard);\n  }\n\n  function init() {\n    applyAll();\n    setTimeout(applyAll, 120);\n    setTimeout(applyAll, 700);\n  }\n\n  if (document.readyState === 'loading') {\n    document.addEventListener('DOMContentLoaded', init, { once: true });\n  } else {\n    init();\n  }\n\n  const obs = new MutationObserver(() => applyAll());\n  obs.observe(document.documentElement, {\n    attributes: true,\n    attributeFilter: ['data-theme']\n  });\n\n  window.addEventListener('pageshow', applyAll);\n  window.addEventListener('load', applyAll);\n})();\n"

def die(msg):
    print(f"[HIW LIGHT DARK BLOCKS V1] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(1)

if not APP.exists():
    die(f"missing {APP}")
if not PAGE.exists():
    die(f"missing {PAGE}")

page_before = PAGE.read_text(encoding="utf-8")
if MARKER in page_before:
    print("[HIW LIGHT DARK BLOCKS V1] already installed")
    raise SystemExit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".hiw-light-dark-blocks-v1-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)
shutil.copy2(PAGE, backup / "how-it-works.html")
if SCRIPT.exists():
    shutil.copy2(SCRIPT, backup / "hiw-light-dark-blocks-v1.js")

SCRIPT.write_text(JS, encoding="utf-8")

tag = '\n<script src="/hiw-light-dark-blocks-v1.js?v=20260830-v1"></script>\n'
if "</body>" not in page_before.lower():
    die("cannot find </body> in how-it-works.html")

idx = page_before.lower().rfind("</body>")
page_after = page_before[:idx] + tag + page_before[idx:]
PAGE.write_text(page_after, encoding="utf-8")

rollback = ROOT / "rollback_hiw_light_dark_blocks_v1.py"
rollback.write_text(
    """#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
BACKUP = APP / %r

if not BACKUP.exists():
    raise SystemExit("Backup not found: " + str(BACKUP))

src_html = BACKUP / "how-it-works.html"
dst_html = APP / "how-it-works.html"
if not src_html.exists():
    raise SystemExit("Backup file missing: " + str(src_html))
shutil.copy2(src_html, dst_html)

src_js = BACKUP / "hiw-light-dark-blocks-v1.js"
dst_js = APP / "hiw-light-dark-blocks-v1.js"
if src_js.exists():
    shutil.copy2(src_js, dst_js)
elif dst_js.exists():
    dst_js.unlink()

print("[HIW LIGHT DARK BLOCKS V1] ROLLED BACK")
print("[HIW LIGHT DARK BLOCKS V1] restored:", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[HIW LIGHT DARK BLOCKS V1] INSTALLED")
print("[HIW LIGHT DARK BLOCKS V1] changed: How It Works dark blocks in Light mode only")
print("[HIW LIGHT DARK BLOCKS V1] targets: Important Distinction, control cards, authority card, FAQ cards")
print("[HIW LIGHT DARK BLOCKS V1] Dark theme untouched")
print("[HIW LIGHT DARK BLOCKS V1] backup:", backup)
print("[HIW LIGHT DARK BLOCKS V1] rollback: python3 rollback_hiw_light_dark_blocks_v1.py")
