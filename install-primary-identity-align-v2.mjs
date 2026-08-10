import fs from 'node:fs';
import path from 'node:path';

const NEW_START = '<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V2_START -->';
const NEW_END   = '<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V2_END -->';
const OLD_BLOCKS = [
  ['<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_START -->','<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_END -->'],
  [NEW_START, NEW_END],
];

function stripBlock(html, start, end) {
  for (;;) {
    const a = html.indexOf(start);
    if (a < 0) return html;
    const b = html.indexOf(end, a + start.length);
    if (b < 0) return html;
    html = html.slice(0, a) + html.slice(b + end.length);
  }
}

const PATCH = String.raw`${NEW_START}
<style id="mf-primary-identity-align-v2-style">
/*
  MEMEFLOW Primary Candidate identity alignment V2
  - NEVER changes #primaryScore or its parent.
  - Avatar height follows #primaryScore rendered height.
  - Avatar top follows #primaryScore top; equal height makes bottoms coincide.
  - #primaryMeta is moved inline next to #primaryName.
*/
#primary-candidate .mf-primary-identity-v2{
  display:flex!important;
  align-items:flex-start!important;
  gap:10px!important;
  min-width:0!important;
  margin:0!important;
  padding:0!important;
  flex:1 1 auto!important;
}
#primary-candidate .mf-primary-avatar-v2{
  display:block!important;
  box-sizing:border-box!important;
  height:var(--mf-primary-score-h)!important;
  width:var(--mf-primary-score-h)!important;
  min-height:var(--mf-primary-score-h)!important;
  min-width:var(--mf-primary-score-h)!important;
  max-height:none!important;
  max-width:none!important;
  flex:0 0 var(--mf-primary-score-h)!important;
  aspect-ratio:1 / 1!important;
  object-fit:cover!important;
  margin:0!important;
  transform:translateY(var(--mf-primary-avatar-y,0px))!important;
}
#primary-candidate .mf-primary-title-line-v2{
  display:flex!important;
  align-items:baseline!important;
  flex-wrap:nowrap!important;
  gap:8px!important;
  min-width:0!important;
  align-self:center!important;
  margin:0!important;
  padding:0!important;
  white-space:nowrap!important;
}
#primary-candidate .mf-primary-title-line-v2 #primaryName{
  min-width:0!important;
  max-width:100%!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  white-space:nowrap!important;
  margin:0!important;
}
#primary-candidate .mf-primary-title-line-v2 #primaryMeta{
  display:inline-block!important;
  flex:0 1 auto!important;
  min-width:0!important;
  margin:0!important;
  padding:0!important;
  line-height:1!important;
  font-size:9px!important;
  letter-spacing:.08em!important;
  text-transform:uppercase!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  vertical-align:baseline!important;
}
#primary-candidate .mf-primary-empty-old-v2{
  display:none!important;
}
@media(max-width:430px){
  #primary-candidate .mf-primary-identity-v2{gap:9px!important}
  #primary-candidate .mf-primary-title-line-v2{gap:6px!important}
  #primary-candidate .mf-primary-title-line-v2 #primaryMeta{font-size:8px!important;letter-spacing:.06em!important}
}
</style>
<script id="mf-primary-identity-align-v2-script">
(() => {
  'use strict';
  const $ = (s,r=document) => r.querySelector(s);
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) !== 0 && r.width > 0 && r.height > 0;
  };

  function chooseAvatar(card, tokenHead, name) {
    const imgs = [...card.querySelectorAll('img')].filter(visible);
    if (!imgs.length) return null;
    const nr = name.getBoundingClientRect();
    let best = null, bestScore = Infinity;
    for (const img of imgs) {
      const r = img.getBoundingClientRect();
      const inHead = tokenHead.contains(img) ? -1000 : 0;
      const vertical = Math.abs((r.top + r.height/2) - (nr.top + nr.height/2));
      const horizontal = Math.abs(r.left - nr.left);
      const squarePenalty = Math.abs(r.width-r.height) * .25;
      const score = inHead + vertical*2 + horizontal*.15 + squarePenalty;
      if (score < bestScore) { best = img; bestScore = score; }
    }
    return best;
  }

  function cleanupOldRuntimeClasses(card) {
    card.querySelectorAll('.mf-primary-avatar-score-height-target,.mf-primary-avatar-score-height-wrap,.mf-primary-avatar-score-align-box').forEach(el => {
      el.classList.remove('mf-primary-avatar-score-height-target','mf-primary-avatar-score-height-wrap','mf-primary-avatar-score-align-box');
      el.style.removeProperty('--mf-primary-avatar-height');
      el.style.removeProperty('--mf-primary-avatar-offset');
    });
  }

  function normalize() {
    const card = $('#primary-candidate');
    const score = $('#primaryScore',card || document);
    const name = $('#primaryName',card || document);
    const meta = $('#primaryMeta',card || document);
    if (!card || !score || !name || !meta || !visible(score)) return;

    const tokenHead = name.closest('.token-head') || score.closest('.token-head');
    if (!tokenHead) return;
    const scoreBlock = score.parentElement;
    if (!scoreBlock || !tokenHead.contains(scoreBlock)) return;

    cleanupOldRuntimeClasses(card);

    const avatar = chooseAvatar(card, tokenHead, name);
    if (!avatar) return; // wait for token metadata/image render

    let identity = $('.mf-primary-identity-v2',tokenHead);
    if (!identity) {
      identity = document.createElement('div');
      identity.className = 'mf-primary-identity-v2';
      tokenHead.insertBefore(identity, scoreBlock);
    }

    let titleLine = $('.mf-primary-title-line-v2',identity);
    if (!titleLine) {
      titleLine = document.createElement('div');
      titleLine.className = 'mf-primary-title-line-v2';
      identity.appendChild(titleLine);
    }

    // Move only the avatar image; AI score DOM is deliberately untouched.
    if (avatar.parentElement !== identity) identity.insertBefore(avatar, titleLine);
    if (name.parentElement !== titleLine) titleLine.appendChild(name);
    if (meta.parentElement !== titleLine) titleLine.appendChild(meta);

    avatar.classList.add('mf-primary-avatar-v2');

    // Hide only containers left empty by moving the original name/meta/image nodes.
    [...tokenHead.children].forEach(child => {
      if (child === identity || child === scoreBlock) return;
      const meaningfulText = (child.textContent || '').trim();
      const meaningfulMedia = child.querySelector?.('img,svg,button,a,input');
      if (!meaningfulText && !meaningfulMedia) child.classList.add('mf-primary-empty-old-v2');
    });

    // PASS 1: exact rendered score element height. Score itself is never modified.
    const sr = score.getBoundingClientRect();
    let h = Math.round(sr.height);
    if (!Number.isFinite(h) || h < 20) return;
    h = Math.max(38, Math.min(120, h));
    avatar.style.setProperty('--mf-primary-score-h', h + 'px');
    avatar.style.setProperty('--mf-primary-avatar-y', '0px');

    // PASS 2: after applying height, move AVATAR ONLY so its top equals score top.
    requestAnimationFrame(() => {
      if (!avatar.isConnected || !score.isConnected) return;
      const scoreNow = score.getBoundingClientRect();
      const avatarNow = avatar.getBoundingClientRect();
      let dy = Math.round((scoreNow.top - avatarNow.top) * 10) / 10;
      if (Math.abs(dy) < .5) dy = 0;
      dy = Math.max(-48, Math.min(48, dy));
      avatar.style.setProperty('--mf-primary-avatar-y', dy + 'px');
    });
  }

  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(normalize);
  };

  const start = () => {
    const observer = new MutationObserver(schedule);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    schedule();
    [80,180,400,800,1400].forEach(ms => setTimeout(schedule,ms));
    window.addEventListener('resize',schedule,{passive:true});
    document.addEventListener('memeflow:statechange',schedule);
    document.addEventListener('memeflow:candidatechange',schedule);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
</script>
${NEW_END}`;

function targetPath() {
  const explicit = process.argv[2];
  if (explicit) return path.resolve(explicit);
  const candidates = [path.resolve('memeflow-app/index.html'), path.resolve('index.html')];
  return candidates.find(fs.existsSync) || candidates[0];
}

const target = targetPath();
if (!fs.existsSync(target)) {
  console.error('ERROR: MEMEFLOW index.html not found: ' + target);
  console.error('Run from project root or pass the file path explicitly.');
  process.exit(1);
}

let html = fs.readFileSync(target,'utf8');
for (const [s,e] of OLD_BLOCKS) html = stripBlock(html,s,e);
const bodyAt = html.lastIndexOf('</body>');
if (bodyAt < 0) {
  console.error('ERROR: </body> not found. No changes made.');
  process.exit(1);
}

const backup = target + '.before-primary-identity-v2.bak';
if (!fs.existsSync(backup)) fs.copyFileSync(target,backup);
html = html.slice(0,bodyAt) + '\n' + PATCH + '\n' + html.slice(bodyAt);
fs.writeFileSync(target,html,'utf8');

console.log('MEMEFLOW Primary Identity Align V2 installed.');
console.log('Target: ' + target);
console.log('Backup: ' + backup);
console.log('Old Primary Avatar Score Height patch block removed if present.');
console.log('AI score DOM/CSS is untouched.');
console.log('Avatar follows score top+height; primaryMeta is inline with primaryName.');
