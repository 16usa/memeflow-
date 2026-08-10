#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
const root = process.cwd();
const target = [path.join(root,'memeflow-app','index.html'),path.join(root,'index.html'),path.join(root,'artifacts','memeflow','index.html')].find(p=>fs.existsSync(p));
if(!target){console.error('V42 VERIFY: index.html not found.');process.exit(1)}
const appDir=path.dirname(target), html=fs.readFileSync(target,'utf8'), rp=path.join(appDir,'github-nav-restore-v42.js'), rt=fs.existsSync(rp)?fs.readFileSync(rp,'utf8'):'';
const checks=[
 ['bottom Wallet route exists',/data-sheet=["']wallet["']/i.test(html)],
 ['V42 tag once',(html.match(/github-nav-restore-v42\.js\?v=42\.0\.0/g)||[]).length===1],
 ['V42 runtime exists',fs.existsSync(rp)],
 ['V42 runtime syntax',fs.existsSync(rp)&&spawnSync(process.execPath,['--check',rp],{encoding:'utf8'}).status===0],
 ['runtime recreates walletConnectTop',/wallet\.id = 'walletConnectTop'/.test(rt)],
 ['runtime calls MEMEFLOW_WALLET.open fallback',/MEMEFLOW_WALLET[\s\S]*\.open/.test(rt)],
 ['phone nav fixed at 76px',/mf-v42-phone \.mobile-nav[\s\S]*height:76px!important/.test(rt)],
 ['phone AI true center',/mf-v42-phone \.mobile-nav>#\$\{AI_ID\}[\s\S]*left:50%!important;[\s\S]*top:50%!important;[\s\S]*translate\(-50%,-50%\)/.test(rt)],
 ['phone bottom Wallet hidden',/mf-v42-phone \.mobile-nav>\[data-sheet="wallet"\][\s\S]*display:none!important/.test(rt)],
 ['tablet Wallet restored',/mf-v42-tablet \.mobile-nav>\[data-sheet="wallet"\][\s\S]*display:block!important/.test(rt)],
 ['desktop sidebar Wallet restored',/mf-v42-desktop \.sidebar \.nav a\[href="#wallet"\][\s\S]*display:block!important/.test(rt)],
 ['no fetch/API/trading changes',!/fetch\(|XMLHttpRequest|\/api\//.test(rt)]
];
console.log('=== MEMEFLOW V42 VERIFY ===');
for(const [l,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${l}`);
const failed=checks.filter(([,o])=>!o);if(failed.length){console.error(`V42 VERIFY FAILED: ${failed.length}`);process.exit(1)}
console.log('V42 VERIFY OK: 12/12');
