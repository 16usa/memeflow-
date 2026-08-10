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
  console.error('V35: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-responsive-wallet-v35.bak';
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);

let html = fs.readFileSync(target, 'utf8');

if (!/data-sheet=["']wallet["']/i.test(html)) {
  console.error('V35: existing mobile Wallet menu item was not found. No changes made.');
  process.exit(1);
}

html = html.replace(
  /\s*<script\b[^>]*src=["']\.\/responsive-wallet-restore-v35\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,
  '\n'
);

const tag = '<script src="./responsive-wallet-restore-v35.js?v=35.0.0" defer></script>';
if (!/<\/body>/i.test(html)) {
  console.error('V35: </body> not found. No changes made.');
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tag}\n</body>`);
fs.writeFileSync(target, html, 'utf8');
fs.copyFileSync(path.join(__dirname,'responsive-wallet-restore-v35.js'),path.join(appDir,'responsive-wallet-restore-v35.js'));

const installed = fs.readFileSync(target,'utf8');
const checks = [
  ['existing mobile Wallet preserved', /data-sheet=["']wallet["']/i.test(installed)],
  ['V35 tag exactly once', (installed.match(/responsive-wallet-restore-v35\.js\?v=35\.0\.0/g)||[]).length===1],
  ['V35 runtime exists', fs.existsSync(path.join(appDir,'responsive-wallet-restore-v35.js'))]
];

console.log('=== MEMEFLOW V35 INSTALL CHECK ===');
for (const [label,ok] of checks) console.log(`${ok?'PASS':'FAIL'}  ${label}`);
const failed=checks.filter(([,ok])=>!ok);
if(failed.length){fs.copyFileSync(backup,target);console.error(`V35 FAILED: ${failed.length} check(s). Backup restored.`);process.exit(1)}
console.log(`V35 INSTALL OK: ${checks.length}/${checks.length}`);
console.log('PHONE: one header Wallet; bottom Wallet hidden.');
console.log('TABLET: header Wallet hidden; bottom-menu Wallet restored.');
console.log('DESKTOP: header Wallet hidden; sidebar Wallet used.');
