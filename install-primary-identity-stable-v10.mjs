import fs from 'node:fs';
import path from 'node:path';

const VERSION = 'MEMEFLOW_PRIMARY_IDENTITY_STABLE_V10';
const STYLE_START = '<!-- MF_PRIMARY_IDENTITY_STABLE_V10_STYLE_START -->';
const STYLE_END = '<!-- MF_PRIMARY_IDENTITY_STABLE_V10_STYLE_END -->';
const SCRIPT_START = '<!-- MF_PRIMARY_IDENTITY_STABLE_V10_SCRIPT_START -->';
const SCRIPT_END = '<!-- MF_PRIMARY_IDENTITY_STABLE_V10_SCRIPT_END -->';

const NEW_HEAD = `<div class="token-head mf-primary-v10-head" data-mf-primary-layout="v10"><div class="mf-primary-v10-identity mf-primary-v10-empty"><div class="mf-primary-v10-avatar" id="primaryAvatar" aria-hidden="true" hidden><span id="primaryAvatarFallback" hidden></span><img id="primaryAvatarImage" alt="" hidden></div><div class="mf-primary-v10-copy"><div class="token-name" id="primaryName">No token selected</div><div class="score-caption" id="primaryMeta"></div></div></div><div class="mf-primary-v10-score"><div class="big-score" id="primaryScore">—</div><div class="score-caption">AI SCORE</div></div></div>`;

const STYLE = `${STYLE_START}
<style id="mf-primary-identity-stable-v10-style">
/* MEMEFLOW V10 — stable Primary Candidate identity.
   AI Score owns the right side and is never repositioned by this patch. */
#primary-candidate .token-head.mf-primary-v10-head{
  display:grid !important;
  grid-template-columns:minmax(0,1fr) auto !important;
  align-items:start !important;
  gap:14px !important;
  width:100% !important;
  min-width:0 !important;
}
#primary-candidate .mf-primary-v10-identity{
  display:grid !important;
  grid-template-columns:var(--mf-primary-avatar-size,64px) minmax(0,1fr) !important;
  align-items:start !important;
  column-gap:12px !important;
  min-width:0 !important;
  justify-self:start !important;
  position:static !important;
  transform:none !important;
  margin:0 !important;
  padding:0 !important;
}
#primary-candidate .mf-primary-v10-identity.mf-primary-v10-empty{
  grid-template-columns:minmax(0,1fr) !important;
  column-gap:0 !important;
}
#primary-candidate .mf-primary-v10-avatar{
  width:var(--mf-primary-avatar-size,64px) !important;
  height:var(--mf-primary-avatar-size,64px) !important;
  min-width:var(--mf-primary-avatar-size,64px) !important;
  min-height:var(--mf-primary-avatar-size,64px) !important;
  max-width:var(--mf-primary-avatar-size,64px) !important;
  max-height:var(--mf-primary-avatar-size,64px) !important;
  overflow:hidden !important;
  border-radius:16px !important;
  border:1px solid rgba(151,171,194,.28) !important;
  background:#101720 !important;
  box-sizing:border-box !important;
  position:relative !important;
  inset:auto !important;
  margin:0 !important;
  padding:0 !important;
  transform:none !important;
  align-self:start !important;
}
#primary-candidate .mf-primary-v10-avatar[hidden]{display:none !important}
#primary-candidate .mf-primary-v10-avatar img{
  position:absolute !important;
  inset:0 !important;
  display:block !important;
  width:100% !important;
  height:100% !important;
  min-width:100% !important;
  min-height:100% !important;
  max-width:none !important;
  max-height:none !important;
  object-fit:cover !important;
  margin:0 !important;
  padding:0 !important;
  transform:none !important;
}
#primary-candidate .mf-primary-v10-avatar img[hidden]{display:none !important}
#primary-candidate .mf-primary-v10-avatar span{
  position:absolute !important;
  inset:0 !important;
  display:grid !important;
  place-items:center !important;
  font-size:calc(var(--mf-primary-avatar-size,64px) * .46) !important;
  line-height:1 !important;
}
#primary-candidate .mf-primary-v10-avatar span[hidden]{display:none !important}
#primary-candidate .mf-primary-v10-copy{
  display:flex !important;
  flex-direction:column !important;
  align-items:flex-start !important;
  justify-content:flex-start !important;
  min-width:0 !important;
  max-width:100% !important;
  margin:0 !important;
  padding:0 !important;
  position:static !important;
  transform:none !important;
}
#primary-candidate #primaryName{
  display:block !important;
  margin:0 !important;
  padding:0 !important;
  min-width:0 !important;
  max-width:100% !important;
  line-height:1.02 !important;
  white-space:nowrap !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  position:static !important;
  transform:none !important;
}
#primary-candidate #primaryMeta{
  display:block !important;
  margin:7px 0 0 !important;
  padding:0 !important;
  min-width:0 !important;
  max-width:100% !important;
  line-height:1 !important;
  white-space:nowrap !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  position:static !important;
  transform:none !important;
}
#primary-candidate #primaryMeta:empty{display:none !important}
#primary-candidate .mf-primary-v10-empty #primaryName{
  color:var(--muted,#8c9aaa) !important;
  font-size:14px !important;
  font-weight:500 !important;
  letter-spacing:0 !important;
  line-height:1.3 !important;
}
#primary-candidate .mf-primary-v10-score{
  justify-self:end !important;
  align-self:start !important;
  min-width:max-content !important;
  margin:0 !important;
  padding:0 !important;
  position:static !important;
  transform:none !important;
}
/* suppress only old duplicate visuals, never the V10 identity */
#primary-candidate .token-head.mf-primary-v10-head > :not(.mf-primary-v10-identity):not(.mf-primary-v10-score),
#primary-candidate .mf-primary-v10-identity > :not(.mf-primary-v10-avatar):not(.mf-primary-v10-copy),
#primary-candidate .mf-primary-v10-copy > :not(#primaryName):not(#primaryMeta){display:none !important}
@media(max-width:390px){
  #primary-candidate .token-head.mf-primary-v10-head{gap:10px !important}
  #primary-candidate .mf-primary-v10-identity{column-gap:10px !important}
}
</style>
${STYLE_END}`;

const SCRIPT = `${SCRIPT_START}
<script id="mf-primary-identity-stable-v10-script">
(() => {
  'use strict';
  if (window.__MF_PRIMARY_IDENTITY_STABLE_V10__) return;
  window.__MF_PRIMARY_IDENTITY_STABLE_V10__ = true;

  const first = (...values) => values.find(v => v !== undefined && v !== null && v !== '');

  function safeImageUrl(raw) {
    if (!raw) return '';
    const value = String(raw).trim();
    if (!value) return '';
    if (/^ipfs:\/\//i.test(value)) return 'https://ipfs.io/ipfs/' + value.replace(/^ipfs:\/\//i, '');
    if (/^ar:\/\//i.test(value)) return 'https://arweave.net/' + value.replace(/^ar:\/\//i, '');
    if (/^https?:\/\//i.test(value) || /^data:image\//i.test(value) || /^blob:/i.test(value)) return value;
    return '';
  }

  function currentCandidate(event) {
    /* IMPORTANT: memeflow:candidatechange carries only name/symbol/mint and no id.
       Never interpret that lightweight detail as "no candidate". The authoritative
       candidate is MEMEFLOW_CORE.getSelected() / memeflow:statechange.detail.candidate. */
    if (event?.type === 'memeflow:statechange' && event?.detail?.candidate?.id) {
      return event.detail.candidate;
    }
    try {
      const selected = window.MEMEFLOW_CORE?.getSelected?.();
      if (selected?.id) return selected;
    } catch {}
    return event?.detail?.candidate?.id ? event.detail.candidate : null;
  }

  function imageUrl(candidate) {
    return safeImageUrl(first(
      candidate?.imageUrl,
      candidate?.image,
      candidate?.logoUrl,
      candidate?.metadata?.image,
      candidate?.metadata?.imageUrl,
      candidate?.token?.imageUrl,
      candidate?.token?.image,
      candidate?.token?.logoUrl
    ));
  }

  function sizeAvatarToScore() {
    const score = document.getElementById('primaryScore');
    const identity = document.querySelector('#primary-candidate .mf-primary-v10-identity');
    if (!score || !identity) return;
    const rect = score.getBoundingClientRect();
    const cs = getComputedStyle(score);
    const font = parseFloat(cs.fontSize) || 0;
    let size = Math.round(Math.max(font, rect.height * .94));
    size = Math.max(52, Math.min(78, size || 64));
    identity.style.setProperty('--mf-primary-avatar-size', size + 'px');
  }

  function paint(candidate) {
    const identity = document.querySelector('#primary-candidate .mf-primary-v10-identity');
    const avatar = document.getElementById('primaryAvatar');
    const img = document.getElementById('primaryAvatarImage');
    const fallback = document.getElementById('primaryAvatarFallback');
    const name = document.getElementById('primaryName');
    const meta = document.getElementById('primaryMeta');
    if (!identity || !avatar || !img || !fallback || !name || !meta) return;

    const has = Boolean(candidate?.id);
    if (!has) {
      identity.classList.add('mf-primary-v10-empty');
      avatar.hidden = true;
      img.hidden = true;
      fallback.hidden = true;
      name.textContent = 'No token selected';
      meta.textContent = '';
      return;
    }

    identity.classList.remove('mf-primary-v10-empty');
    avatar.hidden = false;

    const tokenName = String(first(candidate?.name, candidate?.symbol, 'Token'));
    const symbol = String(first(candidate?.symbol, candidate?.tokenSymbol, ''));
    const mint = String(first(candidate?.mint, candidate?.tokenMint, candidate?.tokenAddress, candidate?.address, ''));
    name.textContent = tokenName;
    meta.textContent = symbol || (mint ? mint.slice(0,5) + '…' + mint.slice(-5) : '');

    const url = imageUrl(candidate);
    if (url) {
      fallback.hidden = true;
      if (img.dataset.mfSrc !== url) {
        img.dataset.mfSrc = url;
        img.hidden = true;
        img.src = url;
      } else if (img.complete && img.naturalWidth > 0) {
        img.hidden = false;
      }
    } else {
      img.hidden = true;
      img.removeAttribute('src');
      img.dataset.mfSrc = '';
      /* Preserve emoji/logo-style fallback if supplied by token data; otherwise first letter. */
      fallback.textContent = String(first(candidate?.emoji, candidate?.icon, candidate?.logoEmoji, tokenName.charAt(0), 'T'));
      fallback.hidden = false;
    }

    sizeAvatarToScore();
  }

  function sync(event) {
    const c = currentCandidate(event);
    paint(c);
    requestAnimationFrame(() => {
      const latest = currentCandidate();
      paint(latest || c);
      sizeAvatarToScore();
    });
  }

  const img = document.getElementById('primaryAvatarImage');
  const fallback = document.getElementById('primaryAvatarFallback');
  if (img && fallback) {
    img.addEventListener('load', () => {
      if (img.naturalWidth > 0) {
        img.hidden = false;
        fallback.hidden = true;
      }
    });
    img.addEventListener('error', () => {
      img.hidden = true;
      fallback.hidden = false;
    });
  }

  document.addEventListener('memeflow:statechange', sync);
  window.addEventListener('memeflow:candidatechange', sync);
  window.addEventListener('resize', sizeAvatarToScore, { passive:true });

  const initial = () => sync();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initial, { once:true });
  else initial();
})();
</script>
${SCRIPT_END}`;

function stripBlocks(html) {
  const blocks = [
    /<!-- MF_PRIMARY_IDENTITY_ALIGN_PATCH_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_ALIGN_PATCH_END -->/g,
    /<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_START -->[\s\S]*?<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_END -->/g,
    /<!-- MF_PRIMARY_IDENTITY_STABLE_V7_STYLE_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_STABLE_V7_STYLE_END -->/g,
    /<!-- MF_PRIMARY_IDENTITY_STABLE_V7_SCRIPT_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_STABLE_V7_SCRIPT_END -->/g,
    /<!-- MF_PRIMARY_IDENTITY_STABLE_V8_STYLE_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_STABLE_V8_STYLE_END -->/g,
    /<!-- MF_PRIMARY_IDENTITY_STABLE_V8_SCRIPT_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_STABLE_V8_SCRIPT_END -->/g,
    /<!-- MF_PRIMARY_IDENTITY_STABLE_V9_STYLE_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_STABLE_V9_STYLE_END -->/g,
    /<!-- MF_PRIMARY_IDENTITY_STABLE_V9_SCRIPT_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_STABLE_V9_SCRIPT_END -->/g,
    /<!-- MF_PRIMARY_IDENTITY_STABLE_V10_STYLE_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_STABLE_V10_STYLE_END -->/g,
    /<!-- MF_PRIMARY_IDENTITY_STABLE_V10_SCRIPT_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_STABLE_V10_SCRIPT_END -->/g
  ];
  let out = html;
  for (const re of blocks) out = out.replace(re, '');
  return out;
}

function replacePrimaryTokenHead(html) {
  const nameIdx = html.indexOf('id="primaryName"');
  if (nameIdx < 0) throw new Error('primaryName not found');
  const start = html.lastIndexOf('<div class="token-head', nameIdx);
  if (start < 0) throw new Error('Primary .token-head not found');
  const tokenRe = /<div\b[^>]*>|<\/div\s*>/gi;
  tokenRe.lastIndex = start;
  let depth = 0, end = -1, m;
  while ((m = tokenRe.exec(html))) {
    if (/^<div\b/i.test(m[0])) depth++;
    else depth--;
    if (depth === 0) { end = tokenRe.lastIndex; break; }
  }
  if (end < 0) throw new Error('Primary .token-head closing div not found');
  return html.slice(0,start) + NEW_HEAD + html.slice(end);
}

const target = process.argv[2] ? path.resolve(process.argv[2]) : (fs.existsSync(path.resolve('memeflow-app/index.html')) ? path.resolve('memeflow-app/index.html') : path.resolve('index.html'));
if (!fs.existsSync(target)) { console.error('ERROR: index.html not found:', target); process.exit(1); }
let html = fs.readFileSync(target,'utf8');
if (!html.includes('id="primary-candidate"')) { console.error('ERROR: Primary Candidate not found.'); process.exit(1); }
const backup = target + '.before-primary-identity-stable-v10.bak';
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);

try {
  html = stripBlocks(html);
  html = replacePrimaryTokenHead(html);
  const headClose = html.lastIndexOf('</head>');
  if (headClose < 0) throw new Error('Missing </head>');
  html = html.slice(0,headClose) + '\n' + STYLE + '\n' + html.slice(headClose);
  const bodyClose = html.lastIndexOf('</body>');
  if (bodyClose < 0) throw new Error('Missing </body>');
  html = html.slice(0,bodyClose) + '\n' + SCRIPT + '\n' + html.slice(bodyClose);
  fs.writeFileSync(target,html,'utf8');
} catch (e) {
  console.error('ERROR:',e.message); process.exit(1);
}

console.log('PATCHED:', path.relative(process.cwd(),target) || target);
console.log('VERSION:', VERSION);
console.log('V10 fixes candidatechange-without-id bug from V9.');
console.log('V10 restores big token name + small symbol and keeps one token logo.');
console.log('V10 sizes logo from #primaryScore height/font-size; AI SCORE itself is never moved.');
console.log('Restart Replit and hard-refresh.');
