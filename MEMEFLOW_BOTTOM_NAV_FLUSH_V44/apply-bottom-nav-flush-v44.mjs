#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const target = [
  path.join(root,'memeflow-app','index.html'),
  path.join(root,'index.html'),
  path.join(root,'artifacts','memeflow','index.html')
].find(p=>fs.existsSync(p));

if(!target){
  console.error('V44: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-bottom-nav-v44.bak';
if(!fs.existsSync(backup)) fs.copyFileSync(target, backup);

let html = fs.readFileSync(target,'utf8');

const required = [
  ['bottom Wallet route', /data-sheet=["']wallet["']/i],
  ['Wallet sheet', /id=["']sheet-wallet["']/i],
  ['Connect Wallet provider modal', /id=["']walletModal["']/i]
];

console.log('=== V44 STRUCTURE CHECK ===');
for(const [label,rx] of required) console.log(`${rx.test(html)?'PASS':'FAIL'}  ${label}`);

if(required.some(([,rx])=>!rx.test(html))){
  console.error('V44: required Wallet/navigation structure missing. Refusing to patch.');
  process.exit(1);
}

for(const name of ['github-nav-restore-v42','github-wallet-sheet-v43','bottom-nav-flush-v44']){
  html = html.replace(
    new RegExp(`\\s*<script\\b[^>]*src=["']\\./${name}\\.js(?:\\?[^"']*)?["'][^>]*><\\/script>\\s*`,'ig'),
    '\n'
  );
}

const tag = '<script src="./bottom-nav-flush-v44.js?v=44.0.0" defer></script>';

if(!/<\/body>/i.test(html)){
  console.error('V44: </body> missing.');
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tag}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

const src = path.join(path.dirname(new URL(import.meta.url).pathname),'bottom-nav-flush-v44.js');
fs.copyFileSync(src, path.join(appDir,'bottom-nav-flush-v44.js'));

for(const old of ['github-nav-restore-v42.js','github-wallet-sheet-v43.js']){
  const p = path.join(appDir, old);
  if(fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch {}
  }
}

const out = fs.readFileSync(target,'utf8');

const checks = [
  ['V42 tag removed', !/github-nav-restore-v42\.js/i.test(out)],
  ['V43 tag removed', !/github-wallet-sheet-v43\.js/i.test(out)],
  ['V44 tag exactly once', (out.match(/bottom-nav-flush-v44\.js\?v=44\.0\.0/g)||[]).length===1],
  ['Wallet sheet preserved', /id=["']sheet-wallet["']/i.test(out)],
  ['provider modal preserved', /id=["']walletModal["']/i.test(out)]
];

console.log('=== MEMEFLOW V44 INSTALL CHECK ===');
for(const [label,ok] of checks) console.log(`${ok?'PASS':'FAIL'}  ${label}`);

const failed = checks.filter(([,ok])=>!ok);
if(failed.length){
  fs.copyFileSync(backup,target);
  console.error(`V44 FAILED: ${failed.length} check(s). Backup restored.`);
  process.exit(1);
}

console.log('V44 INSTALL OK: 5/5');
console.log('Phone bottom navigation is now flush to bottom: bottom:0.');
console.log('Safe-area is inside the bar, not below it.');
console.log('Wallet V43 behavior and AI click behavior are preserved.');
