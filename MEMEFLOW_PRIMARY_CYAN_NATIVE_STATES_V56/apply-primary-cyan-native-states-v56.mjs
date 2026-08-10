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
  console.error('V56: MEMEFLOW index.html not found.');
  process.exit(1);
}

const indexPath = path.join(appDir,'index.html');
const runtimePath = path.join(appDir,'primary-cyan-native-states-v56.js');
const backupDir = path.join(appDir,'.memeflow-v56-backup');
const backupIndex = path.join(backupDir,'index.html');

let html = fs.readFileSync(indexPath,'utf8');

const pre = [
  ['MEMEFLOW detected', /MEMEFLOW/i.test(html)],
  ['body tag exists', /<\/body>/i.test(html)]
];

console.log('=== V56 PRECHECK ===');
for (const [name, ok] of pre) console.log(`${ok?'PASS':'FAIL'}  ${name}`);

if (pre.some(([,ok]) => !ok)) {
  console.error('V56: precheck failed. Nothing changed.');
  process.exit(1);
}

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir,{recursive:true});
  fs.copyFileSync(indexPath, backupIndex);
}

/* Disable old cyan runtimes only. Their files stay on disk so rollback can restore exact pre-V56 index. */
for (const name of ['global-primary-cyan-v54','global-primary-cyan-v55','primary-cyan-native-states-v56']) {
  html = html.replace(
    new RegExp(`\\s*<script\\b[^>]*src=["'][^"']*${name}\\.js(?:\\?[^"']*)?["'][^>]*><\\/script>\\s*`, 'ig'),
    '\n'
  );
}

html = html.replace(
  /<\/body>/i,
  '<script src="./primary-cyan-native-states-v56.js?v=56.0.0" defer></script>\n</body>'
);

fs.writeFileSync(indexPath, html, 'utf8');
fs.copyFileSync(path.join(patchDir,'primary-cyan-native-states-v56.js'), runtimePath);

const out = fs.readFileSync(indexPath,'utf8');
const checks = [
  ['V56 tag exactly once', (out.match(/primary-cyan-native-states-v56\.js\?v=56\.0\.0/g)||[]).length === 1],
  ['V54 active tag absent', !/global-primary-cyan-v54\.js(?:\?[^"']*)?["']/i.test(out)],
  ['V55 active tag absent', !/global-primary-cyan-v55\.js(?:\?[^"']*)?["']/i.test(out)],
  ['runtime exists', fs.existsSync(runtimePath)],
  ['rollback backup exists', fs.existsSync(backupIndex)],
  ['MEMEFLOW content preserved', /MEMEFLOW/i.test(out)]
];

console.log('=== V56 INSTALL CHECK ===');
for (const [name, ok] of checks) console.log(`${ok?'PASS':'FAIL'}  ${name}`);

if (checks.some(([,ok]) => !ok)) {
  fs.copyFileSync(backupIndex,indexPath);
  try { fs.unlinkSync(runtimePath); } catch {}
  console.error('V56 FAILED. Exact pre-V56 index restored.');
  process.exit(1);
}

console.log('V56 INSTALL OK: 6/6');
console.log('V54/V55 disabled.');
console.log('Native MEMEFLOW state behavior preserved; only fill color is remapped to cyan.');
console.log('No server files changed. No server was started.');
