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
  console.error('MEMEFLOW V29: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-ai-modal-v29.bak';
fs.copyFileSync(target, backup);

let html = fs.readFileSync(target, 'utf8');

if (!/ai-direct-evaluator-v24\.js/i.test(html)) {
  console.error('MEMEFLOW V29: V24 AI runtime was not found. No changes made.');
  process.exit(1);
}

/* IMPORTANT: remove V28 completely. It was the guard that could block/open-hide
   the native page by hiding an unsafe ancestor. */
html = html.replace(
  /\s*<script\b[^>]*src=["']\.\/ai-duplicate-modal-fix-v28\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,
  '\n'
);

html = html.replace(
  /\s*<script\b[^>]*src=["']\.\/ai-modal-click-fix-v29\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,
  '\n'
);

const tag = '<script src="./ai-modal-click-fix-v29.js?v=29.0.0" defer></script>';

if (!/<\/body>/i.test(html)) {
  fs.copyFileSync(backup, target);
  console.error('MEMEFLOW V29: </body> not found. Backup restored.');
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tag}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

fs.copyFileSync(
  path.join(__dirname, 'ai-modal-click-fix-v29.js'),
  path.join(appDir, 'ai-modal-click-fix-v29.js')
);

/* Remove only our broken V28 runtime file. */
const v28 = path.join(appDir, 'ai-duplicate-modal-fix-v28.js');
if (fs.existsSync(v28)) fs.unlinkSync(v28);

const installed = fs.readFileSync(target, 'utf8');

const checks = [
  ['V24 AI runtime preserved', /ai-direct-evaluator-v24\.js/i.test(installed)],
  ['V26 layout preserved', /ai-nav-layout-v26\.js/i.test(installed)],
  ['V27 wallet fix preserved', /wallet-layout-fix-v27\.js/i.test(installed)],
  ['V28 tag removed', !/ai-duplicate-modal-fix-v28\.js/i.test(installed)],
  ['V29 tag exactly once', (installed.match(/ai-modal-click-fix-v29\.js\?v=29\.0\.0/g) || []).length === 1],
  ['V29 runtime file exists', fs.existsSync(path.join(appDir, 'ai-modal-click-fix-v29.js'))],
];

console.log('');
console.log('=== MEMEFLOW V29 INSTALL CHECK ===');
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

const failed = checks.filter(([,ok]) => !ok);

if (failed.length) {
  fs.copyFileSync(backup, target);
  console.error(`V29 FAILED: ${failed.length} check(s). Backup restored.`);
  process.exit(1);
}

console.log('');
console.log(`V29 INSTALL OK: ${checks.length}/${checks.length}`);
console.log('Broken V28 guard removed.');
console.log('AI click/open flow remains owned by V24 and is not intercepted by V29.');
console.log('V29 hides only exact legacy backend roots after the native AI sheet is already open.');
console.log('Wallet / nav / evaluator / API logic unchanged.');
