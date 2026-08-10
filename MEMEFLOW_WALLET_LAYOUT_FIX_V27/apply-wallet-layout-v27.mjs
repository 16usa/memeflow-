#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();

const candidates = [
  path.join(root, 'memeflow-app', 'index.html'),
  path.join(root, 'index.html'),
  path.join(root, 'artifacts', 'memeflow', 'index.html')
];

const target = candidates.find(p => fs.existsSync(p));

if (!target) {
  console.error('MEMEFLOW V27: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-wallet-layout-v27.bak';
fs.copyFileSync(target, backup);

let html = fs.readFileSync(target, 'utf8');

if (!/ai-nav-layout-v26\.js/i.test(html)) {
  console.error('MEMEFLOW V27: V26 layout runtime was not found.');
  console.error('V27 is intentionally a small fix on top of V26. No changes made.');
  process.exit(1);
}

/* Replace only previous V27 tag; touch nothing else. */
html = html.replace(
  /\s*<script\b[^>]*src=["']\.\/wallet-layout-fix-v27\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,
  '\n'
);

const tag = '<script src="./wallet-layout-fix-v27.js?v=27.0.0" defer></script>';

if (!/<\/body>/i.test(html)) {
  console.error('MEMEFLOW V27: </body> not found.');
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tag}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

fs.copyFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname), 'wallet-layout-fix-v27.js'),
  path.join(appDir, 'wallet-layout-fix-v27.js')
);

const installed = fs.readFileSync(target, 'utf8');

const checks = [
  ['V26 still installed', /ai-nav-layout-v26\.js/i.test(installed)],
  ['one V27 runtime tag', (installed.match(/wallet-layout-fix-v27\.js\?v=27\.0\.0/g) || []).length === 1],
  ['original Wallet nav node still exists', /data-sheet=["']wallet["']/i.test(installed)],
  ['original top Wallet control still exists', /id=["']walletConnectTop["']/i.test(installed)],
  ['V27 runtime file exists', fs.existsSync(path.join(appDir, 'wallet-layout-fix-v27.js'))],
];

console.log('');
console.log('=== MEMEFLOW V27 INSTALL CHECK ===');
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

const failed = checks.filter(([, ok]) => !ok);

if (failed.length) {
  fs.copyFileSync(backup, target);
  console.error(`V27 FAILED: ${failed.length} check(s). Backup restored.`);
  process.exit(1);
}

console.log('');
console.log(`V27 INSTALL OK: ${checks.length}/${checks.length}`);
console.log('PHONE: exactly one native header Wallet; Wallet hidden from bottom nav.');
console.log('TABLET: Wallet restored to bottom nav; AI + Wallet coexist in six slots.');
console.log('DESKTOP: original sidebar Wallet remains; injected header Wallet hidden/removed.');
console.log('AI evaluator/API logic was not changed.');
