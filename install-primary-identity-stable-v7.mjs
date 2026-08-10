import fs from 'node:fs';
import path from 'node:path';

const VERSION = 'MEMEFLOW_PRIMARY_IDENTITY_STABLE_V7';
const STYLE_START = '<!-- MF_PRIMARY_IDENTITY_STABLE_V7_STYLE_START -->';
const STYLE_END = '<!-- MF_PRIMARY_IDENTITY_STABLE_V7_STYLE_END -->';
const SCRIPT_START = '<!-- MF_PRIMARY_IDENTITY_STABLE_V7_SCRIPT_START -->';
const SCRIPT_END = '<!-- MF_PRIMARY_IDENTITY_STABLE_V7_SCRIPT_END -->';

const NEW_HEAD = `<div class="token-head mf-primary-stable-head" data-mf-primary-layout="v7"><div class="mf-primary-stable-identity"><div class="mf-primary-stable-avatar" id="primaryAvatar" aria-hidden="true"><span id="primaryAvatarFallback">?</span><img id="primaryAvatarImage" alt="" hidden=""></div><div class="mf-primary-stable-copy"><div class="token-name" id="primaryName">—</div><div class="score-caption" id="primaryMeta">No token selected</div></div></div><div class="mf-primary-stable-score"><div class="big-score" id="primaryScore">—</div><div class="score-caption">AI SCORE</div></div></div>`;

const STYLE = `${STYLE_START}
<style id="mf-primary-identity-stable-v7-style">
/*
  MEMEFLOW Primary Candidate identity — stable V7.
  Layout only. No score transform, no runtime position measuring, no DOM moving.
*/
#primary-candidate .token-head.mf-primary-stable-head{
  display:grid !important;
  grid-template-columns:minmax(0,1fr) auto !important;
  align-items:start !important;
  column-gap:14px !important;
  width:100% !important;
  min-width:0 !important;
}
#primary-candidate .mf-primary-stable-identity{
  display:grid !important;
  grid-template-columns:54px minmax(0,1fr) !important;
  align-items:start !important;
  column-gap:12px !important;
  justify-self:start !important;
  min-width:0 !important;
  max-width:100% !important;
  margin:0 !important;
  padding:0 !important;
  position:static !important;
  transform:none !important;
}
#primary-candidate .mf-primary-stable-avatar{
  width:54px !important;
  height:54px !important;
  min-width:54px !important;
  min-height:54px !important;
  max-width:54px !important;
  max-height:54px !important;
  margin:0 !important;
  padding:0 !important;
  position:relative !important;
  inset:auto !important;
  transform:none !important;
  overflow:hidden !important;
  border-radius:14px !important;
  border:1px solid rgba(151,171,194,.28) !important;
  background:#101720 !important;
  box-sizing:border-box !important;
  align-self:start !important;
}
#primary-candidate .mf-primary-stable-avatar > img{
  position:absolute !important;
  inset:0 !important;
  width:100% !important;
  height:100% !important;
  min-width:100% !important;
  min-height:100% !important;
  max-width:none !important;
  max-height:none !important;
  margin:0 !important;
  padding:0 !important;
  object-fit:cover !important;
  display:block !important;
  transform:none !important;
}
#primary-candidate .mf-primary-stable-avatar > img[hidden]{display:none !important}
#primary-candidate .mf-primary-stable-avatar > span{
  position:absolute !important;
  inset:0 !important;
  display:grid !important;
  place-items:center !important;
  color:#9aa8b8 !important;
  font-size:20px !important;
  font-weight:800 !important;
  line-height:1 !important;
}
#primary-candidate .mf-primary-stable-avatar > span[hidden]{display:none !important}
#primary-candidate .mf-primary-stable-copy{
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
  min-width:0 !important;
  max-width:100% !important;
  margin:0 !important;
  padding:0 !important;
  line-height:1.02 !important;
  white-space:nowrap !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  position:static !important;
  transform:none !important;
}
#primary-candidate #primaryMeta{
  display:block !important;
  min-width:0 !important;
  max-width:100% !important;
  margin:6px 0 0 0 !important;
  padding:0 !important;
  line-height:1 !important;
  white-space:nowrap !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  position:static !important;
  transform:none !important;
}
#primary-candidate .mf-primary-stable-score{
  min-width:max-content !important;
  justify-self:end !important;
  align-self:start !important;
  margin:0 !important;
  padding:0 !important;
  position:static !important;
  transform:none !important;
}
/* Suppress legacy avatar copies if an older non-V7 script tries to append one. */
#primary-candidate .mf-primary-stable-copy > img,
#primary-candidate .mf-primary-stable-copy > [class*="avatar"],
#primary-candidate .mf-primary-stable-head > img,
#primary-candidate .mf-primary-stable-head > [class*="avatar"]:not(.mf-primary-stable-identity){
  display:none !important;
}
@media(max-width:390px){
  #primary-candidate .token-head.mf-primary-stable-head{column-gap:10px !important}
  #primary-candidate .mf-primary-stable-identity{grid-template-columns:54px minmax(0,1fr) !important;column-gap:10px !important}
}
</style>
${STYLE_END}`;

const SCRIPT = `${SCRIPT_START}
<script id="mf-primary-identity-stable-v7-script">
(() => {
  'use strict';
  if (window.__MF_PRIMARY_IDENTITY_STABLE_V7__) return;
  window.__MF_PRIMARY_IDENTITY_STABLE_V7__ = true;

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

  function paint(candidate) {
    const img = document.getElementById('primaryAvatarImage');
    const fallback = document.getElementById('primaryAvatarFallback');
    if (!img || !fallback) return;

    const has = Boolean(candidate && candidate.id);
    const label = String(first(candidate?.name, candidate?.symbol, '?') || '?').trim();
    const url = has ? safeImageUrl(first(
      candidate?.imageUrl,
      candidate?.image,
      candidate?.logoUrl,
      candidate?.metadata?.image,
      candidate?.token?.imageUrl,
      candidate?.token?.image
    )) : '';

    fallback.textContent = has ? (label.charAt(0) || '?').toUpperCase() : '?';

    if (!url) {
      img.hidden = true;
      img.removeAttribute('src');
      img.dataset.mfSrc = '';
      fallback.hidden = false;
      return;
    }

    if (img.dataset.mfSrc === url && img.complete && img.naturalWidth > 0) {
      img.hidden = false;
      fallback.hidden = true;
      return;
    }

    fallback.hidden = false;
    img.hidden = true;
    img.dataset.mfSrc = url;
    img.src = url;
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

  document.addEventListener('memeflow:statechange', event => {
    paint(event?.detail?.candidate || null);
  });

  const initial = () => {
    try { paint(window.MEMEFLOW_CORE?.getSelected?.() || null); }
    catch { paint(null); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initial, { once:true });
  } else {
    initial();
  }
})();
</script>
${SCRIPT_END}`;

function stripBlocks(html) {
  const blockPatterns = [
    /<!-- MF_PRIMARY_IDENTITY_ALIGN_PATCH_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_ALIGN_PATCH_END -->/g,
    /<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_START -->[\s\S]*?<!-- MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_END -->/g,
    /<!-- MF_PRIMARY_IDENTITY_STABLE_V7_STYLE_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_STABLE_V7_STYLE_END -->/g,
    /<!-- MF_PRIMARY_IDENTITY_STABLE_V7_SCRIPT_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_STABLE_V7_SCRIPT_END -->/g
  ];
  let out = html;
  for (const re of blockPatterns) out = out.replace(re, '');

  const oldIds = [
    'mf-primary-avatar-score-height-style','mf-primary-avatar-score-height-script',
    'mf-primary-identity-align-v2-style','mf-primary-identity-align-v2-script',
    'mf-primary-identity-align-v3-style','mf-primary-identity-align-v3-script',
    'mf-primary-identity-align-v4-style','mf-primary-identity-align-v4-script',
    'mf-primary-identity-align-v5-style','mf-primary-identity-align-v5-script',
    'mf-primary-identity-align-v6-style','mf-primary-identity-align-v6-script',
    'mf-primary-identity-stable-v7-style','mf-primary-identity-stable-v7-script'
  ];
  for (const id of oldIds) {
    out = out.replace(new RegExp(`<style\\s+id=["']${id}["'][^>]*>[\\s\\S]*?<\\/style>`, 'g'), '');
    out = out.replace(new RegExp(`<script\\s+id=["']${id}["'][^>]*>[\\s\\S]*?<\\/script>`, 'g'), '');
  }
  return out;
}

function replacePrimaryTokenHead(html) {
  const nameIdx = html.indexOf('id="primaryName"');
  if (nameIdx < 0) throw new Error('primaryName not found');

  const start = html.lastIndexOf('<div class="token-head', nameIdx);
  if (start < 0) throw new Error('Primary .token-head opening div not found');

  const tokenRe = /<div\b[^>]*>|<\/div\s*>/gi;
  tokenRe.lastIndex = start;
  let depth = 0;
  let end = -1;
  let match;
  while ((match = tokenRe.exec(html))) {
    if (/^<div\b/i.test(match[0])) depth += 1;
    else depth -= 1;
    if (depth === 0) {
      end = tokenRe.lastIndex;
      break;
    }
  }
  if (end < 0) throw new Error('Primary .token-head closing div not found');

  const old = html.slice(start, end);
  if (!old.includes('id="primaryName"') || !old.includes('id="primaryMeta"') || !old.includes('id="primaryScore"')) {
    throw new Error('Located token-head does not contain all Primary Candidate IDs');
  }

  return html.slice(0, start) + NEW_HEAD + html.slice(end);
}

function resolveTarget() {
  const explicit = process.argv[2];
  if (explicit) return path.resolve(explicit);
  const candidates = [
    path.resolve('memeflow-app/index.html'),
    path.resolve('index.html')
  ];
  return candidates.find(fs.existsSync) || candidates[0];
}

const target = resolveTarget();
if (!fs.existsSync(target)) {
  console.error('ERROR: Primary app index.html not found:', target);
  process.exit(1);
}

let html = fs.readFileSync(target, 'utf8');
if (!html.includes('id="primary-candidate"') || !html.includes('id="primaryScore"')) {
  console.error('ERROR: This file does not contain the Primary Candidate UI.');
  process.exit(1);
}

const backup = target + '.before-primary-identity-stable-v7.bak';
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);

try {
  html = stripBlocks(html);
  html = replacePrimaryTokenHead(html);

  const headClose = html.lastIndexOf('</head>');
  const bodyClose = html.lastIndexOf('</body>');
  if (headClose < 0 || bodyClose < 0) throw new Error('Missing </head> or </body>');

  html = html.slice(0, headClose) + '\n' + STYLE + '\n' + html.slice(headClose);
  const newBodyClose = html.lastIndexOf('</body>');
  html = html.slice(0, newBodyClose) + '\n' + SCRIPT + '\n' + html.slice(newBodyClose);

  fs.writeFileSync(target, html, 'utf8');
} catch (error) {
  console.error('ERROR:', error.message);
  console.error('File was not intentionally completed. Restore from:', backup);
  process.exit(1);
}

console.log('PATCHED:', path.relative(process.cwd(), target) || target);
console.log('VERSION:', VERSION);
console.log('Backup:', backup);
console.log('V7 uses a static grid. No MutationObserver, no setInterval, no transform positioning.');
console.log('AI SCORE element is preserved and is not styled by the V7 patch.');
console.log('Restart Replit, then hard-refresh the page.');
