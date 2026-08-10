#!/usr/bin/env node
import fs from 'fs';import path from 'path';import {spawnSync} from 'child_process';
const root=process.cwd();
const target=[path.join(root,'memeflow-app','index.html'),path.join(root,'index.html'),path.join(root,'artifacts','memeflow','index.html')].find(p=>fs.existsSync(p));
if(!target){console.error('V39 VERIFY: index.html not found.');process.exit(1)}
const appDir=path.dirname(target); const html=fs.readFileSync(target,'utf8'); const rp=path.join(appDir,'ai-icon-center-v39.js'); const rt=fs.existsSync(rp)?fs.readFileSync(rp,'utf8'):'';
const checks=[
  ['old icon tags absent', !/(ai-sparkles-icon-v36|ai-icon-compact-v37|ai-icon-final-v38)\.js/i.test(html)],
  ['V39 tag once', (html.match(/ai-icon-center-v39\.js\?v=39\.0\.0/g)||[]).length===1],
  ['runtime exists', fs.existsSync(rp)],
  ['runtime syntax', fs.existsSync(rp)&&spawnSync(process.execPath,['--check',rp],{encoding:'utf8'}).status===0],
  ['AI id targeted', /AI_ID = 'mf-ai-center-nav-v24'/.test(rt)],
  ['button uses flex centering', /display:flex!important;[\s\S]*align-items:center!important;[\s\S]*justify-content:center!important;/.test(rt)],
  ['single old star hidden', /#\$\{AI_ID\} \.mf-ai-center-star,[\s\S]*display:none!important/.test(rt)],
  ['icon slightly larger', /width:28px!important/.test(rt)],
  ['icon vertically nudged', /transform:translateY\(-1px\)!important/.test(rt)],
  ['no click\/api changes', !/onclick\s*=|addEventListener\(['"]click|fetch\(|XMLHttpRequest|\/api\//.test(rt)]
];
console.log('=== MEMEFLOW V39 VERIFY ===');
for (const [l,o] of checks) console.log(`${o?'PASS':'FAIL'}  ${l}`);
const failed=checks.filter(([,o])=>!o); if(failed.length){console.error(`V39 VERIFY FAILED: ${failed.length}`);process.exit(1)}
console.log('V39 VERIFY OK: 10/10');
