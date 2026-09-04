#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const APP = fs.existsSync(path.join(ROOT, 'memeflow-app'))
  ? path.join(ROOT, 'memeflow-app')
  : ROOT;

const serverPath = path.join(APP, 'app-server.mjs');
const MARK_V3 = 'MEMEFLOW_CANONICAL_TOKEN_IMAGE_V3';
const MARK_V4 = 'MEMEFLOW_CANONICAL_TOKEN_IMAGE_V4';

function fail(msg) {
  console.error('\n[IMAGE-V4] ERROR:', msg);
  process.exit(1);
}
function read(p) {
  if (!fs.existsSync(p)) fail('Missing file: ' + p);
  return fs.readFileSync(p, 'utf8');
}
function write(p, s) {
  fs.writeFileSync(p, s, 'utf8');
}
function findFunction(src, signatureRegex, label) {
  const match = signatureRegex.exec(src);
  if (!match) fail('Function not found: ' + label);

  const start = match.index;
  const braceStart = src.indexOf('{', start);
  if (braceStart < 0) fail('Opening brace not found: ' + label);

  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return { start, end: i + 1 };
    }
  }

  fail('Closing brace not found: ' + label);
}

let server = read(serverPath);

if (server.includes(MARK_V4)) {
  console.log('[IMAGE-V4] Already installed.');
  process.exit(0);
}

if (!server.includes(MARK_V3)) {
  fail('Canonical Image V3 marker not found. V4 requires the installed V3 base.');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(ROOT, '.patch-backups', 'canonical-token-image-v4-' + stamp);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(serverPath, path.join(backupDir, 'app-server.mjs'));

console.log('[IMAGE-V4] Backup:', path.relative(ROOT, backupDir));

/*
  V4 extends ONLY the backend canonical resolver.
  Frontend remains untouched and continues to use exactly:
    /api/token-image/<mint>

  Resolution order:
    1) hot RAM token
    2) permanent token registry
    3) Pump canonical coin endpoint by mint
    4) metadata URI -> metadata.image
    5) IPFS/Arweave gateway fallback server-side
*/

const helperInsertNeedle =
  'const __mfCanonicalTokenImagePendingV1 = new Map();';

if (!server.includes(helperInsertNeedle)) {
  fail('V3 canonical cache block not found.');
}

const v4Helpers = `
const __mfCanonicalTokenImageNegativeV4 = new Map();
const __mfCanonicalTokenImagePumpPendingV4 = new Map();

function __mfCanonicalNegativeHitV4(mint) {
  const until = Number(__mfCanonicalTokenImageNegativeV4.get(mint) || 0);
  if (until > Date.now()) return true;
  if (until) __mfCanonicalTokenImageNegativeV4.delete(mint);
  return false;
}

function __mfCanonicalNegativeSetV4(mint, ttlMs = 30000) {
  __mfCanonicalTokenImageNegativeV4.set(
    mint,
    Date.now() + Math.max(5000, Number(ttlMs) || 30000)
  );
}

function __mfCanonicalTokenFromRegistryV4(mint) {
  try {
    return store.tokenRegistry?.get?.(mint) || null;
  } catch {
    return null;
  }
}

function __mfCanonicalPumpCoinUrlV4(mint) {
  const base = String(
    process.env.PUMPFUN_HISTORY_URL ||
    'https://frontend-api-v3.pump.fun/coins'
  ).trim().replace(/\\/+$/, '');

  return base + '/' + encodeURIComponent(mint);
}

async function __mfCanonicalFetchPumpCoinV4(mint) {
  if (__mfCanonicalTokenImagePumpPendingV4.has(mint)) {
    return __mfCanonicalTokenImagePumpPendingV4.get(mint);
  }

  const task = (async () => {
    try {
      const headers = {
        accept: 'application/json',
        origin: 'https://pump.fun',
        'user-agent': 'MEMEFLOW/1.0 canonical-token-image'
      };

      const jwt = String(process.env.PUMPFUN_HISTORY_JWT || '').trim();
      if (jwt) headers.authorization = 'Bearer ' + jwt;

      const response = await __mfCanonicalFetchV1(
        __mfCanonicalPumpCoinUrlV4(mint),
        3500
      );

      if (!response.ok) return null;

      const body = await response.json().catch(() => null);
      if (!body || typeof body !== 'object') return null;

      const coin =
        body?.coin ||
        body?.data?.coin ||
        body?.data ||
        body;

      if (!coin || typeof coin !== 'object') return null;

      const coinMint = String(coin.mint || coin.address || '').trim();
      if (coinMint && coinMint !== mint) return null;

      const patch = {
        mint,
        name: coin.name || undefined,
        symbol: coin.symbol || undefined,
        uri:
          coin.metadata_uri ||
          coin.metadataUri ||
          coin.uri ||
          undefined,
        imageUri:
          coin.image_uri ||
          coin.imageUri ||
          undefined,
        creator: coin.creator || undefined,
        launchPlatform: 'pump',
        protocol: 'pump',
        pumpReferenceAt: Date.now()
      };

      for (const key of Object.keys(patch)) {
        if (patch[key] === undefined || patch[key] === null || patch[key] === '') {
          delete patch[key];
        }
      }

      try {
        if (store.state.tokens?.[mint]) {
          store.setToken(mint, patch);
        }
      } catch {}

      try {
        store.tokenRegistry?.queueUpsert?.(
          {
            ...(__mfCanonicalTokenFromRegistryV4(mint) || {}),
            ...patch
          },
          { historical: true }
        );
      } catch {}

      return patch;
    } catch {
      return null;
    }
  })();

  __mfCanonicalTokenImagePumpPendingV4.set(mint, task);

  try {
    return await task;
  } finally {
    __mfCanonicalTokenImagePumpPendingV4.delete(mint);
  }
}

// ${MARK_V4}
`;

server = server.replace(
  helperInsertNeedle,
  helperInsertNeedle + '\n' + v4Helpers
);

const fn = findFunction(
  server,
  /async\s+function\s+__mfCanonicalResolveMetaImageV1\s*\(\s*mint\s*\)\s*\{/g,
  '__mfCanonicalResolveMetaImageV1'
);

const replacement = `async function __mfCanonicalResolveMetaImageV1(mint) {
  mint = String(mint || '').trim();
  if (!mint) return null;

  const cached = __mfCanonicalTokenImageMetaV1.get(mint);
  if (cached) return cached;

  if (__mfCanonicalNegativeHitV4(mint)) return null;

  async function resolveFromToken(token) {
    if (!token || typeof token !== 'object') return null;

    // Pump history/backfill can already contain the canonical image URI.
    const directImageRaw = String(
      token.imageUri ||
      token.image_uri ||
      ''
    ).trim();

    if (directImageRaw) {
      const imageCandidates =
        __mfCanonicalMediaCandidatesV1(directImageRaw);

      if (imageCandidates.length) {
        return {
          mint,
          metadataUrl: String(token.uri || token.metadataUrl || '').trim() || null,
          imageRaw: directImageRaw,
          imageCandidates
        };
      }
    }

    const metadataUri = String(
      token.uri ||
      token.metadataUrl ||
      token.metadataUri ||
      ''
    ).trim();

    if (!metadataUri) return null;

    const metadataCandidates =
      __mfCanonicalMediaCandidatesV1(metadataUri);

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

        const imageCandidates =
          __mfCanonicalMediaCandidatesV1(imageRaw);

        if (!imageCandidates.length) continue;

        return {
          mint,
          metadataUrl,
          imageRaw,
          imageCandidates
        };
      } catch {}
    }

    return null;
  }

  // 1. Hot RAM token.
  let token = store.state.tokens?.[mint] || null;
  let resolved = await resolveFromToken(token);

  // 2. Permanent registry. This repairs cases where a candidate exists in
  // another runtime view but its Pump URI was not restored into hot RAM.
  if (!resolved) {
    const registryToken = __mfCanonicalTokenFromRegistryV4(mint);
    if (registryToken) {
      resolved = await resolveFromToken(registryToken);

      if (resolved && token) {
        try {
          store.setToken(mint, {
            uri:
              registryToken.uri ||
              registryToken.metadataUrl ||
              token.uri ||
              undefined,
            imageUri:
              registryToken.imageUri ||
              registryToken.image_uri ||
              token.imageUri ||
              undefined
          });
        } catch {}
      }
    }
  }

  // 3. Canonical Pump coin lookup by mint.
  // This is NOT another frontend image source. It only repairs missing
  // Pump identity metadata behind the one /api/token-image/<mint> endpoint.
  if (!resolved) {
    const pumpToken = await __mfCanonicalFetchPumpCoinV4(mint);
    if (pumpToken) {
      resolved = await resolveFromToken(pumpToken);
    }
  }

  if (!resolved) {
    __mfCanonicalNegativeSetV4(mint, 30000);
    return null;
  }

  __mfCanonicalTokenImageNegativeV4.delete(mint);
  __mfCanonicalTokenImageMetaV1.set(mint, resolved);

  try {
    store.setToken(mint, {
      canonicalImageUrl:
        '/api/token-image/' + encodeURIComponent(mint),
      imageSource: 'pump-canonical-metadata'
    });
  } catch {}

  return resolved;
}`;

server = server.slice(0, fn.start) + replacement + server.slice(fn.end);

write(serverPath, server);

const finalServer = read(serverPath);

const checks = [
  [finalServer.includes(MARK_V4), 'V4 marker'],
  [finalServer.includes('__mfCanonicalTokenFromRegistryV4'), 'registry fallback'],
  [finalServer.includes('__mfCanonicalFetchPumpCoinV4'), 'Pump coin fallback'],
  [finalServer.includes("coin.image_uri"), 'Pump image_uri support'],
  [finalServer.includes('__mfCanonicalNegativeSetV4'), 'negative cache'],
  [finalServer.includes("imageSource: 'pump-canonical-metadata'"), 'canonical source label']
];

for (const [ok, label] of checks) {
  if (!ok) fail('Verification failed: ' + label);
}

try {
  execFileSync('node', ['--check', serverPath], {
    cwd: ROOT,
    stdio: 'inherit'
  });
} catch {
  fail(
    'app-server.mjs syntax check failed. Restore from: ' +
    path.relative(ROOT, backupDir)
  );
}

const rollbackPath =
  path.join(ROOT, 'rollback-canonical-token-image-v4.mjs');

const rollback = `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app'))
  ? path.join(root,'memeflow-app')
  : root;
const backup=${JSON.stringify(path.relative(ROOT, backupDir))};

const src=path.join(root,backup,'app-server.mjs');
const dst=path.join(app,'app-server.mjs');

if(!fs.existsSync(src)){
  throw new Error('Missing backup: '+src);
}

fs.copyFileSync(src,dst);
console.log('Rolled back ${MARK_V4}');
`;

write(rollbackPath, rollback);

console.log('\n[IMAGE-V4] Verification: PASS');
console.log('[IMAGE-V4] app-server.mjs syntax: PASS');
console.log('[IMAGE-V4] Installed successfully.');
console.log('[IMAGE-V4] Frontend source remains: /api/token-image/<mint>');
console.log('[IMAGE-V4] Backend fallback: RAM -> registry -> Pump coin -> metadata.image');
console.log('[IMAGE-V4] Negative cache: 30s');
console.log('[IMAGE-V4] Rollback: node rollback-canonical-token-image-v4.mjs');
