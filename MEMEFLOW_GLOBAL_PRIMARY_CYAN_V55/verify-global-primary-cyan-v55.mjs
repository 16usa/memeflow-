#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {spawnSync} from 'child_process';

const root=process.cwd();
const appDir=[
  path.join(root,'memeflow-app'),
  root,
  path.join(root,'artifacts','memeflow')
].find(p=>fs.existsSync(path.join(p,'index.html')));

if(!appDir){console.error('V55 VERIFY: project not found.');process.exit(1)}

const html=fs.readFileSync(path.join(appDir,'index.html'),'utf8');
const runtime=path.join(appDir,'global-primary-cyan-v55.js');
const js=fs.existsSync(runtime)?fs.readFileSync(runtime,'utf8'):'';

const checks=[
 ['runtime exists',fs.existsSync(runtime)],
 ['V55 tag once',(html.match(/global-primary-cyan-v55\.js\?v=55\.0\.0/g)||[]).length===1],
 ['V54 active tag absent',!/global-primary-cyan-v54\.js(?:\?[^"']*)?["']/i.test(html)],
 ['fallback cyan present',js.includes("#61DFFF")],
 ['reads OpenAI primary color',js.includes('discoverCyan')&&js.includes('memeflow openai')],
 ['inline important background',js.includes("setProperty('background', CYAN, 'important')")],
 ['inline important background-color',js.includes("setProperty('background-color', CYAN, 'important')")],
 ['inline important border',js.includes("setProperty('border-color', CYAN, 'important')")],
 ['disabled excluded',js.includes("el?.disabled === true")],
 ['destructive excluded',/disconnect\|delete\|remove\|danger\|destructive/.test(js)],
 ['navigation excluded',js.includes('.mobile-nav')&&js.includes('[role="navigation"]')],
 ['known primary labels included',js.includes('connect wallet')&&js.includes('analyze token')&&js.includes('save settings')],
 ['visual-only no fetch/API',!js.includes('fetch(')&&!js.includes('/api/')],
 ['no click interception',!js.includes("addEventListener('click'")],
 ['runtime syntax',spawnSync(process.execPath,['--check',runtime]).status===0],
 ['rollback backup exists',fs.existsSync(path.join(appDir,'.memeflow-v55-backup','index.html'))]
];

console.log('=== V55 VERIFY ===');
for(const [n,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${n}`);
const failed=checks.filter(([,o])=>!o);

if(failed.length){
  console.error(`V55 VERIFY FAILED: ${failed.length}`);
  process.exit(1);
}

console.log('V55 VERIFY OK: 16/16');
