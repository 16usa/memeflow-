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
  console.error('MEMEFLOW V28: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-ai-duplicate-modal-v28.bak';
fs.copyFileSync(target, backup);

let html = fs.readFileSync(target, 'utf8');

if (!/ai-direct-evaluator-v24\.js/i.test(html)) {
  console.error('MEMEFLOW V28: V24 AI runtime was not found.');
  console.error('V28 is a surgical fix for the V24 native-sheet/legacy-backend stack. No changes made.');
  process.exit(1);
}

/* Replace only V28's own prior tag. No other HTML, runtime or config is touched. */
html = html.replace(
  /\s*<script\b[^>]*src=["']\.\/ai-duplicate-modal-fix-v28\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,
  '\n'
);

const tag = '<script src="./ai-duplicate-modal-fix-v28.js?v=28.0.0" defer></script>';

if (!/<\/body>/i.test(html)) {
  console.error('MEMEFLOW V28: </body> not found.');
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tag}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

fs.copyFileSync(
  path.join(__dirname, 'ai-duplicate-modal-fix-v28.js'),
  path.join(appDir, 'ai-duplicate-modal-fix-v28.js')
);

const installed = fs.readFileSync(target, 'utf8');

const checks = [
  ['V24 AI runtime still present', /ai-direct-evaluator-v24\.js/i.test(installed)],
  ['V26 repair runtime still present', /ai-nav-layout-v26\.js/i.test(installed)],
  ['V28 tag exactly once', (installed.match(/ai-duplicate-modal-fix-v28\.js\?v=28\.0\.0/g) || []).length === 1],
  ['V28 runtime file exists', fs.existsSync(path.join(appDir, 'ai-duplicate-modal-fix-v28.js'))],
];

console.log('');
console.log('=== MEMEFLOW V28 INSTALL CHECK ===');
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

const failed = checks.filter(([, ok]) => !ok);

if (failed.length) {
  fs.copyFileSync(backup, target);
  console.error(`V28 FAILED: ${failed.length} check(s). Backup restored.`);
  process.exit(1);
}

console.log('');
console.log(`V28 INSTALL OK: ${checks.length}/${checks.length}`);
console.log('Native full-screen OpenAI sheet is preserved.');
console.log('All legacy MEMEFLOW OpenAI modal copies are force-hidden while the native sheet is open.');
console.log('Legacy backend DOM is NOT deleted, so Status / Ask AI / AUTO AI / Strategy can still use it.');
console.log('Wallet / nav / evaluator / API logic was not changed.');
