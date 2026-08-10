import fs from 'node:fs';
import path from 'node:path';

const START = '<!-- MF_PATCH_MANUAL_TOKEN_LOGO_AI_SCORE_START -->';
const END = '<!-- MF_PATCH_MANUAL_TOKEN_LOGO_AI_SCORE_END -->';

const patchBlock = String.raw`
${START}
<style id="mf-manual-token-logo-ai-score-style">
/*
  MEMEFLOW: Manual Analysis token logo = rendered AI Score number height.
  Only elements detected inside the MANUAL ANALYSIS result are touched.
*/
.mf-manual-token-logo-ai-score {
  width: var(--mf-manual-token-logo-size) !important;
  height: var(--mf-manual-token-logo-size) !important;
  min-width: var(--mf-manual-token-logo-size) !important;
  min-height: var(--mf-manual-token-logo-size) !important;
  max-width: none !important;
  max-height: none !important;
  flex: 0 0 var(--mf-manual-token-logo-size) !important;
  aspect-ratio: 1 / 1 !important;
  object-fit: cover !important;
}
.mf-manual-token-logo-ai-score-wrap {
  width: var(--mf-manual-token-logo-size) !important;
  height: var(--mf-manual-token-logo-size) !important;
  min-width: var(--mf-manual-token-logo-size) !important;
  min-height: var(--mf-manual-token-logo-size) !important;
  flex: 0 0 var(--mf-manual-token-logo-size) !important;
}
</style>
<script id="mf-manual-token-logo-ai-score-script">
(() => {
  'use strict';

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const upper = value => clean(value).toUpperCase();
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) !== 0 &&
      r.width > 0 && r.height > 0;
  };

  function findManualRoot() {
    const nodes = [...document.querySelectorAll('body *')];
    const markers = nodes.filter(el => {
      if (el.children.length > 2) return false;
      const t = upper(el.textContent);
      return t === 'MANUAL ANALYSIS' || t.includes('MANUAL ANALYSIS');
    });

    for (const marker of markers) {
      let node = marker;
      for (let depth = 0; node && node !== document.body && depth < 10; depth++, node = node.parentElement) {
        const t = upper(node.innerText);
        if (t.includes('AI SCORE') && node.querySelector('img')) return node;
      }
    }
    return null;
  }

  function findScore(root) {
    const candidates = [...root.querySelectorAll('*')].filter(el => {
      if (!visible(el) || el.children.length) return false;
      const t = clean(el.textContent);
      return /^\d{1,3}(?:\.\d+)?$/.test(t);
    });

    let best = null;
    let bestWeight = -Infinity;
    const rootRect = root.getBoundingClientRect();

    for (const el of candidates) {
      const cs = getComputedStyle(el);
      const fontSize = parseFloat(cs.fontSize) || 0;
      const r = el.getBoundingClientRect();
      // AI score is normally the largest plain numeric value and sits near the top of the result.
      const topBonus = Math.max(0, 120 - Math.max(0, r.top - rootRect.top)) / 20;
      const weight = fontSize * 10 + r.height + topBonus;
      if (weight > bestWeight) {
        best = el;
        bestWeight = weight;
      }
    }
    return best;
  }

  function findLogo(root, score) {
    const imgs = [...root.querySelectorAll('img')].filter(visible);
    if (!imgs.length) return null;
    if (!score) return imgs[0];

    const sr = score.getBoundingClientRect();
    const sy = sr.top + sr.height / 2;

    let best = null;
    let bestWeight = Infinity;
    for (const img of imgs) {
      const r = img.getBoundingClientRect();
      const iy = r.top + r.height / 2;
      const squarePenalty = Math.abs(r.width - r.height);
      // Prefer the image vertically aligned with the AI score.
      const weight = Math.abs(iy - sy) * 2 + squarePenalty;
      if (weight < bestWeight) {
        best = img;
        bestWeight = weight;
      }
    }
    return best;
  }

  function applySize() {
    const root = findManualRoot();
    if (!root) return;

    const score = findScore(root);
    const logo = findLogo(root, score);
    if (!score || !logo) return;

    const scoreRect = score.getBoundingClientRect();
    const fontSize = parseFloat(getComputedStyle(score).fontSize) || 0;

    // Match the visible height of the AI Score number. Clamp only guards against bad DOM matches.
    let size = Math.round(scoreRect.height || fontSize);
    size = Math.max(36, Math.min(96, size));

    const before = logo.getBoundingClientRect();
    logo.style.setProperty('--mf-manual-token-logo-size', size + 'px');
    logo.classList.add('mf-manual-token-logo-ai-score');

    // If the image sits in a small one-purpose clipping wrapper, grow that wrapper too.
    const parent = logo.parentElement;
    if (parent) {
      const pr = parent.getBoundingClientRect();
      const ps = getComputedStyle(parent);
      const looksLikeLogoWrapper =
        parent.children.length === 1 &&
        pr.width > 0 && pr.height > 0 &&
        Math.abs(pr.width - pr.height) < 14 &&
        (
          pr.width <= before.width + 16 ||
          ps.overflow === 'hidden' ||
          ps.overflowX === 'hidden' ||
          ps.overflowY === 'hidden'
        );

      if (looksLikeLogoWrapper) {
        parent.style.setProperty('--mf-manual-token-logo-size', size + 'px');
        parent.classList.add('mf-manual-token-logo-ai-score-wrap');
      }
    }
  }

  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(applySize);
  };

  const observer = new MutationObserver(schedule);
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();
    setTimeout(schedule, 150);
    setTimeout(schedule, 500);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.addEventListener('resize', schedule, { passive: true });
})();
</script>
${END}`;

function chooseTarget() {
  const explicit = process.argv[2];
  if (explicit) return path.resolve(explicit);

  const candidates = [
    path.resolve('memeflow-app/index.html'),
    path.resolve('index.html'),
  ];

  return candidates.find(p => fs.existsSync(p)) || candidates[0];
}

const target = chooseTarget();
if (!fs.existsSync(target)) {
  console.error(`ERROR: index.html not found: ${target}`);
  console.error('Run from the project root, or pass the path explicitly:');
  console.error('  node apply-manual-logo-score-size.mjs path/to/index.html');
  process.exit(1);
}

let html = fs.readFileSync(target, 'utf8');

const startAt = html.indexOf(START);
const endAt = html.indexOf(END);
if (startAt !== -1 && endAt !== -1 && endAt > startAt) {
  html = html.slice(0, startAt) + html.slice(endAt + END.length);
}

const insertAt = html.lastIndexOf('</body>');
if (insertAt === -1) {
  console.error('ERROR: </body> not found. File was not changed.');
  process.exit(1);
}

const backup = `${target}.before-manual-logo-patch.bak`;
if (!fs.existsSync(backup)) {
  fs.copyFileSync(target, backup);
}

html = html.slice(0, insertAt) + '\n' + patchBlock + '\n' + html.slice(insertAt);
fs.writeFileSync(target, html, 'utf8');

console.log('MEMEFLOW patch installed.');
console.log(`Target: ${target}`);
console.log(`Backup: ${backup}`);
console.log('Behavior: Manual Analysis token image automatically matches the rendered AI Score number height.');
console.log('Restart the Replit app and hard-refresh the page.');
