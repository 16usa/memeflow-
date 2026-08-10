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
  echo "Run this script from the Replit project root."
  exit 1
fi

PATCH_DIR="$(dirname "$TARGET")/.memeflow-patches/ai-analysis-single-chevron"
mkdir -p "$PATCH_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$PATCH_DIR/index.html.$STAMP.bak"
cp "$TARGET" "$BACKUP"
printf '%s\n' "$BACKUP" > "$PATCH_DIR/latest-backup.txt"

python3 - "$TARGET" <<'PY'
from pathlib import Path
import re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding="utf-8")

# Remove BOTH the previous patch and this replacement patch if present.
marker_pairs = [
    ("<!-- MF_AI_VIEW_CHECKS_PATCH:START -->", "<!-- MF_AI_VIEW_CHECKS_PATCH:END -->"),
    ("<!-- MF_AI_SINGLE_CHEVRON_PATCH:START -->", "<!-- MF_AI_SINGLE_CHEVRON_PATCH:END -->"),
]
for start, end in marker_pairs:
    src = re.sub(re.escape(start) + r".*?" + re.escape(end) + r"\s*", "", src, flags=re.S)

START = "<!-- MF_AI_SINGLE_CHEVRON_PATCH:START -->"
END = "<!-- MF_AI_SINGLE_CHEVRON_PATCH:END -->"

style = r'''
<style id="mf-ai-single-chevron-style">
@media (max-width: 820px) {
  /*
    The selected AI Analysis control keeps its ORIGINAL click behavior.
    We only replace the visible contents with one row:
    [same chevron as View all checks] [AI Analysis & Market Data]
  */
  .mf-ai-single-chevron-target {
    position: relative !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    overflow: hidden !important;
    cursor: pointer !important;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .mf-ai-single-chevron-target > :not(.mf-ai-single-chevron-row) {
    display: none !important;
  }

  .mf-ai-single-chevron-row {
    width: 100%;
    min-height: inherit;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 14px !important;
    box-sizing: border-box;
    user-select: none;
    pointer-events: auto;
  }

  .mf-ai-single-chevron-icon {
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .mf-ai-single-chevron-icon svg {
    display: block !important;
    width: 18px !important;
    height: 18px !important;
    max-width: none !important;
    max-height: none !important;
  }

  .mf-ai-single-chevron-label {
    min-width: 0;
    display: inline-block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mf-ai-single-chevron-target:focus-visible {
    outline: 2px solid var(--cyan, #61dfff) !important;
    outline-offset: 2px !important;
  }
}
</style>
'''

script = r'''
<script id="mf-ai-single-chevron-script">
(() => {
  'use strict';

  const MOBILE = window.matchMedia('(max-width: 820px)');
  const TARGET_CLASS = 'mf-ai-single-chevron-target';
  const ROW_CLASS = 'mf-ai-single-chevron-row';
  let rafPending = false;

  const norm = v => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();

  function visible(el) {
    if (!el || !(el instanceof Element)) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 80 && r.height > 20;
  }

  function allCandidates() {
    return [...document.querySelectorAll(
      'button,a,summary,[role="button"],div,section,article,span,strong,b,h1,h2,h3,h4'
    )].filter(visible);
  }

  function exactText(text) {
    const wanted = norm(text);
    return allCandidates()
      .filter(el => norm(el.innerText || el.textContent) === wanted)
      .sort((a, b) => {
        const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        return (ar.width * ar.height) - (br.width * br.height);
      })[0] || null;
  }

  function findViewAllChecksControl() {
    let textNode = exactText('View all checks');
    if (!textNode) {
      textNode = allCandidates()
        .filter(el => norm(el.innerText || el.textContent).includes('view all checks'))
        .sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0] || null;
    }
    if (!textNode) return null;

    const interactive = textNode.closest('button,a,summary,[role="button"]');
    if (interactive && visible(interactive)) return interactive;

    let cur = textNode;
    const options = [];
    while (cur && cur !== document.body) {
      const r = cur.getBoundingClientRect();
      const t = norm(cur.innerText || cur.textContent);
      if (t.includes('view all checks') && r.height >= 42 && r.height <= 120 && r.width > 160) {
        options.push(cur);
      }
      cur = cur.parentElement;
    }
    return options.sort((a,b)=>a.getBoundingClientRect().height-b.getBoundingClientRect().height)[0] || textNode;
  }

  function findAiTitleNode() {
    const nodes = allCandidates().filter(el => {
      const t = norm(el.innerText || el.textContent);
      return t === 'ai analysis & market data' ||
             t === 'ai analysis and market data' ||
             (t.includes('ai analysis') && t.includes('market data') && t.length < 80);
    });

    return nodes.sort((a,b)=>{
      const ar=a.getBoundingClientRect(), br=b.getBoundingClientRect();
      return (ar.width*ar.height)-(br.width*br.height);
    })[0] || null;
  }

  function findAiControl() {
    const title = findAiTitleNode();
    if (!title) return null;

    // Best case: the title is already inside the actual clickable control.
    const interactive = title.closest('button,a,summary,[role="button"]');
    if (interactive && visible(interactive)) return interactive;

    // Otherwise choose the smallest practical ancestor that contains the WHOLE
    // AI Analysis row, including the old right-side chevron.
    const options = [];
    let cur = title;
    while (cur && cur !== document.body) {
      const r = cur.getBoundingClientRect();
      const t = norm(cur.innerText || cur.textContent);
      const hasIcon = !!cur.querySelector('svg,[class*="chevron"],[class*="arrow"],[class*="caret"]');
      const hasInteractiveChild = !!cur.querySelector('button,a,summary,[role="button"]');

      if (
        t.includes('ai analysis') &&
        t.includes('market data') &&
        r.width > 180 &&
        r.height >= 48 &&
        r.height <= 145
      ) {
        options.push({
          el: cur,
          score:
            (hasIcon ? -40 : 0) +
            (hasInteractiveChild ? -25 : 0) +
            Math.abs(r.height - 72)
        });
      }
      cur = cur.parentElement;
    }

    options.sort((a,b)=>a.score-b.score);
    return options[0]?.el || title;
  }

  function findSourceChevron(source) {
    if (!source) return null;

    // Prefer the icon to the LEFT of "View all checks", because that is the
    // exact visual the user wants to reuse.
    const sr = source.getBoundingClientRect();
    const svgs = [...source.querySelectorAll('svg')].filter(svg => {
      const r = svg.getBoundingClientRect();
      return r.width > 4 && r.height > 4 && r.left < sr.left + sr.width * 0.5;
    });

    if (svgs[0]) return svgs[0].cloneNode(true);

    // Fallback for icon libraries that draw with CSS / text rather than SVG.
    const iconLike = [...source.querySelectorAll('*')].find(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.width > 40 || r.height < 6 || r.height > 40) return false;
      const t = norm(el.textContent);
      return r.left < sr.left + sr.width * 0.5 &&
             (t === '›' || t === '>' || t === '→' || t === '❯');
    });
    if (iconLike) return iconLike.cloneNode(true);

    return null;
  }

  function copyComputedVisual(source, target, row, label, iconWrap) {
    const cs = getComputedStyle(source);
    const rect = source.getBoundingClientRect();

    const props = [
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
    props.forEach(prop => {
      const value = cs.getPropertyValue(prop);
      if (value) target.style.setProperty(prop, value, 'important');
    });

    const targetHeight = (rect.height >= 42 && rect.height <= 120) ? Math.round(rect.height) : 68;
    target.style.setProperty('min-height', `${targetHeight}px`, 'important');
    target.style.setProperty('height', `${targetHeight}px`, 'important');
    target.style.setProperty('padding', '0', 'important');

    row.style.padding = cs.padding || '0 18px';

    [
      'font-family','font-size','font-style','font-weight',
      'letter-spacing','line-height','text-transform'
    ].forEach(prop => {
      const value = cs.getPropertyValue(prop);
      if (value) label.style.setProperty(prop, value);
    });

    label.style.color = cs.color;
    iconWrap.style.color = cs.color;
  }

  function installVisual(source, target) {
    target.classList.add(TARGET_CLASS);

    let row = target.querySelector(`:scope > .${ROW_CLASS}`);
    if (!row) {
      // Save original interactive child before hiding it.
      const originalInteractive =
        target.matches('button,a,summary,[role="button"]')
          ? null
          : target.querySelector('button,a,summary,[role="button"]');

      row = document.createElement('span');
      row.className = ROW_CLASS;

      const iconWrap = document.createElement('span');
      iconWrap.className = 'mf-ai-single-chevron-icon';
      iconWrap.setAttribute('aria-hidden', 'true');

      const cloned = findSourceChevron(source);
      if (cloned) {
        iconWrap.appendChild(cloned);
      } else {
        // Clean fallback: one single chevron. Never show a second arrow.
        iconWrap.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
          '<path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>';
      }

      const label = document.createElement('span');
      label.className = 'mf-ai-single-chevron-label';
      label.textContent = 'AI Analysis & Market Data';

      row.append(iconWrap, label);
      target.appendChild(row);

      // If click behavior lives on a hidden child, forward the new visible row
      // to that EXISTING control. This preserves application logic.
      if (originalInteractive) {
        row.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          originalInteractive.click();
        });
      }

      if (!target.hasAttribute('aria-label')) {
        target.setAttribute('aria-label', 'AI Analysis & Market Data');
      }
    }

    const label = row.querySelector('.mf-ai-single-chevron-label');
    const iconWrap = row.querySelector('.mf-ai-single-chevron-icon');
    copyComputedVisual(source, target, row, label, iconWrap);
  }

  function apply() {
    rafPending = false;
    if (!MOBILE.matches) return;

    const source = findViewAllChecksControl();
    const target = findAiControl();
    if (!source || !target || source === target) return;

    installVisual(source, target);
  }

  function schedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(apply);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  MOBILE.addEventListener?.('change', schedule);
  window.addEventListener('resize', schedule, { passive: true });
})();
</script>
'''

head_block = f"{START}\n{style}\n{END}"
body_block = f"{START}\n{script}\n{END}"

head = re.search(r"</head>", src, flags=re.I)
body = list(re.finditer(r"</body>", src, flags=re.I))
if not head or not body:
    raise SystemExit("ERROR: HTML closing tags were not found.")

src = src[:head.start()] + head_block + "\n" + src[head.start():]
body = list(re.finditer(r"</body>", src, flags=re.I))[-1]
src = src[:body.start()] + body_block + "\n" + src[body.start():]

path.write_text(src, encoding="utf-8")
print(f"Patched: {path}")
PY

if ! grep -q 'id="mf-ai-single-chevron-style"' "$TARGET"; then
  echo "ERROR: patch CSS verification failed; restoring backup."
  cp "$BACKUP" "$TARGET"
  exit 1
fi

if ! grep -q 'id="mf-ai-single-chevron-script"' "$TARGET"; then
  echo "ERROR: patch JS verification failed; restoring backup."
  cp "$BACKUP" "$TARGET"
  exit 1
fi

echo
echo "OK: single-chevron AI Analysis patch installed."
echo "Target: $TARGET"
echo "Backup: $BACKUP"
echo
echo "This installer automatically removes the previous AI button patch first."
echo "Now restart the Replit app (Stop -> Run)."
