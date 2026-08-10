import fs from 'node:fs';
import path from 'node:path';

const START = '<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_START -->';
const END = '<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_END -->';

const patchBlock = String.raw`${START}
<style id="mf-primary-avatar-score-height-style">
.mf-primary-avatar-score-height-target {
  height: var(--mf-primary-avatar-height) !important;
  width: var(--mf-primary-avatar-height) !important;
  min-height: var(--mf-primary-avatar-height) !important;
  min-width: var(--mf-primary-avatar-height) !important;
  max-height: none !important;
  max-width: none !important;
  aspect-ratio: 1 / 1 !important;
  object-fit: cover !important;
  flex: 0 0 var(--mf-primary-avatar-height) !important;
}
.mf-primary-avatar-score-height-wrap {
  height: var(--mf-primary-avatar-height) !important;
  width: var(--mf-primary-avatar-height) !important;
  min-height: var(--mf-primary-avatar-height) !important;
  min-width: var(--mf-primary-avatar-height) !important;
  max-height: none !important;
  max-width: none !important;
  flex: 0 0 var(--mf-primary-avatar-height) !important;
}
.mf-primary-avatar-score-align-box {
  transform: translateY(var(--mf-primary-avatar-offset, 0px)) !important;
  will-change: transform;
}
</style>
<script id="mf-primary-avatar-score-height-script">
(() => {
  'use strict';

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const upper = value => clean(value).toUpperCase();
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) !== 0 && r.width > 0 && r.height > 0;
  };

  function findPrimaryRoot() {
    const nodes = [...document.querySelectorAll('body *')];
    const markers = nodes.filter(el => upper(el.textContent) === 'PRIMARY CANDIDATE' || upper(el.textContent).includes('PRIMARY CANDIDATE'));
    for (const marker of markers) {
      let node = marker;
      for (let i = 0; node && node !== document.body && i < 12; i++, node = node.parentElement) {
        const text = upper(node.innerText);
        if (text.includes('AI SCORE') && node.querySelector('img')) return node;
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
      const rightBonus = Math.max(0, r.left - rootRect.left) / 20;
      const topBonus = Math.max(0, 180 - Math.max(0, r.top - rootRect.top)) / 20;
      const weight = fontSize * 10 + r.height * 4 + rightBonus + topBonus;
      if (weight > bestWeight) {
        best = el;
        bestWeight = weight;
      }
    }
    return best;
  }

  function findAvatar(root, score) {
    const imgs = [...root.querySelectorAll('img')].filter(visible);
    if (!imgs.length) return null;
    if (!score) return imgs[0];

    const sr = score.getBoundingClientRect();
    let best = null;
    let bestWeight = Infinity;

    for (const img of imgs) {
      const r = img.getBoundingClientRect();
      const vertical = Math.abs((r.top + r.height / 2) - (sr.top + sr.height / 2));
      const leftPref = Math.abs(r.left - root.getBoundingClientRect().left);
      const squarePenalty = Math.abs(r.width - r.height);
      const weight = vertical * 2 + leftPref * 0.2 + squarePenalty * 0.1;
      if (weight < bestWeight) {
        best = img;
        bestWeight = weight;
      }
    }
    return best;
  }

  function wrapperLike(el, imgRect) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return el.children.length === 1 && (
      Math.abs(r.width - r.height) < 20 ||
      Math.abs(r.width - imgRect.width) < 20 ||
      Math.abs(r.height - imgRect.height) < 20 ||
      s.overflow === 'hidden' || s.overflowX === 'hidden' || s.overflowY === 'hidden'
    );
  }

  function resetBox(box) {
    if (!box) return;
    box.style.removeProperty('--mf-primary-avatar-offset');
    box.classList.remove('mf-primary-avatar-score-align-box');
  }

  function applySize() {
    const root = findPrimaryRoot();
    if (!root) return;

    const score = findScore(root);
    const avatar = findAvatar(root, score);
    if (!score || !avatar) return;

    const scoreRect = score.getBoundingClientRect();
    const imageRect = avatar.getBoundingClientRect();
    let size = Math.round(scoreRect.height);
    size = Math.max(42, Math.min(140, size));

    avatar.style.setProperty('--mf-primary-avatar-height', size + 'px');
    avatar.classList.add('mf-primary-avatar-score-height-target');

    let moveBox = avatar;
    const parent = avatar.parentElement;
    if (parent && wrapperLike(parent, imageRect)) {
      parent.style.setProperty('--mf-primary-avatar-height', size + 'px');
      parent.classList.add('mf-primary-avatar-score-height-wrap');
      moveBox = parent;
    }

    resetBox(avatar);
    if (moveBox !== avatar) resetBox(parent);

    const moveRect = moveBox.getBoundingClientRect();
    let delta = Math.round(scoreRect.top - moveRect.top);
    if (Math.abs(delta) < 2) delta = 0;
    delta = Math.max(-40, Math.min(40, delta));

    moveBox.style.setProperty('--mf-primary-avatar-offset', delta + 'px');
    moveBox.classList.add('mf-primary-avatar-score-align-box');
  }

  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(applySize);
  };

  const observer = new MutationObserver(schedule);
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    schedule();
    setTimeout(schedule, 120);
    setTimeout(schedule, 350);
    setTimeout(schedule, 800);
    setTimeout(schedule, 1500);
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
  const candidates = [path.resolve('memeflow-app/index.html'), path.resolve('index.html')];
  return candidates.find(p => fs.existsSync(p)) || candidates[0];
}

const target = chooseTarget();
if (!fs.existsSync(target)) {
  console.error(`ERROR: index.html not found: ${target}`);
  console.error('Run from the project root, or pass the path explicitly:');
  console.error('  node apply-primary-avatar-score-height.mjs path/to/index.html');
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

const backup = `${target}.before-primary-avatar-score-height.bak`;
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);

html = html.slice(0, insertAt) + '\n' + patchBlock + '\n' + html.slice(insertAt);
fs.writeFileSync(target, html, 'utf8');

console.log('MEMEFLOW patch installed.');
console.log(`Target: ${target}`);
console.log(`Backup: ${backup}`);
console.log('Behavior: Primary Candidate avatar now matches AI Score height and aligns to the same top line.');
console.log('Restart Replit and hard-refresh the page.');
