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

if(!appDir){console.error('V53: MEMEFLOW index.html not found.');process.exit(1)}

const indexPath=path.join(appDir,'index.html');
const backupDir=path.join(appDir,'.memeflow-v53-backup');
const backupIndex=path.join(backupDir,'index.html');
const v53Path=path.join(appDir,'manual-scan-placeholder-only-v53.js');
const v52Path=path.join(appDir,'manual-scan-compact-v52.js');

let html=fs.readFileSync(indexPath,'utf8');

const pre=[
 ['MANUAL AI SCAN exists',/MANUAL AI SCAN/i.test(html)],
 ['Analyze any Solana token exists',/Analyze any Solana token/i.test(html)],
 ['Analyze token exists',/Analyze token/i.test(html)],
 ['body tag exists',/<\/body>/i.test(html)]
];

console.log('=== V53 PRECHECK ===');
for(const [n,o] of pre) console.log(`${o?'PASS':'FAIL'}  ${n}`);
if(pre.some(([,o])=>!o)){
  console.error('V53: precheck failed. Nothing changed.');
  process.exit(1);
}

if(!fs.existsSync(backupDir)){
  fs.mkdirSync(backupDir,{recursive:true});
  fs.copyFileSync(indexPath,backupIndex);
}

/* Remove the V52 layout patch if it was installed.
   V53 intentionally does NOT keep the one-line layout. */
html=html.replace(/\s*<script\b[^>]*src=["'][^"']*manual-scan-compact-v52\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,'\n');

/* Idempotent V53 install. */
html=html.replace(/\s*<script\b[^>]*src=["'][^"']*manual-scan-placeholder-only-v53\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,'\n');
html=html.replace(/<\/body>/i,'<script src="./manual-scan-placeholder-only-v53.js?v=53.0.0" defer></script>\n</body>');

fs.writeFileSync(indexPath,html,'utf8');
fs.copyFileSync(path.join(patchDir,'manual-scan-placeholder-only-v53.js'),v53Path);

/* V52 runtime file is no longer referenced. Remove it so a future manual edit cannot accidentally re-enable it. */
try{ if(fs.existsSync(v52Path)) fs.unlinkSync(v52Path); }catch{}

const out=fs.readFileSync(indexPath,'utf8');
const checks=[
 ['V53 tag exactly once',(out.match(/manual-scan-placeholder-only-v53\.js\?v=53\.0\.0/g)||[]).length===1],
 ['V52 tag absent',!/manual-scan-compact-v52\.js/i.test(out)],
 ['MANUAL AI SCAN preserved',/MANUAL AI SCAN/i.test(out)],
 ['Analyze title preserved',/Analyze any Solana token/i.test(out)],
 ['Analyze token preserved',/Analyze token/i.test(out)],
 ['V53 runtime exists',fs.existsSync(v53Path)],
 ['rollback backup exists',fs.existsSync(backupIndex)]
];

console.log('=== V53 INSTALL CHECK ===');
for(const [n,o] of checks) console.log(`${o?'PASS':'FAIL'}  ${n}`);
if(checks.some(([,o])=>!o)){
  fs.copyFileSync(backupIndex,indexPath);
  try{fs.unlinkSync(v53Path)}catch{}
  console.error('V53 FAILED. Exact pre-V53 index restored.');
  process.exit(1);
}

console.log('V53 INSTALL OK: 7/7');
console.log('V52 one-line layout removed if present.');
console.log('Only MANUAL AI SCAN placeholder typography is changed.');
console.log('No server files changed. No server was started.');
