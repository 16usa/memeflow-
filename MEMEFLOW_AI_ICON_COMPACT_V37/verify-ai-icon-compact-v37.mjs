#!/usr/bin/env node
import fs from 'fs';import path from 'path';import {spawnSync} from 'child_process';
const root=process.cwd();const target=[path.join(root,'memeflow-app','index.html'),path.join(root,'index.html'),path.join(root,'artifacts','memeflow','index.html')].find(p=>fs.existsSync(p));
if(!target){console.error('V37 VERIFY: index.html not found.');process.exit(1)}
const appDir=path.dirname(target);const html=fs.readFileSync(target,'utf8');const rp=path.join(appDir,'ai-icon-compact-v37.js');const rt=fs.existsSync(rp)?fs.readFileSync(rp,'utf8'):'';
const checks=[
 ['V36 tag absent',!/ai-sparkles-icon-v36\.js/i.test(html)],
 ['V37 tag once',(html.match(/ai-icon-compact-v37\.js\?v=37\.0\.0/g)||[]).length===1],
 ['runtime exists',fs.existsSync(rp)],
 ['runtime syntax',fs.existsSync(rp)&&spawnSync(process.execPath,['--check',rp],{encoding:'utf8'}).status===0],
 ['compact icon width 25px',/width:25px!important/.test(rt)],
 ['old after-star killed',/::after\{[\s\S]*?content:none!important/.test(rt)],
 ['V36 class removed at runtime',/classList\.remove\('mf-ai-sparkles-v36'\)/.test(rt)],
 ['existing AI button not replaced',!/replaceWith\(|outerHTML\s*=/.test(rt)],
 ['no click handler replacement',!/onclick\s*=|addEventListener\(['"]click/.test(rt)],
 ['no API calls',!/fetch\(|XMLHttpRequest|\/api\//.test(rt)]
];
console.log('=== MEMEFLOW V37 VERIFY ===');for(const [l,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${l}`);const f=checks.filter(([,o])=>!o);if(f.length){console.error(`V37 VERIFY FAILED: ${f.length}`);process.exit(1)}console.log('V37 VERIFY OK: 10/10');
