#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const APP = fs.existsSync(path.join(ROOT, 'memeflow-app'))
  ? path.join(ROOT, 'memeflow-app')
  : ROOT;

const paths = {
  server: path.join(APP, 'app-server.mjs'),
  trading: path.join(APP, 'trading.js'),
  tokens: path.join(APP, 'system-tokens.js'),
  index: path.join(APP, 'index.html')
};

const MARK = 'MEMEFLOW_CANONICAL_TOKEN_IMAGE_V2';

function fail(msg) {
  console.error('\n[IMAGE-V2] ERROR:', msg);
  process.exit(1);
}
function read(p) {
  if (!fs.existsSync(p)) fail('Missing file: ' + p);
  return fs.readFileSync(p, 'utf8');
}
function write(p, s) {
  fs.writeFileSync(p, s, 'utf8');
}
function replaceOne(src, regex, replacement, label) {
  const matches = src.match(regex);
  if (!matches) fail('Expected code not found: ' + label);
  const out = src.replace(regex, replacement);
  if (out === src) fail('Replacement made no change: ' + label);
  return out;
}

let server = read(paths.server);
let trading = read(paths.trading);
let tokens = read(paths.tokens);
let index = read(paths.index);

if (
  server.includes(MARK) &&
  trading.includes(MARK) &&
  tokens.includes(MARK) &&
  index.includes(MARK)
) {
  console.log('[IMAGE-V2] Already installed.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(ROOT, '.patch-backups', 'canonical-token-image-v2-' + stamp);
fs.mkdirSync(backupDir, { recursive: true });

for (const p of Object.values(paths)) {
  fs.copyFileSync(p, path.join(backupDir, path.basename(p)));
}
console.log('[IMAGE-V2] Backup:', path.relative(ROOT, backupDir));

/* ------------------------------------------------------------------
   BACKEND: one same-origin image endpoint for every token image.
   Upstream source of truth is the token's Pump CreateEvent metadata URI.
   Browser never talks to DexScreener/IPFS/Arweave directly.
------------------------------------------------------------------- */

const serverBlock = `
// ===== ${MARK} =====
// One browser-visible image source for all MEMEFLOW token avatars:
//   /api/token-image/<mint>
// Source of truth: token URI captured from Pump CreateEvent -> metadata.image.
// IPFS gateway fallback happens only inside the server, never in UI code.

const __mfCanonicalTokenImageMetaV1 = new Map();
const __mfCanonicalTokenImageBytesV1 = new Map();
const __mfCanonicalTokenImagePendingV1 = new Map();

function __mfCanonicalMediaCandidatesV1(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];

  const out = [];
  const add = v => {
    const u = String(v || '').trim();
    if (u && /^https?:\\/\\//i.test(u) && !out.includes(u)) out.push(u);
  };

  let ipfsPath = '';

  if (/^ipfs:\\/\\//i.test(raw)) {
    ipfsPath = raw
      .replace(/^ipfs:\\/\\//i, '')
      .replace(/^ipfs\\//i, '')
      .replace(/^\\/+/, '');
  } else if (/^https?:\\/\\//i.test(raw)) {
    add(raw);
    const m = /\\/ipfs\\/(.+)$/i.exec(raw);
    if (m?.[1]) ipfsPath = m[1].replace(/^\\/+/, '');
  }

  if (ipfsPath) {
    add('https://ipfs.io/ipfs/' + ipfsPath);
    add('https://dweb.link/ipfs/' + ipfsPath);
    add('https://gateway.pinata.cloud/ipfs/' + ipfsPath);
  }

  if (/^ar:\\/\\//i.test(raw)) {
    add('https://arweave.net/' + raw.replace(/^ar:\\/\\//i, '').replace(/^\\/+/, ''));
  }

  return out;
}

async function __mfCanonicalFetchV1(url, timeoutMs = 2800) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: '*/*',
        'user-agent': 'MEMEFLOW/1.0 canonical-token-image'
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function __mfCanonicalResolveMetaImageV1(mint) {
  mint = String(mint || '').trim();
  if (!mint) return null;

  const cached = __mfCanonicalTokenImageMetaV1.get(mint);
  if (cached) return cached;

  const token = store.state.tokens?.[mint] || null;
  if (!token) return null;

  // ONLY canonical metadata URI. No trade.logoUrl, no DexScreener,
  // no candidate.imageUrl, no alternate frontend source chains.
  const metadataUri = String(token.uri || token.metadataUrl || '').trim();
  if (!metadataUri) return null;

  const metadataCandidates = __mfCanonicalMediaCandidatesV1(metadataUri);

  for (const metadataUrl of metadataCandidates) {
    try {
      const response = await __mfCanonicalFetchV1(metadataUrl, 2800);
      if (!response.ok) continue;

      const metadata = await response.json().catch(() => null);
      if (!metadata || typeof metadata !== 'object') continue;

      const imageRaw = String(
        metadata.image ||
        metadata.image_url ||
        metadata.imageUrl ||
        metadata.logo ||
        metadata.logoURI ||
        metadata?.properties?.files?.[0]?.uri ||
        ''
      ).trim();

      if (!imageRaw) continue;

      const resolved = {
        mint,
        metadataUrl,
        imageRaw,
        imageCandidates: __mfCanonicalMediaCandidatesV1(imageRaw)
      };

      if (!resolved.imageCandidates.length) continue;

      __mfCanonicalTokenImageMetaV1.set(mint, resolved);

      // Publish only the canonical value back into token state so all APIs
      // expose the same identity field from this point forward.
      try {
        store.setToken(mint, {
          canonicalImageUrl: '/api/token-image/' + encodeURIComponent(mint),
          imageSource: 'pump-create-metadata'
        });
      } catch {}

      return resolved;
    } catch {}
  }

  return null;
}

function __mfCanonicalCacheBytesV1(mint, entry) {
  __mfCanonicalTokenImageBytesV1.set(mint, entry);
  while (__mfCanonicalTokenImageBytesV1.size > 500) {
    const first = __mfCanonicalTokenImageBytesV1.keys().next().value;
    __mfCanonicalTokenImageBytesV1.delete(first);
  }
}

async function __mfCanonicalLoadImageBytesV1(mint) {
  const cached = __mfCanonicalTokenImageBytesV1.get(mint);
  if (cached) return cached;

  if (__mfCanonicalTokenImagePendingV1.has(mint)) {
    return __mfCanonicalTokenImagePendingV1.get(mint);
  }

  const task = (async () => {
    const meta = await __mfCanonicalResolveMetaImageV1(mint);
    if (!meta) return null;

    for (const imageUrl of meta.imageCandidates) {
      try {
        const response = await __mfCanonicalFetchV1(imageUrl, 3200);
        if (!response.ok) continue;

        const type = String(response.headers.get('content-type') || '').toLowerCase();
        if (
          type &&
          !type.startsWith('image/') &&
          !type.includes('octet-stream')
        ) {
          continue;
        }

        const length = Number(response.headers.get('content-length') || 0);
        if (Number.isFinite(length) && length > 4 * 1024 * 1024) continue;

        const body = Buffer.from(await response.arrayBuffer());
        if (!body.length || body.length > 4 * 1024 * 1024) continue;

        const entry = {
          body,
          contentType: type.startsWith('image/') ? type : 'image/*'
        };

        __mfCanonicalCacheBytesV1(mint, entry);
        return entry;
      } catch {}
    }

    return null;
  })();

  __mfCanonicalTokenImagePendingV1.set(mint, task);

  try {
    return await task;
  } finally {
    __mfCanonicalTokenImagePendingV1.delete(mint);
  }
}

async function __mfServeCanonicalTokenImageV1(res, mint) {
  mint = String(mint || '').trim();

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
    res.writeHead(400, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store'
    });
    res.end('Invalid mint');
    return;
  }

  const image = await __mfCanonicalLoadImageBytesV1(mint);

  if (!image) {
    res.writeHead(404, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store'
    });
    res.end('Token image unavailable');
    return;
  }

  res.writeHead(200, {
    'content-type': image.contentType,
    'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    'x-memeflow-image-source': 'pump-create-metadata'
  });
  res.end(image.body);
}
// ===== /${MARK} =====
`;

const handlerMarker = "async function handler(req,res){const url=new URL(req.url,'http://x');";
if (!server.includes(handlerMarker)) fail('Server handler marker changed.');
server = server.replace(handlerMarker, serverBlock + '\n' + handlerMarker);

const staticMarker = " if(req.method==='GET'&&!url.pathname.startsWith('/api/')){";
if (!server.includes(staticMarker)) fail('Static route marker changed.');

const imageRoute = ` if(req.method==='GET'&&url.pathname.startsWith('/api/token-image/')){
   const _mint=decodeURIComponent(url.pathname.slice('/api/token-image/'.length)).trim();
   return __mfServeCanonicalTokenImageV1(res,_mint);
 }
`;
server = server.replace(staticMarker, imageRoute + staticMarker);

/* ------------------------------------------------------------------
   TRADING TERMINAL: Candidates / selected / positions / recent trades
   all use exactly /api/token-image/<mint>.
------------------------------------------------------------------- */

const tradingHelper = `function canonicalTokenImageUrlV1(mint) {
  const value = String(mint || '').trim();
  return value
    ? '/api/token-image/' + encodeURIComponent(value)
    : '';
}
// ${MARK}

`;

trading = replaceOne(
  trading,
  /function candidateImageUrl\(candidate\) \{[\s\S]*?\n\}\n\nfunction candidateAvatarMarkup/,
  `${tradingHelper}function candidateImageUrl(candidate) {
  return canonicalTokenImageUrlV1(candidate?.mint);
}

function candidateAvatarMarkup`,
  'candidate image resolver'
);

trading = replaceOne(
  trading,
  /function tokenImageCandidates\(value\)\{[\s\S]*?\n\}\n\nconst tokenAvatarRuntime=/,
  `const tokenAvatarRuntime=`,
  'remove legacy direct/IPFS frontend resolver'
);

trading = replaceOne(
  trading,
  /function renderTokenAvatar\(candidate\)\{[\s\S]*?\n\}\n\nfunction renderSelected/,
  `function renderTokenAvatar(candidate){
  const avatar=$('tokenAvatar');
  if(!avatar)return;

  const mint=String(candidate?.mint||'').trim();
  const fallback=String(
    candidate?.symbol ||
    candidate?.name ||
    '?'
  ).replace(/[^A-Z0-9]/gi,'').slice(0,2).toUpperCase() || '?';

  const sameMint=avatar.dataset.mint===mint;
  const currentImg=sameMint ? avatar.querySelector('img') : null;

  if(!sameMint){
    avatar.dataset.mint=mint;
    avatar.textContent=fallback;
  }

  if(!mint)return;

  const url=canonicalTokenImageUrlV1(mint);

  if(
    currentImg &&
    currentImg.dataset.canonicalMint===mint
  ){
    return;
  }

  const requestKey=mint;
  if(
    sameMint &&
    tokenAvatarRuntime.loadingKey===requestKey
  ){
    return;
  }

  tokenAvatarRuntime.loadingKey=requestKey;
  const generation=++tokenAvatarRuntime.generation;

  const img=new Image();
  img.alt='';
  img.referrerPolicy='no-referrer';
  img.decoding='async';
  img.dataset.canonicalMint=mint;

  img.onload=()=>{
    if(
      avatar.dataset.mint!==mint ||
      generation!==tokenAvatarRuntime.generation
    ){
      return;
    }

    tokenAvatarRuntime.resolvedUrlByMint.set(mint,url);
    tokenAvatarRuntime.loadingKey='';
    avatar.dataset.imageSrc=url;
    avatar.replaceChildren(img);
  };

  img.onerror=()=>{
    if(tokenAvatarRuntime.loadingKey===requestKey){
      tokenAvatarRuntime.loadingKey='';
    }
    // Keep a previously loaded image for the same mint; otherwise fallback text.
    if(!currentImg && avatar.dataset.mint===mint){
      avatar.textContent=fallback;
    }
  };

  img.src=url;
}

function renderSelected`,
  'selected token avatar'
);

trading = replaceOne(
  trading,
  /function positionImageUrl\(position\) \{[\s\S]*?\n\}\n\nfunction positionAvatarMarkup/,
  `function positionImageUrl(position) {
  return canonicalTokenImageUrlV1(position?.mint);
}

function positionAvatarMarkup`,
  'open position image resolver'
);

trading = replaceOne(
  trading,
  /const avatarUrl = String\([\s\S]*?\n\s*\)\.trim\(\);/,
  `const avatarUrl = canonicalTokenImageUrlV1(mint);`,
  'recent trades image resolver'
);

/* ------------------------------------------------------------------
   LIVE TOKEN STATES: same canonical endpoint; remove V25 metadata-image
   resolution from browser.
------------------------------------------------------------------- */

const tokensHelper = `function canonicalTokenImageUrlV1(mint) {
  const value = String(mint || '').trim();
  return value
    ? '/api/token-image/' + encodeURIComponent(value)
    : '';
}
// ${MARK}

`;

tokens = replaceOne(
  tokens,
  /function imageUrl\(row\) \{[\s\S]*?\n\}\n\nfunction avatarFallback/,
  `${tokensHelper}function imageUrl(row) {
  return canonicalTokenImageUrlV1(row?.mint);
}

function avatarFallback`,
  'Live Token States imageUrl'
);

tokens = replaceOne(
  tokens,
  /async function resolveTokenMetaV25\(row\) \{[\s\S]*?\n\}\n\nfunction applyTokenMediaV25/,
  `async function resolveTokenMetaV25(row) {
  const mint = String(row?.mint || '').trim();
  if (!mint) return null;

  return {
    mint,
    name:
      row?.name ||
      row?.metadataName ||
      row?.symbol ||
      '',
    symbol:
      row?.symbol ||
      row?.metadataSymbol ||
      '',
    image: canonicalTokenImageUrlV1(mint)
  };
}

function applyTokenMediaV25`,
  'remove V25 frontend metadata image source'
);

// V16 may still enrich names, but its image application is forced to the same source.
tokens = tokens.replace(
  "  const image=\n    String(meta.image||'').trim();",
  "  const image=canonicalTokenImageUrlV1(mint);"
);

/* ------------------------------------------------------------------
   MAIN DASHBOARD: replace DexScreener image lookups with the same endpoint.
------------------------------------------------------------------- */

// Primary token logo local source becomes canonical. Existing preloading behavior remains.
index = replaceOne(
  index,
  /const localUrl=first\(\n\s*c\.imageUrl,[\s\S]*?\n\s*\);/,
  `const localUrl=mint
      ? '/api/token-image/' + encodeURIComponent(mint)
      : ''; // ${MARK}`,
  'primary dashboard logo source'
);

// Candidate-card logo loader: no DexScreener, one immutable same-origin URL.
{
  const startNeedle = 'async function getImage(mint){';
  const endNeedle = '/* MEMEFLOW_CANDIDATE_CARD_LOGOS_SAFE_V2 */';
  const start = index.indexOf(startNeedle);
  const end = index.indexOf(endNeedle, start >= 0 ? start : 0);

  if (start < 0 || end < 0 || end <= start) {
    fail('Expected code not found: dashboard candidate-card image source');
  }

  const replacement = `async function getImage(mint){
    const value=String(mint||'').trim();
    if(!value)return '';
    return '/api/token-image/' + encodeURIComponent(value);
  }

  // ${MARK}

`;

  index = index.slice(0, start) + replacement + index.slice(end);
}

// Manual AI result: canonical endpoint whenever a mint exists.
index = replaceOne(
  index,
  /const localUrl = first\(\n\s*t\.imageUrl,[\s\S]*?\n\s*\);/,
  `const localUrl = d?.mint
        ? '/api/token-image/' + encodeURIComponent(String(d.mint).trim())
        : ''; // ${MARK}`,
  'manual scan token logo source'
);

/* ------------------------------------------------------------------
   Write + verify.
------------------------------------------------------------------- */

write(paths.server, server);
write(paths.trading, trading);
write(paths.tokens, tokens);
write(paths.index, index);

const finalServer = read(paths.server);
const finalTrading = read(paths.trading);
const finalTokens = read(paths.tokens);
const finalIndex = read(paths.index);

const checks = [
  [finalServer.includes("url.pathname.startsWith('/api/token-image/')"), 'backend image route'],
  [finalServer.includes("imageSource: 'pump-create-metadata'"), 'Pump metadata source'],
  [finalTrading.includes("canonicalTokenImageUrlV1(candidate?.mint)"), 'Trading Candidates'],
  [finalTrading.includes("canonicalTokenImageUrlV1(position?.mint)"), 'Trading positions'],
  [finalTrading.includes("const avatarUrl = canonicalTokenImageUrlV1(mint);"), 'Recent trades'],
  [finalTokens.includes("return canonicalTokenImageUrlV1(row?.mint);"), 'Live Token States'],
  [finalIndex.includes("return '/api/token-image/' + encodeURIComponent(value);"), 'Dashboard cards']
];

for (const [ok, label] of checks) {
  if (!ok) fail('Verification failed: ' + label);
}

try {
  execFileSync('node', ['--check', paths.server], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('node', ['--check', paths.trading], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('node', ['--check', paths.tokens], { cwd: ROOT, stdio: 'inherit' });
} catch {
  fail('JavaScript syntax check failed. Restore from: ' + path.relative(ROOT, backupDir));
}

const rollbackPath = path.join(ROOT, 'rollback-canonical-token-image-v2.mjs');
const rollback = `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app'))
  ? path.join(root,'memeflow-app')
  : root;
const backup=${JSON.stringify(path.relative(ROOT, backupDir))};

for(const name of ['app-server.mjs','trading.js','system-tokens.js','index.html']){
  const src=path.join(root,backup,name);
  const dst=path.join(app,name);
  if(!fs.existsSync(src))throw new Error('Missing backup: '+src);
  fs.copyFileSync(src,dst);
}
console.log('Rolled back ${MARK}');
`;
write(rollbackPath, rollback);

console.log('\n[IMAGE-V2] Verification: PASS');
console.log('[IMAGE-V2] app-server.mjs syntax: PASS');
console.log('[IMAGE-V2] trading.js syntax: PASS');
console.log('[IMAGE-V2] system-tokens.js syntax: PASS');
console.log('[IMAGE-V2] Installed successfully.');
console.log('[IMAGE-V2] Old frontend image-source chains replaced in target UI paths.');
console.log('[IMAGE-V2] Canonical UI source: /api/token-image/<mint>');
console.log('[IMAGE-V2] Upstream source: Pump CreateEvent metadata URI');
console.log('[IMAGE-V2] Rollback: node rollback-canonical-token-image-v2.mjs');
