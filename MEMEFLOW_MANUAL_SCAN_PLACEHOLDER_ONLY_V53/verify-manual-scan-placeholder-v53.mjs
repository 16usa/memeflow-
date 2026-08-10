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

if(!appDir){console.error('V53 VERIFY: project not found.');process.exit(1)}

const html=fs.readFileSync(path.join(appDir,'index.html'),'utf8');
const runtime=path.join(appDir,'manual-scan-placeholder-only-v53.js');
const js=fs.existsSync(runtime)?fs.readFileSync(runtime,'utf8'):'';

const checks=[
 ['runtime exists',fs.existsSync(runtime)],
 ['V53 tag once',(html.match(/manual-scan-placeholder-only-v53\.js\?v=53\.0\.0/g)||[]).length===1],
 ['V52 tag absent',!/manual-scan-compact-v52\.js/i.test(html)],
 ['MANUAL module preserved',/MANUAL AI SCAN/i.test(html)],
 ['Analyze token preserved',/Analyze token/i.test(html)],
 ['no API/fetch logic',!js.includes('/api/')&&!js.includes('fetch(')],
 ['no click handler replacement',!js.includes("addEventListener('click'")],
 ['no DOM replacement',!js.includes('.innerHTML=')&&!js.includes('cloneNode')],
 ['does not change layout',!js.includes('grid-template-columns')&&!js.includes('display:grid')],
 ['does not change button',!js.includes('BUTTON_CLASS')&&!js.includes('Analyze token')],
 ['does not rewrite placeholder',!js.includes("setAttribute('placeholder'")],
 ['placeholder is 11px',/::placeholder[\s\S]*font-size:11px!important/.test(js)],
 ['typed text remains 16px',/font-size:16px!important/.test(js)],
 ['runtime syntax',spawnSync(process.execPath,['--check',runtime]).status===0],
 ['rollback backup exists',fs.existsSync(path.join(appDir,'.memeflow-v53-backup','index.html'))]
];

console.log('=== V53 VERIFY ===');
for(const [n,o] of checks) console.log(`${o?'PASS':'FAIL'}  ${n}`);
const failed=checks.filter(([,o])=>!o);
if(failed.length){
  console.error(`V53 VERIFY FAILED: ${failed.length}`);
  process.exit(1);
}
console.log('V53 VERIFY OK: 15/15');
