#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = process.cwd();

const target = [
  path.join(root, 'memeflow-app', 'index.html'),
  path.join(root, 'index.html'),
  path.join(root, 'artifacts', 'memeflow', 'index.html')
].find(p => fs.existsSync(p));

if (!target) {
  console.error('MEMEFLOW V30: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-ai-core-v30.bak';
fs.copyFileSync(target, backup);

function fail(msg) {
  try { fs.copyFileSync(backup, target); } catch {}
  console.error(`MEMEFLOW V30: ${msg}`);
  console.error('Backup restored.');
  process.exit(1);
}

let html = fs.readFileSync(target, 'utf8');

if (!/ai-nav-layout-v26\.js/i.test(html)) {
  fail('V26 repair runtime was not found.');
}

if (!/wallet-layout-fix-v27\.js/i.test(html)) {
  console.warn('WARN: V27 wallet layout tag not found; V30 will not modify Wallet layout.');
}

const cfgPath = path.join(appDir, 'ai-direct-evaluator-v24-config.js');
if (!fs.existsSync(cfgPath)) {
  fail('ai-direct-evaluator-v24-config.js was not found. Refusing to guess evaluator/API config.');
}

/* Remove only AI core runtime V24/V30 and the failed duplicate-modal guards V28/V29.
   V26 and V27 are preserved exactly. */
html = html.replace(
  /\s*<script\b[^>]*src=["']\.\/(?:ai-direct-evaluator-v24|ai-direct-evaluator-v30|ai-duplicate-modal-fix-v28|ai-modal-click-fix-v29)\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,
  '\n'
);

/* Insert V30 immediately after the existing V24 config tag so load order stays deterministic. */
const configTag =
  /(<script\b[^>]*src=["']\.\/ai-direct-evaluator-v24-config\.js(?:\?[^"']*)?["'][^>]*><\/script>)/i;

if (!configTag.test(html)) {
  fail('V24 config script tag was not found in index.html.');
}

html = html.replace(
  configTag,
  `$1\n<script src="./ai-direct-evaluator-v30.js?v=30.0.0" defer></script>`
);

fs.writeFileSync(target, html, 'utf8');

fs.copyFileSync(
  path.join(__dirname, 'ai-direct-evaluator-v30.js'),
  path.join(appDir, 'ai-direct-evaluator-v30.js')
);

/* Remove only the failed V28/V29 files. Do not delete V24 config, V26, V27 or app files. */
for (const name of [
  'ai-duplicate-modal-fix-v28.js',
  'ai-modal-click-fix-v29.js'
]) {
  const p = path.join(appDir, name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

const installed = fs.readFileSync(target, 'utf8');

const checks = [
  ['V24 config preserved', /ai-direct-evaluator-v24-config\.js/i.test(installed)],
  ['V30 runtime exactly once', (installed.match(/ai-direct-evaluator-v30\.js\?v=30\.0\.0/g) || []).length === 1],
  ['old V24 runtime tag removed', !/ai-direct-evaluator-v24\.js(?:\?|["'])/i.test(installed)],
  ['V28 tag removed', !/ai-duplicate-modal-fix-v28\.js/i.test(installed)],
  ['V29 tag removed', !/ai-modal-click-fix-v29\.js/i.test(installed)],
  ['V26 preserved', /ai-nav-layout-v26\.js/i.test(installed)],
  ['V30 runtime file exists', fs.existsSync(path.join(appDir, 'ai-direct-evaluator-v30.js'))],
];

console.log('');
console.log('=== MEMEFLOW V30 INSTALL CHECK ===');
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

const failed = checks.filter(([,ok]) => !ok);

if (failed.length) {
  fail(`${failed.length} install check(s) failed.`);
}

console.log('');
console.log(`V30 INSTALL OK: ${checks.length}/${checks.length}`);
console.log('V28/V29 removed.');
console.log('V30 replaces the V24 AI core runtime instead of stacking another modal guard.');
console.log('V24 evaluator config/API endpoint preserved unchanged.');
console.log('V26/V27 layout layers preserved.');
