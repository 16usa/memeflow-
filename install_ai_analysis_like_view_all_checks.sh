#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"

if [[ -f "$ROOT/memeflow-app/index.html" ]]; then
  TARGET="$ROOT/memeflow-app/index.html"
elif [[ -f "$ROOT/index.html" ]]; then
  TARGET="$ROOT/index.html"
else
  TARGET="$(find "$ROOT" -maxdepth 3 -type f -name index.html \
    -not -path '*/node_modules/*' \
    -not -path '*/dist/*' \
    -not -path '*/build/*' \
    | head -n 1 || true)"
fi

if [[ -z "${TARGET:-}" || ! -f "$TARGET" ]]; then
  echo "ERROR: MEMEFLOW index.html was not found."
  echo "Run this script from the Replit project root, or pass the project path:"
  echo "  bash $0 /path/to/project"
  exit 1
fi

PATCH_DIR="$(dirname "$TARGET")/.memeflow-patches/ai-analysis-like-view-checks"
mkdir -p "$PATCH_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$PATCH_DIR/index.html.$STAMP.bak"
cp "$TARGET" "$BACKUP"
printf '%s\n' "$BACKUP" > "$PATCH_DIR/latest-backup.txt"

python3 - "$TARGET" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")

START = "<!-- MF_AI_VIEW_CHECKS_PATCH:START -->"
END = "<!-- MF_AI_VIEW_CHECKS_PATCH:END -->"

src = re.sub(
    re.escape(START) + r".*?" + re.escape(END),
    "",
    src,
    flags=re.S,
)

style = r'''
<style id="mf-ai-analysis-view-checks-style">
/*
  MEMEFLOW targeted mobile patch:
  AI Analysis & Market Data gets the same compact button treatment
  as the existing "View all checks" control.
  No trading logic, API calls, state, or click handlers are replaced.
*/
@media (max-width: 820px) {
  .mf-ai-view-checks-match {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    cursor: pointer !important;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .mf-ai-view-checks-match > :not(.mf-ai-view-checks-row) {
    display: none !important;
  }

  .mf-ai-view-checks-row {
    width: 100%;
    min-height: inherit;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 14px !important;
    position: relative;
    box-sizing: border-box;
    text-align: center;
    user-select: none;
  }

  .mf-ai-view-checks-arrow {
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 31px;
    line-height: 1;
    font-weight: 300;
    transform: translateY(-1px);
  }

  .mf-ai-view-checks-arrow svg {
    width: 18px !important;
    height: 18px !important;
    display: block;
  }

  .mf-ai-view-checks-label {
    display: inline-block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mf-ai-view-checks-match:focus-visible {
    outline: 2px solid var(--cyan, #61dfff) !important;
    outline-offset: 2px !important;
  }
}
</style>
'''

script = r'''
<script id="mf-ai-analysis-view-checks-script">
(() => {
  'use strict';

  const PATCH_CLASS = 'mf-ai-view-checks-match';
  const ROW_CLASS = 'mf-ai-view-checks-row';
  const MOBILE = window.matchMedia('(max-width: 820px)');
  let scheduled = false;

  const norm = value =>
    String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  const isVisible = el => {
    if (!el || !(el instanceof Element)) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 80 && r.height > 18;
  };

  const interactiveAncestor = el => {
    if (!el) return null;
    return el.closest('button, a, summary, [role="button"]');
  };

  function findTextNode(test) {
    const nodes = [...document.querySelectorAll(
      'button,a,summary,[role="button"],div,section,article,span,strong,b,h1,h2,h3,h4'
    )];

    return nodes
      .filter(el => isVisible(el) && test(norm(el.innerText || el.textContent)))
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return (ar.height * ar.width) - (br.height * br.width);
      })[0] || null;
  }

  function findViewAllChecks() {
    const exact = findTextNode(t => t === 'view all checks');
    if (exact) {
      const clickable = interactiveAncestor(exact);
      if (clickable && isVisible(clickable)) return clickable;

      let cur = exact;
      while (cur && cur !== document.body) {
        const t = norm(cur.innerText || cur.textContent);
        const r = cur.getBoundingClientRect();
        if (t === 'view all checks' && r.height >= 40 && r.height <= 110) return cur;
        cur = cur.parentElement;
      }
    }

    return findTextNode(t => t.includes('view all checks'));
  }

  function findAiControl() {
    const title = findTextNode(t =>
      t === 'ai analysis & market data' ||
      t === 'ai analysis and market data' ||
      (t.includes('ai analysis') && t.includes('market data'))
    );

    if (!title) return null;

    const clickable = interactiveAncestor(title);
    if (clickable && isVisible(clickable)) return clickable;

    const candidates = [];
    let cur = title;
    while (cur && cur !== document.body) {
      const t = norm(cur.innerText || cur.textContent);
      const r = cur.getBoundingClientRect();

      if (
        t.includes('ai analysis') &&
        t.includes('market data') &&
        r.width > 140 &&
        r.height >= 48 &&
        r.height <= 220
      ) {
        candidates.push(cur);
      }
      cur = cur.parentElement;
    }

    candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return ar.height - br.height;
    });

    return candidates.find(el => el.getBoundingClientRect().height >= 58) ||
           candidates[0] ||
           title;
  }

  function copyVisual(source, target, row, label, arrow) {
    const cs = getComputedStyle(source);
    const rect = source.getBoundingClientRect();

    const rootProps = [
      'background',
      'background-color',
      'background-image',
      'border-top',
      'border-right',
      'border-bottom',
      'border-left',
      'border-radius',
      'box-shadow',
      'color'
    ];

    for (const prop of rootProps) {
      const value = cs.getPropertyValue(prop);
      if (value) target.style.setProperty(prop, value, 'important');
    }

    if (rect.height >= 40 && rect.height <= 120) {
      target.style.setProperty('min-height', `${Math.round(rect.height)}px`, 'important');
    } else {
      target.style.setProperty('min-height', '68px', 'important');
    }

    row.style.padding = cs.padding || '14px 18px';

    const fontProps = [
      'font-family',
      'font-size',
      'font-style',
      'font-weight',
      'letter-spacing',
      'line-height',
      'text-transform'
    ];
    for (const prop of fontProps) {
      const value = cs.getPropertyValue(prop);
      if (value) label.style.setProperty(prop, value);
    }

    label.style.color = cs.color;
    arrow.style.color = cs.color;
  }

  function buildRow(ai, source) {
    let row = ai.querySelector(`:scope > .${ROW_CLASS}`);
    if (!row) {
      const originalInteractive =
        ai.matches('button,a,summary,[role="button"]')
          ? null
          : ai.querySelector('button,a,summary,[role="button"]');

      row = document.createElement('span');
      row.className = ROW_CLASS;

      const arrow = document.createElement('span');
      arrow.className = 'mf-ai-view-checks-arrow';
      arrow.setAttribute('aria-hidden', 'true');

      const sourceIcon = source.querySelector('svg');
      if (sourceIcon) {
        arrow.appendChild(sourceIcon.cloneNode(true));
      } else {
        arrow.textContent = '›';
      }

      const label = document.createElement('span');
      label.className = 'mf-ai-view-checks-label';
      label.textContent = 'AI Analysis & Market Data';

      row.append(arrow, label);
      ai.appendChild(row);

      if (originalInteractive) {
        row.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          originalInteractive.click();
        });
      }

      if (!ai.hasAttribute('aria-label')) {
        ai.setAttribute('aria-label', 'AI Analysis & Market Data');
      }
    }
    return row;
  }

  function apply() {
    scheduled = false;
    if (!MOBILE.matches) return;

    const source = findViewAllChecks();
    const ai = findAiControl();
    if (!source || !ai || source === ai) return;

    ai.classList.add(PATCH_CLASS);

    const row = buildRow(ai, source);
    const label = row.querySelector('.mf-ai-view-checks-label');
    const arrow = row.querySelector('.mf-ai-view-checks-arrow');

    copyVisual(source, ai, row, label, arrow);
    ai.dataset.mfAiViewChecksPatched = 'true';
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleApply, { once: true });
  } else {
    scheduleApply();
  }

  const observer = new MutationObserver(scheduleApply);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  MOBILE.addEventListener?.('change', scheduleApply);
  window.addEventListener('resize', scheduleApply, { passive: true });
})();
</script>
'''

block_head = f"{START}\n{style}\n{END}"
block_body = f"{START}\n{script}\n{END}"

if not re.search(r"</head>", src, flags=re.I):
    raise SystemExit("ERROR: </head> not found in target HTML.")
if not re.search(r"</body>", src, flags=re.I):
    raise SystemExit("ERROR: </body> not found in target HTML.")

head_match = re.search(r"</head>", src, flags=re.I)
src = src[:head_match.start()] + block_head + "\n" + src[head_match.start():]

body_match = list(re.finditer(r"</body>", src, flags=re.I))[-1]
src = src[:body_match.start()] + block_body + "\n" + src[body_match.start():]

path.write_text(src, encoding="utf-8")
print(f"Patched: {path}")
PY

if ! grep -q 'id="mf-ai-analysis-view-checks-style"' "$TARGET"; then
  echo "ERROR: style marker verification failed. Restoring backup."
  cp "$BACKUP" "$TARGET"
  exit 1
fi

if ! grep -q 'id="mf-ai-analysis-view-checks-script"' "$TARGET"; then
  echo "ERROR: script marker verification failed. Restoring backup."
  cp "$BACKUP" "$TARGET"
  exit 1
fi

echo
echo "OK: AI Analysis mobile control patch installed."
echo "Target: $TARGET"
echo "Backup: $BACKUP"
echo
echo "Restart the Replit app (Stop -> Run), or from memeflow-app:"
echo "  npm start"
