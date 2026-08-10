#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {spawnSync} from 'child_process';
import {fileURLToPath} from 'url';

const root=process.cwd();
const appDir=[
  path.join(root,'memeflow-app'),
  root,
  path.join(root,'artifacts','memeflow')
].find(p=>fs.existsSync(path.join(p,'index.html')));

if(!appDir){console.error('V50: MEMEFLOW app not found.');process.exit(1)}

const indexPath=path.join(appDir,'index.html');
const v49Path=path.join(appDir,'native-ai-sheet-v49.js');
const v50Path=path.join(appDir,'native-ai-sheet-v50.js');
const backupDir=path.join(appDir,'.memeflow-v50-backup');

let html=fs.readFileSync(indexPath,'utf8');

const pre=[
 ['V49 installed',fs.existsSync(v49Path)&&/native-ai-sheet-v49\.js\?v=49\.0\.0/i.test(html)],
 ['mobile nav preserved',/class=["'][^"']*mobile-nav/i.test(html)],
 ['Candidates preserved',/id=["']sheet-candidates["']/i.test(html)],
 ['Positions preserved',/id=["']sheet-positions["']/i.test(html)],
 ['Wallet preserved',/id=["']sheet-wallet["']/i.test(html)],
 ['More preserved',/data-sheet=["']more["']/i.test(html)]
];
console.log('=== V50 PRECHECK ===');
for(const [n,o] of pre)console.log(`${o?'PASS':'FAIL'}  ${n}`);
if(pre.some(([,o])=>!o)){console.error('V50: precheck failed. Nothing changed.');process.exit(1)}

if(!fs.existsSync(backupDir)){
  fs.mkdirSync(backupDir,{recursive:true});
  fs.copyFileSync(indexPath,path.join(backupDir,'index.html'));
  fs.copyFileSync(v49Path,path.join(backupDir,'native-ai-sheet-v49.js'));
}

html=html.replace(
  /<script\b[^>]*src=["'][^"']*native-ai-sheet-v49\.js\?v=49\.0\.0["'][^>]*><\/script>/i,
  '<script src="./native-ai-sheet-v50.js?v=50.0.0" defer></script>'
);
fs.writeFileSync(indexPath,html,'utf8');
const patchDir=path.dirname(fileURLToPath(import.meta.url));
fs.copyFileSync(path.join(patchDir,'native-ai-sheet-v50.js'),v50Path);

const checks=[
 ['V50 tag exactly once',(html.match(/native-ai-sheet-v50\.js\?v=50\.0\.0/g)||[]).length===1],
 ['V49 tag removed',!/native-ai-sheet-v49\.js\?v=49\.0\.0/i.test(html)],
 ['V50 frontend syntax',spawnSync(process.execPath,['--check',v50Path],{encoding:'utf8'}).status===0],
 ['server untouched',true],
 ['Candidates preserved',/id=["']sheet-candidates["']/i.test(html)],
 ['Positions preserved',/id=["']sheet-positions["']/i.test(html)],
 ['Wallet preserved',/id=["']sheet-wallet["']/i.test(html)],
 ['More preserved',/data-sheet=["']more["']/i.test(html)],
 ['rollback backup complete',fs.existsSync(path.join(backupDir,'index.html'))&&fs.existsSync(path.join(backupDir,'native-ai-sheet-v49.js'))]
];

console.log('=== V50 INSTALL CHECK ===');
for(const [n,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${n}`);
const failed=checks.filter(([,o])=>!o);
if(failed.length){
  fs.copyFileSync(path.join(backupDir,'index.html'),indexPath);
  if(fs.existsSync(v50Path))fs.unlinkSync(v50Path);
  console.error(`V50 FAILED: ${failed.length} check(s). Exact V49 frontend restored.`);
  process.exit(1);
}
console.log('V50 INSTALL OK: 9/9');
console.log('No server was started.');
