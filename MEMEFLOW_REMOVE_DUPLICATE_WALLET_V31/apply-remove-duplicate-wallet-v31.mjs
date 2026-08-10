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
  console.error('V31: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-remove-duplicate-wallet-v31.bak';
fs.copyFileSync(target, backup);

let html = fs.readFileSync(target, 'utf8');

/* Safety: the native Wallet must exist before V31 installs.
   V31 refuses to remove injected duplicates if the original control is missing. */
if (!/id=["']walletConnectTop["']/i.test(html)) {
  console.error('V31: native #walletConnectTop was not found.');
  console.error('No changes made — refusing to risk removing the only Wallet control.');
  process.exit(1);
}

/* Replace only V31's own previous tag. Nothing else is edited. */
html = html.replace(
  /\s*<script\b[^>]*src=["']\.\/remove-duplicate-wallet-v31\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,
  '\n'
);

const tag = '<script src="./remove-duplicate-wallet-v31.js?v=31.0.0" defer></script>';

if (!/<\/body>/i.test(html)) {
  console.error('V31: </body> not found.');
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tag}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

fs.copyFileSync(
  path.join(__dirname, 'remove-duplicate-wallet-v31.js'),
  path.join(appDir, 'remove-duplicate-wallet-v31.js')
);

const installed = fs.readFileSync(target, 'utf8');

const checks = [
  ['native walletConnectTop preserved', /id=["']walletConnectTop["']/i.test(installed)],
  ['V31 tag exactly once', (installed.match(/remove-duplicate-wallet-v31\.js\?v=31\.0\.0/g) || []).length === 1],
  ['V31 runtime exists', fs.existsSync(path.join(appDir, 'remove-duplicate-wallet-v31.js'))],
];

console.log('');
console.log('=== MEMEFLOW V31 INSTALL CHECK ===');
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

const failed = checks.filter(([, ok]) => !ok);

if (failed.length) {
  fs.copyFileSync(backup, target);
  console.error(`V31 FAILED: ${failed.length} check(s). Backup restored.`);
  process.exit(1);
}

console.log('');
console.log(`V31 INSTALL OK: ${checks.length}/${checks.length}`);
console.log('The circled injected mf-header-wallet-v* control will be removed at runtime.');
console.log('Native #walletConnectTop remains untouched.');
console.log('AI / Wallet connection / API / navigation logic was not modified.');
