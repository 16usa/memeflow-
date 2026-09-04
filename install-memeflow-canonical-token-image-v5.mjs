#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const APP = fs.existsSync(path.join(ROOT, 'memeflow-app'))
  ? path.join(ROOT, 'memeflow-app')
  : ROOT;

const htmlPath = path.join(APP, 'system-tokens.html');
const jsPath = path.join(APP, 'system-tokens.js');
const tradingPath = path.join(APP, 'trading.js');
const indexPath = path.join(APP, 'index.html');

const MARK = 'MEMEFLOW_CANONICAL_TOKEN_IMAGE_CACHE_BUST_V5';
const NEW_VERSION = 'canonical-image-v5-20260903';

function fail(msg) {
  console.error('\n[IMAGE-V5] ERROR:', msg);
  process.exit(1);
}
function read(p) {
  if (!fs.existsSync(p)) fail('Missing file: ' + p);
  return fs.readFileSync(p, 'utf8');
}
function write(p, s) {
  fs.writeFileSync(p, s, 'utf8');
}

let html = read(htmlPath);
const js = read(jsPath);
const trading = read(tradingPath);
const index = read(indexPath);

console.log('[IMAGE-V5] Auditing canonical image wiring...');

const audit = [
  [
    js.includes("'/api/token-image/' + encodeURIComponent(value)") ||
    js.includes("'/api/token-image/' + encodeURIComponent"),
    'Live Token States -> canonical endpoint'
  ],
  [
    trading.includes("'/api/token-image/' + encodeURIComponent(value)") ||
    trading.includes("canonicalTokenImageUrlV1"),
    'Trading Terminal -> canonical endpoint'
  ],
  [
    index.includes("'/api/token-image/' + encodeURIComponent(value)") ||
    index.includes("'/api/token-image/' + encodeURIComponent"),
    'Main dashboard -> canonical endpoint'
  ]
];

for (const [ok, label] of audit) {
  console.log(`[IMAGE-V5] ${label}: ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) fail('Canonical image audit failed: ' + label);
}

if (html.includes(MARK)) {
  console.log('[IMAGE-V5] Already installed.');
  process.exit(0);
}

const scriptRe = /src="\/system-tokens\.js\?v=[^"]+"/;
const match = html.match(scriptRe);
if (!match) {
  fail('Versioned system-tokens.js script tag not found.');
}

console.log('[IMAGE-V5] Current Live Token States asset:', match[0]);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(ROOT, '.patch-backups', 'canonical-token-image-v5-' + stamp);
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(htmlPath, path.join(backupDir, 'system-tokens.html'));

html = html.replace(
  scriptRe,
  `src="/system-tokens.js?v=${NEW_VERSION}"`
);

html = html.replace(
  `src="/system-tokens.js?v=${NEW_VERSION}"`,
  `src="/system-tokens.js?v=${NEW_VERSION}"\n     data-patch="${MARK}"`
);

write(htmlPath, html);

const finalHtml = read(htmlPath);
if (!finalHtml.includes(`system-tokens.js?v=${NEW_VERSION}`)) {
  fail('Cache-bust verification failed.');
}
if (!finalHtml.includes(MARK)) {
  fail('Patch marker verification failed.');
}

try {
  execFileSync('node', ['--check', jsPath], {
    cwd: ROOT,
    stdio: 'inherit'
  });
} catch {
  fail('system-tokens.js syntax check failed.');
}

const rollbackPath = path.join(ROOT, 'rollback-canonical-token-image-v5.mjs');
const rollback = `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app'))
  ? path.join(root,'memeflow-app')
  : root;
const backup=${JSON.stringify(path.relative(ROOT, backupDir))};

const src=path.join(root,backup,'system-tokens.html');
const dst=path.join(app,'system-tokens.html');

if(!fs.existsSync(src))throw new Error('Missing backup: '+src);
fs.copyFileSync(src,dst);
console.log('Rolled back ${MARK}');
`;
write(rollbackPath, rollback);

console.log('\n[IMAGE-V5] Verification: PASS');
console.log('[IMAGE-V5] system-tokens.js syntax: PASS');
console.log('[IMAGE-V5] Live Token States cache version bumped.');
console.log(`[IMAGE-V5] New asset: /system-tokens.js?v=${NEW_VERSION}`);
console.log('[IMAGE-V5] Installed successfully.');
console.log('[IMAGE-V5] Rollback: node rollback-canonical-token-image-v5.mjs');
