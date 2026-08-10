import fs from 'node:fs';
import path from 'node:path';

const START = '<!-- MF_PRIMARY_IDENTITY_ALIGN_PATCH_START -->';
const END = '<!-- MF_PRIMARY_IDENTITY_ALIGN_PATCH_END -->';

const PATCH = String.raw`${START}
<style id="mf-primary-identity-align-v6-style">
  #primary-candidate .token-head.mf-primary-token-head{
    display:grid !important;
    grid-template-columns:minmax(0,1fr) auto !important;
    align-items:start !important;
    column-gap:14px !important;
  }
  #primary-candidate .mf-primary-identity{
    display:flex !important;
    align-items:flex-start !important;
    gap:12px !important;
    min-width:0 !important;
  }
  #primary-candidate .mf-primary-avatar-box{
    width:var(--mf-primary-avatar-size,56px) !important;
    height:var(--mf-primary-avatar-size,56px) !important;
    min-width:var(--mf-primary-avatar-size,56px) !important;
    min-height:var(--mf-primary-avatar-size,56px) !important;
    max-width:none !important;
    max-height:none !important;
    flex:0 0 var(--mf-primary-avatar-size,56px) !important;
    display:block !important;
    overflow:hidden !important;
    margin:0 !important;
    transform:none !important;
    position:static !important;
  }
  #primary-candidate .mf-primary-avatar-box > img,
  #primary-candidate .mf-primary-avatar-box img{
    width:100% !important;
    height:100% !important;
    min-width:100% !important;
    min-height:100% !important;
    max-width:none !important;
    max-height:none !important;
    object-fit:cover !important;
    display:block !important;
    transform:none !important;
    margin:0 !important;
  }
  #primary-candidate .mf-primary-avatar-box.mf-primary-bg-avatar{
    background-position:center !important;
    background-size:cover !important;
    background-repeat:no-repeat !important;
  }
  #primary-candidate .mf-primary-texts{
    min-width:0 !important;
    display:flex !important;
    flex-direction:column !important;
    justify-content:flex-start !important;
    align-self:start !important;
  }
  #primary-candidate #primaryName{
    display:block !important;
    margin:0 !important;
    line-height:1.02 !important;
    min-width:0 !important;
  }
  #primary-candidate #primaryMeta{
    display:block !important;
    margin:6px 0 0 0 !important;
    line-height:1.05 !important;
    min-width:0 !important;
  }
  #primary-candidate .mf-primary-score-wrap{
    justify-self:end !important;
    align-self:start !important;
    text-align:left !important;
    margin:0 !important;
    transform:none !important;
  }
</style>
<script id="mf-primary-identity-align-v6-script">
(() => {
  'use strict';
  if (window.__MF_PRIMARY_IDENTITY_ALIGN_V6__) return;
  window.__MF_PRIMARY_IDENTITY_ALIGN_V6__ = true;

  const removeOld = () => {
    [
      'mf-primary-avatar-score-height-style',
      'mf-primary-avatar-score-height-script',
      'mf-primary-identity-align-v2-style',
      'mf-primary-identity-align-v2-script',
      'mf-primary-identity-align-v3-style',
      'mf-primary-identity-align-v3-script',
      'mf-primary-identity-align-v4-style',
      'mf-primary-identity-align-v4-script',
      'mf-primary-identity-align-v5-style',
      'mf-primary-identity-align-v5-script'
    ].forEach(id => document.getElementById(id)?.remove());
  };

  const visible = el => {
    if (!el || !el.isConnected) return false;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity !== 0 && r.width > 0 && r.height > 0;
  };

  function getPrimary() {
    const card = document.getElementById('primary-candidate');
    if (!card) return null;
    const head = card.querySelector('.token-head');
    const name = card.querySelector('#primaryName');
    const meta = card.querySelector('#primaryMeta');
    const score = card.querySelector('#primaryScore');
    if (!head || !name || !meta || !score) return null;
    return { card, head, name, meta, score };
  }

  function scoreWrap(head, score) {
    return score.parentElement || head.lastElementChild || null;
  }

  function findAvatarCandidate(head, name, meta, score) {
    const scoreBlock = scoreWrap(head, score);
    const firstBlock = head.firstElementChild;
    const candidates = [];
    const push = el => { if (el && !candidates.includes(el) && el !== name && el !== meta && el !== score && el !== scoreBlock) candidates.push(el); };

    if (firstBlock) {
      [...firstBlock.children].forEach(push);
      push(firstBlock);
      [...firstBlock.querySelectorAll('img')].forEach(push);
      [...firstBlock.querySelectorAll('*')].forEach(el => {
        const bg = getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none') push(el);
      });
    }

    [...head.querySelectorAll('img')].forEach(push);
    [...head.querySelectorAll('*')].forEach(el => {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none') push(el);
    });

    const scored = candidates.map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const bg = cs.backgroundImage && cs.backgroundImage !== 'none';
      let w = 0;
      if (el.tagName === 'IMG') w += 1000;
      if (bg) w += 900;
      if (Math.abs(r.width - r.height) < 18) w += 150;
      if (r.width >= 20 && r.height >= 20) w += 120;
      if (firstBlock && firstBlock.contains(el)) w += 200;
      return { el, w };
    }).sort((a,b) => b.w - a.w);

    return scored[0]?.el || null;
  }

  function ensureIdentity(head, name, meta, score) {
    head.classList.add('mf-primary-token-head');

    const scoreBlock = scoreWrap(head, score);
    if (scoreBlock) scoreBlock.classList.add('mf-primary-score-wrap');

    let identity = head.querySelector('.mf-primary-identity');
    if (!identity) {
      identity = document.createElement('div');
      identity.className = 'mf-primary-identity';
      if (head.firstChild) head.insertBefore(identity, head.firstChild);
      else head.appendChild(identity);
    }

    let texts = identity.querySelector('.mf-primary-texts');
    if (!texts) {
      texts = document.createElement('div');
      texts.className = 'mf-primary-texts';
      identity.appendChild(texts);
    }

    if (name.parentElement !== texts) texts.appendChild(name);
    if (meta.parentElement !== texts) texts.appendChild(meta);

    const avatarEl = findAvatarCandidate(head, name, meta, score);
    if (!avatarEl) return { identity, texts, avatarBox: null };

    let avatarBox = avatarEl;
    const parent = avatarEl.parentElement;
    if (parent && parent !== identity && parent !== head && parent.children.length === 1) {
      const pr = parent.getBoundingClientRect();
      const ar = avatarEl.getBoundingClientRect();
      if (Math.abs(pr.width - ar.width) < 18 && Math.abs(pr.height - ar.height) < 18) avatarBox = parent;
    }

    if (avatarBox.parentElement !== identity) identity.insertBefore(avatarBox, texts);
    avatarBox.classList.add('mf-primary-avatar-box');
    avatarBox.style.removeProperty('left');
    avatarBox.style.removeProperty('right');
    avatarBox.style.removeProperty('top');
    avatarBox.style.removeProperty('bottom');
    avatarBox.style.removeProperty('transform');
    avatarBox.style.removeProperty('margin-left');
    avatarBox.style.removeProperty('margin-top');

    const bg = getComputedStyle(avatarBox).backgroundImage;
    if (bg && bg !== 'none' && avatarBox.tagName !== 'IMG') avatarBox.classList.add('mf-primary-bg-avatar');

    return { identity, texts, avatarBox };
  }

  function apply() {
    removeOld();
    const ref = getPrimary();
    if (!ref) return;
    const { head, name, meta, score } = ref;
    const { avatarBox } = ensureIdentity(head, name, meta, score);
    if (!avatarBox || !visible(score)) return;

    const sr = score.getBoundingClientRect();
    let size = Math.round(sr.height);
    size = Math.max(44, Math.min(72, size));
    avatarBox.style.setProperty('--mf-primary-avatar-size', size + 'px');
  }

  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
  };

  const start = () => {
    schedule();
    const root = document.documentElement;
    const mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
    window.addEventListener('resize', schedule, { passive: true });
    setInterval(schedule, 1200);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
</script>
${END}`;

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.cache') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

function stripOld(content) {
  const patterns = [
    [/<!-- MF_PRIMARY_IDENTITY_ALIGN_PATCH_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_ALIGN_PATCH_END -->/g, ''],
    [/<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_START -->[\s\S]*?<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_END -->/g, ''],
    [/<style id="mf-primary-avatar-score-height-style">[\s\S]*?<\/style>/g, ''],
    [/<script id="mf-primary-avatar-score-height-script">[\s\S]*?<\/script>/g, '']
  ];
  let out = content;
  for (const [re, rep] of patterns) out = out.replace(re, rep);
  return out;
}

const htmlFiles = walk(process.cwd()).filter(f => {
  try {
    const txt = fs.readFileSync(f, 'utf8');
    return txt.includes('id="primary-candidate"') && txt.includes('id="primaryName"') && txt.includes('id="primaryMeta"') && txt.includes('id="primaryScore"');
  } catch { return false; }
});

if (!htmlFiles.length) {
  console.error('No HTML files with Primary Candidate structure were found.');
  process.exit(1);
}

let patched = 0;
for (const file of htmlFiles) {
  let html = fs.readFileSync(file, 'utf8');
  html = stripOld(html);
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) continue;
  const backup = file + '.before-primary-identity-align-v6.bak';
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  html = html.slice(0, idx) + '\n' + PATCH + '\n' + html.slice(idx);
  fs.writeFileSync(file, html, 'utf8');
  console.log('PATCHED:', file);
  patched++;
}

console.log('');
console.log('MEMEFLOW Primary Identity Align V6 installed.');
console.log('Patched HTML files:', patched);
console.log('AI SCORE is not moved by V6.');
console.log('V6 removes old moving/transform behavior and rebuilds the left identity block structurally.');
