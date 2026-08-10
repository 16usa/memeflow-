#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {spawnSync} from 'child_process';

const root=process.cwd();
const target=[
  path.join(root,'memeflow-app','index.html'),
  path.join(root,'index.html'),
  path.join(root,'artifacts','memeflow','index.html')
].find(p=>fs.existsSync(p));

if(!target){
  console.error('V44 VERIFY: index.html not found');
  process.exit(1);
}

const appDir=path.dirname(target);
const html=fs.readFileSync(target,'utf8');
const rp=path.join(appDir,'bottom-nav-flush-v44.js');
const rt=fs.existsSync(rp)?fs.readFileSync(rp,'utf8'):'';

const checks=[
  ['V44 tag once',(html.match(/bottom-nav-flush-v44\.js\?v=44\.0\.0/g)||[]).length===1],
  ['V43 tag absent',!/github-wallet-sheet-v43\.js/i.test(html)],
  ['runtime exists',fs.existsSync(rp)],
  ['runtime syntax',fs.existsSync(rp)&&spawnSync(process.execPath,['--check',rp]).status===0],
  ['phone nav bottom is zero',/body\.mf-v44-phone \.mobile-nav\{[\s\S]*?bottom:0!important/.test(rt)],
  ['phone nav spans full width',/left:0!important;[\s\S]*?right:0!important;[\s\S]*?width:100%!important/.test(rt)],
  ['safe-area absorbed into bar height',/height:calc\(76px \+ env\(safe-area-inset-bottom,0px\)\)!important/.test(rt)],
  ['safe-area absorbed into bottom padding',/padding:5px 5px calc\(5px \+ env\(safe-area-inset-bottom,0px\)\)!important/.test(rt)],
  ['AI centered in 76px content band',/left:50%!important;top:38px!important;transform:translate\(-50%,-50%\)!important/.test(rt)],
  ['phone bottom Wallet still hidden',/body\.mf-v44-phone \.mobile-nav>\[data-sheet="wallet"\][\s\S]*?display:none!important/.test(rt)],
  ['Wallet sheet routing retained',/function openWalletSheet\(\)/.test(rt)&&/getElementById\('sheet-wallet'\)/.test(rt)],
  ['header Wallet capture retained',/addEventListener\('click',captureHeaderWallet,true\)/.test(rt)],
  ['provider modal remains available',/getElementById\('walletModal'\)/.test(rt)],
  ['no API/trading calls added',!/fetch\(|XMLHttpRequest|\/api\//.test(rt)]
];

console.log('=== MEMEFLOW V44 VERIFY ===');
for(const [label,ok] of checks) console.log(`${ok?'PASS':'FAIL'}  ${label}`);

const failed=checks.filter(([,ok])=>!ok);
if(failed.length){
  console.error(`V44 VERIFY FAILED: ${failed.length}`);
  process.exit(1);
}
console.log('V44 VERIFY OK: 14/14');
