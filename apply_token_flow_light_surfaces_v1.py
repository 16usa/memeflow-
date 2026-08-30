#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"
THEME = APP / "memeflow-theme.css"
HTML = APP / "system-tokens.html"
JS_FILE = APP / "token-flow-light-surfaces-v1.js"

CSS_MARKER = "/* ===== MEMEFLOW_TOKEN_FLOW_LIGHT_SURFACES_V1 ===== */"
JS_NAME = "token-flow-light-surfaces-v1.js"

CSS = r'''/* ===== MEMEFLOW_TOKEN_FLOW_LIGHT_SURFACES_V1 ===== */
/*
  Real-Time Pipeline / Token Flow
  Light theme cleanup:
  - converts remaining dark token cards to light surfaces
  - converts expanded detail panels to light surfaces
  - converts Previous / Page / Next pager bar to light surface
  - keeps OPEN POSITION green and untouched
  Dark theme is untouched.
*/

html[data-theme="light"] [data-mf-token-flow-card="1"] {
  background:
    radial-gradient(circle at 50% 0%, rgba(77, 230, 161, .04), transparent 46%),
    linear-gradient(180deg, #ffffff 0%, #f8fbfc 100%) !important;
  border: 1px solid rgba(38, 59, 74, .10) !important;
  box-shadow: 0 12px 30px rgba(41, 57, 68, .055) !important;
  color: #17222c !important;
}

html[data-theme="light"] [data-mf-token-flow-card="1"]::before,
html[data-theme="light"] [data-mf-token-flow-card="1"]::after {
  opacity: .22 !important;
}

html[data-theme="light"] [data-mf-token-flow-card="1"] * {
  border-color: rgba(38, 59, 74, .08) !important;
}

html[data-theme="light"] [data-mf-token-flow-card="1"] strong,
html[data-theme="light"] [data-mf-token-flow-card="1"] b,
html[data-theme="light"] [data-mf-token-flow-card="1"] h1,
html[data-theme="light"] [data-mf-token-flow-card="1"] h2,
html[data-theme="light"] [data-mf-token-flow-card="1"] h3,
html[data-theme="light"] [data-mf-token-flow-card="1"] h4,
html[data-theme="light"] [data-mf-token-flow-card="1"] [data-mf-token-flow-force-strong="1"] {
  color: #17222c !important;
}

html[data-theme="light"] [data-mf-token-flow-card="1"] span,
html[data-theme="light"] [data-mf-token-flow-card="1"] small,
html[data-theme="light"] [data-mf-token-flow-card="1"] p,
html[data-theme="light"] [data-mf-token-flow-card="1"] div,
html[data-theme="light"] [data-mf-token-flow-card="1"] em,
html[data-theme="light"] [data-mf-token-flow-card="1"] label {
  color: #617581 !important;
}

html[data-theme="light"] [data-mf-token-flow-card="1"] [data-mf-token-flow-token-name="1"],
html[data-theme="light"] [data-mf-token-flow-card="1"] [data-mf-token-flow-pl="1"],
html[data-theme="light"] [data-mf-token-flow-card="1"] [data-mf-token-flow-metric-value="1"] {
  color: #17222c !important;
}

html[data-theme="light"] [data-mf-token-flow-card="1"] [data-mf-token-flow-metric-label="1"],
html[data-theme="light"] [data-mf-token-flow-card="1"] [data-mf-token-flow-detail-heading="1"] {
  color: #728490 !important;
}

html[data-theme="light"] [data-mf-token-flow-card="1"] [data-mf-token-flow-detail-panel="1"] {
  background: rgba(248, 251, 252, .96) !important;
  border: 1px solid rgba(38, 59, 74, .08) !important;
  box-shadow: none !important;
}

html[data-theme="light"] [data-mf-token-flow-card="1"] [data-mf-token-flow-action="details"],
html[data-theme="light"] [data-mf-token-flow-card="1"] [data-mf-token-flow-action="close"] {
  background: #ffffff !important;
  border: 1px solid rgba(38, 59, 74, .10) !important;
  color: #536873 !important;
  box-shadow: none !important;
}

html[data-theme="light"] [data-mf-token-flow-card="1"] [data-mf-token-flow-chip="1"] {
  background: rgba(24, 44, 58, .03) !important;
  border: 1px solid rgba(38, 59, 74, .08) !important;
  color: #536873 !important;
}

html[data-theme="light"] [data-mf-token-flow-card="1"] [data-mf-token-flow-avatar="1"] {
  background: linear-gradient(180deg, #f8fbfd 0%, #eef4f7 100%) !important;
  border-color: rgba(38, 59, 74, .10) !important;
  box-shadow: none !important;
}

html[data-theme="light"] [data-mf-token-flow-card="1"] [data-mf-token-flow-pl="1"][data-pl-sign="positive"] {
  color: var(--green, #42d392) !important;
}

html[data-theme="light"] [data-mf-token-flow-card="1"] [data-mf-token-flow-pl="1"][data-pl-sign="negative"] {
  color: var(--red, #ff6b7a) !important;
}

html[data-theme="light"] [data-mf-token-flow-pager="1"] {
  background: rgba(244, 248, 250, .96) !important;
  border: 1px solid rgba(38, 59, 74, .09) !important;
  box-shadow: 0 8px 24px rgba(41, 57, 68, .05) !important;
  color: #536873 !important;
  backdrop-filter: blur(8px) !important;
}

html[data-theme="light"] [data-mf-token-flow-pager="1"] * {
  color: #536873 !important;
  border-color: rgba(38, 59, 74, .08) !important;
}

html[data-theme="light"] [data-mf-token-flow-search-shell="1"],
html[data-theme="light"] [data-mf-token-flow-sort-shell="1"] {
  background: linear-gradient(180deg, #f9fbfc 0%, #f1f6f8 100%) !important;
  border-color: rgba(38, 59, 74, .10) !important;
  color: #6a7d88 !important;
}

html[data-theme="light"] [data-mf-token-flow-search-shell="1"] *,
html[data-theme="light"] [data-mf-token-flow-sort-shell="1"] * {
  color: #6a7d88 !important;
  border-color: rgba(38, 59, 74, .08) !important;
}

html[data-theme="light"] [data-mf-token-flow-search-shell="1"] input,
html[data-theme="light"] [data-mf-token-flow-search-shell="1"] textarea {
  color: #17222c !important;
}
/* ===== /MEMEFLOW_TOKEN_FLOW_LIGHT_SURFACES_V1 ===== */
'''

JS = r'''(() => {
  const ATTRS = [
    'data-mf-token-flow-card',
    'data-mf-token-flow-action',
    'data-mf-token-flow-detail-panel',
    'data-mf-token-flow-detail-heading',
    'data-mf-token-flow-token-name',
    'data-mf-token-flow-metric-label',
    'data-mf-token-flow-metric-value',
    'data-mf-token-flow-avatar',
    'data-mf-token-flow-chip',
    'data-mf-token-flow-pl',
    'data-mf-token-flow-force-strong',
    'data-mf-token-flow-pager',
    'data-mf-token-flow-search-shell',
    'data-mf-token-flow-sort-shell'
  ];

  const METRIC_LABELS = ['AGE', 'HOLDERS', 'VOL 5M', 'TX 5M', 'MC', '5M%'];
  const DETAIL_HEADINGS = ['PRIMARY SIGNAL', 'RISK GATES', 'DEVELOPER', 'MINT'];
  const STATES = ['OPEN POSITION', 'WAITING', 'WATCH', 'BUY READY', 'BLOCKED'];

  function normalize(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function textOf(el) {
    return normalize(el && el.textContent);
  }

  function hasAnyText(el, list) {
    const text = textOf(el);
    return list.some((item) => text.includes(item));
  }

  function countTextHits(el, list) {
    const text = textOf(el);
    return list.reduce((sum, item) => sum + (text.includes(item) ? 1 : 0), 0);
  }

  function isActionNode(el) {
    if (!visible(el)) return false;
    const text = textOf(el);
    if (!(text === 'DETAILS' || text === 'CLOSE')) return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= 44 && rect.width <= 180 && rect.height >= 18 && rect.height <= 72;
  }

  function findTopCard(node) {
    let el = node;
    while (el && el !== document.body) {
      const rect = el.getBoundingClientRect();
      if (rect.width >= 240 && rect.height >= 90 && rect.height <= 520) {
        const text = textOf(el);
        const metricHits = countTextHits(el, METRIC_LABELS);
        const hasAction = Array.from(el.querySelectorAll('*')).some(isActionNode);
        const hasState = STATES.some((item) => text.includes(item));
        if (hasAction && hasState && metricHits >= 3) return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function markCard(card) {
    if (!card || card.hasAttribute('data-mf-token-flow-card')) return;
    card.setAttribute('data-mf-token-flow-card', '1');

    const all = Array.from(card.querySelectorAll('*'));

    for (const el of all) {
      const text = textOf(el);
      const rect = el.getBoundingClientRect();

      if (text === 'DETAILS') el.setAttribute('data-mf-token-flow-action', 'details');
      if (text === 'CLOSE') el.setAttribute('data-mf-token-flow-action', 'close');

      if (DETAIL_HEADINGS.includes(text)) {
        el.setAttribute('data-mf-token-flow-detail-heading', '1');
        const panel = el.closest('div');
        if (panel && panel !== card) panel.setAttribute('data-mf-token-flow-detail-panel', '1');
      }

      if (METRIC_LABELS.includes(text)) {
        el.setAttribute('data-mf-token-flow-metric-label', '1');
        const valueHost = el.parentElement;
        if (valueHost) {
          for (const child of Array.from(valueHost.children)) {
            if (child !== el) child.setAttribute('data-mf-token-flow-metric-value', '1');
          }
        }
      }

      if ((text.includes('P&L') || /^[-+−]?\d/.test(text)) && rect.width <= 220 && rect.height <= 60) {
        if (text.includes('+')) el.setAttribute('data-pl-sign', 'positive');
        if (text.includes('-') || text.includes('−')) el.setAttribute('data-pl-sign', 'negative');
        if (text.includes('P&L') || text.includes('%') || text.includes('SOL')) {
          el.setAttribute('data-mf-token-flow-pl', '1');
        }
      }

      if (rect.width >= 42 && rect.width <= 92 && rect.height >= 42 && rect.height <= 92 && text.length <= 2) {
        el.setAttribute('data-mf-token-flow-avatar', '1');
      }

      if (/^[A-Z0-9$][A-Z0-9$'’\- ]{2,}$/i.test(String(el.textContent || '').trim()) && rect.width <= 260 && rect.height <= 40) {
        if (!METRIC_LABELS.includes(text) && !DETAIL_HEADINGS.includes(text) && text !== 'DETAILS' && text !== 'CLOSE' && !text.includes('PAGE ')) {
          el.setAttribute('data-mf-token-flow-token-name', '1');
        }
      }

      if ((text === 'OPEN POSITION' || text === 'WAITING' || text === 'WATCH' || text === 'BUY READY' || text === 'BLOCKED') && rect.width <= 220 && rect.height <= 44) {
        el.setAttribute('data-mf-token-flow-chip', '1');
      }
    }
  }

  function markCards() {
    const actions = Array.from(document.querySelectorAll('body *')).filter(isActionNode);
    const cards = new Set();
    for (const action of actions) {
      const card = findTopCard(action);
      if (card) cards.add(card);
    }
    for (const card of cards) markCard(card);
  }

  function markPager() {
    const nodes = Array.from(document.querySelectorAll('body *'));
    for (const el of nodes) {
      if (!visible(el)) continue;
      const text = textOf(el);
      if (!/PAGE\s+\d+\s+OF\s+\d+/.test(text)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 180 || rect.height < 26 || rect.height > 120) continue;
      let container = el;
      while (container && container !== document.body) {
        const r = container.getBoundingClientRect();
        const t = textOf(container);
        if (r.width >= 240 && r.height >= 34 && r.height <= 140 && t.includes('PAGE ') && (t.includes('PREVIOUS') || t.includes('NEXT'))) {
          container.setAttribute('data-mf-token-flow-pager', '1');
          break;
        }
        container = container.parentElement;
      }
    }
  }

  function markSearchAndSort() {
    const nodes = Array.from(document.querySelectorAll('body *'));
    for (const el of nodes) {
      if (!visible(el)) continue;
      const text = textOf(el);
      const rect = el.getBoundingClientRect();
      if (text.includes('SEARCH MINT') && rect.width >= 180 && rect.height >= 34 && rect.height <= 90) {
        el.setAttribute('data-mf-token-flow-search-shell', '1');
      }
      if (text.includes('SORT') && text.includes('SMART') && rect.width >= 180 && rect.height >= 34 && rect.height <= 90) {
        el.setAttribute('data-mf-token-flow-sort-shell', '1');
      }
    }
  }

  function clearMarks() {
    for (const attr of ATTRS) {
      document.querySelectorAll('[' + attr + ']').forEach((el) => el.removeAttribute(attr));
    }
    document.querySelectorAll('[data-pl-sign]').forEach((el) => el.removeAttribute('data-pl-sign'));
  }

  let raf = 0;
  function rescan() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      clearMarks();
      markCards();
      markPager();
      markSearchAndSort();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rescan, { once: true });
  } else {
    rescan();
  }

  const root = document.body || document.documentElement;
  if (root) {
    const observer = new MutationObserver(rescan);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });
  }

  window.addEventListener('load', rescan, { passive: true });
  window.addEventListener('pageshow', rescan, { passive: true });
  window.addEventListener('resize', rescan, { passive: true });
})();
'''


def die(message):
    print(f"[TOKEN FLOW LIGHT SURFACES V1] ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


for path in (THEME, HTML):
    if not path.exists():
        die(f"missing {path}")


theme_before = THEME.read_text(encoding="utf-8")
html_before = HTML.read_text(encoding="utf-8")

if CSS_MARKER in theme_before or JS_NAME in html_before:
    print("[TOKEN FLOW LIGHT SURFACES V1] already installed")
    raise SystemExit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = APP / f".token-flow-light-surfaces-v1-backup-{stamp}"
backup.mkdir(parents=True, exist_ok=False)

for path in (THEME, HTML, JS_FILE):
    if path.exists():
        shutil.copy2(path, backup / path.name)

THEME.write_text(theme_before.rstrip() + "\n\n" + CSS, encoding="utf-8")
JS_FILE.write_text(JS, encoding="utf-8")

html_after = html_before

if "</body>" not in html_after.lower():
    die("cannot find </body> in system-tokens.html")

idx = html_after.lower().rfind("</body>")
script_tag = '\n<script src="/token-flow-light-surfaces-v1.js?v=20260830-v1"></script>\n'
html_after = html_after[:idx] + script_tag + html_after[idx:]

html_after, count = re.subn(
    r'/memeflow-theme\.css\?v=[^"\']+',
    '/memeflow-theme.css?v=token-flow-light-surfaces-v1-20260830',
    html_after,
    count=1
)
if count == 0:
    die("memeflow-theme.css link not found in system-tokens.html")

HTML.write_text(html_after, encoding="utf-8")

rollback = ROOT / "rollback_token_flow_light_surfaces_v1.py"
rollback.write_text(
    """#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT = Path.cwd()
APP = ROOT / \"memeflow-app\"
BACKUP = APP / %r

if not BACKUP.exists():
    raise SystemExit(\"Backup not found: \" + str(BACKUP))

for name in (\"memeflow-theme.css\", \"system-tokens.html\"):
    src = BACKUP / name
    dst = APP / name
    if not src.exists():
        raise SystemExit(\"Backup file missing: \" + str(src))
    shutil.copy2(src, dst)

src_js = BACKUP / \"token-flow-light-surfaces-v1.js\"
dst_js = APP / \"token-flow-light-surfaces-v1.js\"
if src_js.exists():
    shutil.copy2(src_js, dst_js)
elif dst_js.exists():
    dst_js.unlink()

print(\"[TOKEN FLOW LIGHT SURFACES V1] ROLLED BACK\")
print(\"[TOKEN FLOW LIGHT SURFACES V1] restored:\", BACKUP)
""" % backup.name,
    encoding="utf-8"
)

print("[TOKEN FLOW LIGHT SURFACES V1] INSTALLED")
print("[TOKEN FLOW LIGHT SURFACES V1] scope: Real-Time Pipeline / Token Flow in Light theme only")
print("[TOKEN FLOW LIGHT SURFACES V1] changed: token cards / expanded card detail panels / pager / search / sort")
print("[TOKEN FLOW LIGHT SURFACES V1] kept: OPEN POSITION green styling")
print("[TOKEN FLOW LIGHT SURFACES V1] backup:", backup)
print("[TOKEN FLOW LIGHT SURFACES V1] rollback: python3 rollback_token_flow_light_surfaces_v1.py")
