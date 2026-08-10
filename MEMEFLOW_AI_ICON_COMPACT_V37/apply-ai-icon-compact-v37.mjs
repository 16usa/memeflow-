#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const root=process.cwd();
const target=[
  path.join(root,'memeflow-app','index.html'),
  path.join(root,'index.html'),
  path.join(root,'artifacts','memeflow','index.html')
].find(p=>fs.existsSync(p));

if(!target){console.error('V37: index.html not found.');process.exit(1)}
const appDir=path.dirname(target);
const backup=target+'.pre-ai-icon-v37.bak';
if(!fs.existsSync(backup))fs.copyFileSync(target,backup);
let html=fs.readFileSync(target,'utf8');
if(!/class=["'][^"']*mobile-nav/i.test(html)){console.error('V37: .mobile-nav not found.');process.exit(1)}

/* Remove V36 and previous V37 tags. V37 replaces V36 visually. */
html=html.replace(/\s*<script\b[^>]*src=["']\.\/(?:ai-sparkles-icon-v36|ai-icon-compact-v37)\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,'\n');
const tag='<script src="./ai-icon-compact-v37.js?v=37.0.0" defer></script>';
if(!/<\/body>/i.test(html)){console.error('V37: </body> not found.');process.exit(1)}
html=html.replace(/<\/body>/i,`${tag}\n</body>`);
fs.writeFileSync(target,html,'utf8');
fs.copyFileSync(path.join(__dirname,'ai-icon-compact-v37.js'),path.join(appDir,'ai-icon-compact-v37.js'));

/* Old V36 runtime can be removed after its tag is gone. */
const old=path.join(appDir,'ai-sparkles-icon-v36.js');
if(fs.existsSync(old))try{fs.unlinkSync(old)}catch{}

const out=fs.readFileSync(target,'utf8');
const checks=[
 ['mobile nav preserved',/class=["'][^"']*mobile-nav/i.test(out)],
 ['V36 tag removed',!/ai-sparkles-icon-v36\.js/i.test(out)],
 ['V37 tag exactly once',(out.match(/ai-icon-compact-v37\.js\?v=37\.0\.0/g)||[]).length===1],
 ['V37 runtime exists',fs.existsSync(path.join(appDir,'ai-icon-compact-v37.js'))]
];
console.log('=== MEMEFLOW V37 INSTALL CHECK ===');
for(const [l,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${l}`);
const failed=checks.filter(([,o])=>!o);
if(failed.length){fs.copyFileSync(backup,target);console.error(`V37 FAILED: ${failed.length} check(s). Backup restored.`);process.exit(1)}
console.log('V37 INSTALL OK: 4/4');
console.log('V36 oversized icon removed.');
console.log('Compact 3-sparkle icon installed; stray lower star explicitly disabled.');
console.log('AI click behavior untouched.');
