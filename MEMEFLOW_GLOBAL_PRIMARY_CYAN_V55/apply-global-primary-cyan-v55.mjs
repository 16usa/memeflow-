#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const patchDir=path.dirname(fileURLToPath(import.meta.url));
const root=process.cwd();
const appDir=[
  path.join(root,'memeflow-app'),
  root,
  path.join(root,'artifacts','memeflow')
].find(p=>fs.existsSync(path.join(p,'index.html')));

if(!appDir){console.error('V55: MEMEFLOW index.html not found.');process.exit(1)}

const indexPath=path.join(appDir,'index.html');
const backupDir=path.join(appDir,'.memeflow-v55-backup');
const backupIndex=path.join(backupDir,'index.html');
const runtimePath=path.join(appDir,'global-primary-cyan-v55.js');

let html=fs.readFileSync(indexPath,'utf8');

const pre=[
 ['MEMEFLOW detected',/MEMEFLOW/i.test(html)],
 ['body tag',/<\/body>/i.test(html)]
];

console.log('=== V55 PRECHECK ===');
for(const [n,o] of pre)console.log(`${o?'PASS':'FAIL'}  ${n}`);
if(pre.some(([,o])=>!o)){
  console.error('V55: precheck failed. Nothing changed.');
  process.exit(1);
}

if(!fs.existsSync(backupDir)){
  fs.mkdirSync(backupDir,{recursive:true});
  fs.copyFileSync(indexPath,backupIndex);
}

/* Disable V54 cleanly; keep its file so rollback can restore the exact old index. */
html=html.replace(
  /\s*<script\b[^>]*src=["'][^"']*global-primary-cyan-v54\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,
  '\n'
);

/* Idempotent V55. */
html=html.replace(
  /\s*<script\b[^>]*src=["'][^"']*global-primary-cyan-v55\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,
  '\n'
);

html=html.replace(
  /<\/body>/i,
  '<script src="./global-primary-cyan-v55.js?v=55.0.0" defer></script>\n</body>'
);

fs.writeFileSync(indexPath,html,'utf8');
fs.copyFileSync(path.join(patchDir,'global-primary-cyan-v55.js'),runtimePath);

const out=fs.readFileSync(indexPath,'utf8');
const checks=[
 ['V55 tag exactly once',(out.match(/global-primary-cyan-v55\.js\?v=55\.0\.0/g)||[]).length===1],
 ['V54 active tag absent',!/global-primary-cyan-v54\.js(?:\?[^"']*)?["']/i.test(out)],
 ['runtime exists',fs.existsSync(runtimePath)],
 ['rollback backup exists',fs.existsSync(backupIndex)],
 ['other MEMEFLOW content preserved',/MEMEFLOW/i.test(out)]
];

console.log('=== V55 INSTALL CHECK ===');
for(const [n,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${n}`);

if(checks.some(([,o])=>!o)){
  fs.copyFileSync(backupIndex,indexPath);
  try{fs.unlinkSync(runtimePath)}catch{}
  console.error('V55 FAILED. Exact pre-V55 index restored.');
  process.exit(1);
}

console.log('V55 INSTALL OK: 5/5');
console.log('V54 disabled. V55 uses inline !important cyan, so existing button CSS cannot override it.');
console.log('No server files changed. No server was started.');
