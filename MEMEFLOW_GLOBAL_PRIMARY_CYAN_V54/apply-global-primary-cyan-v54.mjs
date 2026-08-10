#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const patchDir = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();

const appDir = [
  path.join(root,'memeflow-app'),
  root,
  path.join(root,'artifacts','memeflow')
].find(p => fs.existsSync(path.join(p,'index.html')));

if (!appDir) {
  console.error('V54: MEMEFLOW index.html not found.');
  process.exit(1);
}

const indexPath = path.join(appDir,'index.html');
const runtimePath = path.join(appDir,'global-primary-cyan-v54.js');
const backupDir = path.join(appDir,'.memeflow-v54-backup');
const backupIndex = path.join(backupDir,'index.html');

let html = fs.readFileSync(indexPath,'utf8');

const pre = [
  ['closing body tag', /<\/body>/i.test(html)],
  ['MEMEFLOW page detected', /MEMEFLOW/i.test(html)]
];

console.log('=== V54 PRECHECK ===');
for (const [name, ok] of pre) console.log(`${ok?'PASS':'FAIL'}  ${name}`);

if (pre.some(([,ok]) => !ok)) {
  console.error('V54: precheck failed. Nothing changed.');
  process.exit(1);
}

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir,{recursive:true});
  fs.copyFileSync(indexPath, backupIndex);
}

/* Idempotent: remove only an older V54 tag, never another MEMEFLOW runtime. */
html = html.replace(
  /\s*<script\b[^>]*src=["'][^"']*global-primary-cyan-v54\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,
  '\n'
);

html = html.replace(
  /<\/body>/i,
  '<script src="./global-primary-cyan-v54.js?v=54.0.0" defer></script>\n</body>'
);

fs.writeFileSync(indexPath, html, 'utf8');
fs.copyFileSync(path.join(patchDir,'global-primary-cyan-v54.js'), runtimePath);

const out = fs.readFileSync(indexPath,'utf8');

const checks = [
  ['V54 tag exactly once', (out.match(/global-primary-cyan-v54\.js\?v=54\.0\.0/g)||[]).length === 1],
  ['runtime exists', fs.existsSync(runtimePath)],
  ['rollback backup exists', fs.existsSync(backupIndex)],
  ['MEMEFLOW content preserved', /MEMEFLOW/i.test(out)]
];

console.log('=== V54 INSTALL CHECK ===');
for (const [name, ok] of checks) console.log(`${ok?'PASS':'FAIL'}  ${name}`);

if (checks.some(([,ok]) => !ok)) {
  fs.copyFileSync(backupIndex,indexPath);
  try { fs.unlinkSync(runtimePath); } catch {}
  console.error('V54 FAILED. Exact pre-V54 index restored.');
  process.exit(1);
}

console.log('V54 INSTALL OK: 4/4');
console.log('Exact cyan: #61DFFF');
console.log('Visual-only patch. No server files changed. No server was started.');
