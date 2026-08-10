#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const root=process.cwd();
const target=[path.join(root,'memeflow-app','index.html'),path.join(root,'index.html'),path.join(root,'artifacts','memeflow','index.html')].find(p=>fs.existsSync(p));
if(!target){console.error('V35 VERIFY: index.html not found.');process.exit(1)}
const appDir=path.dirname(target);
const html=fs.readFileSync(target,'utf8');
const runtimePath=path.join(appDir,'responsive-wallet-restore-v35.js');
const runtime=fs.existsSync(runtimePath)?fs.readFileSync(runtimePath,'utf8'):'';
const syntax=fs.existsSync(runtimePath)&&spawnSync(process.execPath,['--check',runtimePath],{encoding:'utf8'}).status===0;
const checks=[
 ['mobile Wallet exists',/data-sheet=["']wallet["']/i.test(html)],
 ['V35 tag exactly once',(html.match(/responsive-wallet-restore-v35\.js\?v=35\.0\.0/g)||[]).length===1],
 ['runtime exists',fs.existsSync(runtimePath)],
 ['runtime syntax OK',syntax],
 ['phone <=820',/width <= 820/.test(runtime)],
 ['tablet <=1024',/width <= 1024/.test(runtime)],
 ['touch tablet <=1366',/width <= 1366 && coarse/.test(runtime)],
 ['phone bottom Wallet hidden',/mf-w35-phone \.mobile-nav>\[data-sheet="wallet"\]/.test(runtime)],
 ['tablet bottom Wallet visible',/mf-w35-tablet \.mobile-nav>\[data-sheet="wallet"\]/.test(runtime)],
 ['desktop sidebar Wallet used',/sidebar \.nav a\[href="#wallet"\]/.test(runtime)],
 ['no API/trading calls',!/fetch\(|XMLHttpRequest|\/api\//.test(runtime)]
];
console.log('=== MEMEFLOW V35 VERIFY ===');
for(const [label,ok] of checks)console.log(`${ok?'PASS':'FAIL'}  ${label}`);
const failed=checks.filter(([,ok])=>!ok);
if(failed.length){console.error(`V35 VERIFY FAILED: ${failed.length} check(s).`);process.exit(1)}
console.log(`V35 VERIFY OK: ${checks.length}/${checks.length}`);
