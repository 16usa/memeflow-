#!/usr/bin/env node
import fs from 'fs';import path from 'path';import {spawnSync} from 'child_process';
const root=process.cwd();const target=[path.join(root,'memeflow-app','index.html'),path.join(root,'index.html'),path.join(root,'artifacts','memeflow','index.html')].find(p=>fs.existsSync(p));if(!target){console.error('V43 VERIFY: index.html not found');process.exit(1)}const appDir=path.dirname(target),html=fs.readFileSync(target,'utf8'),rp=path.join(appDir,'github-wallet-sheet-v43.js'),rt=fs.existsSync(rp)?fs.readFileSync(rp,'utf8'):'';
const checks=[
 ['V43 tag once',(html.match(/github-wallet-sheet-v43\.js\?v=43\.0\.0/g)||[]).length===1],
 ['V42 tag absent',!/github-nav-restore-v42\.js/i.test(html)],
 ['sheet-wallet exists',/id=["']sheet-wallet["']/i.test(html)],
 ['walletModal still exists',/id=["']walletModal["']/i.test(html)],
 ['runtime syntax',fs.existsSync(rp)&&spawnSync(process.execPath,['--check',rp]).status===0],
 ['capture-phase interception installed',/addEventListener\('click',captureHeaderWallet,true\)/.test(rt)],
 ['native bubble click is stopped',/stopImmediatePropagation\(\)/.test(rt)],
 ['header opens Wallet sheet',/openWalletSheet\(\)/.test(rt)&&/getElementById\('sheet-wallet'\)/.test(rt)],
 ['provider modal closed before sheet',/getElementById\('walletModal'\)/.test(rt)&&/modal\.classList\.remove\('open'\)/.test(rt)],
 ['phone Wallet bottom route hidden',/mf-v43-phone \.mobile-nav>\[data-sheet="wallet"\][\s\S]*display:none!important/.test(rt)],
 ['phone AI stays centered',/mf-v43-phone \.mobile-nav>#\$\{AI_ID\}[\s\S]*left:50%!important;[\s\S]*top:50%!important/.test(rt)],
 ['no API/trading changes',!/fetch\(|XMLHttpRequest|\/api\//.test(rt)]
];console.log('=== MEMEFLOW V43 VERIFY ===');for(const [l,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${l}`);const f=checks.filter(([,o])=>!o);if(f.length){console.error(`V43 VERIFY FAILED: ${f.length}`);process.exit(1)}console.log('V43 VERIFY OK: 12/12');
