#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {spawnSync} from 'child_process';

const root = process.cwd();
const target = [
  path.join(root,'memeflow-app','index.html'),
  path.join(root,'index.html'),
  path.join(root,'artifacts','memeflow','index.html')
].find(p => fs.existsSync(p));
if (!target) { console.error('V41 VERIFY: index.html not found.'); process.exit(1); }
const appDir = path.dirname(target);
const html = fs.readFileSync(target,'utf8');
const runtime = path.join(appDir,'header-wallet-restore-v41.js');
const rt = fs.existsSync(runtime) ? fs.readFileSync(runtime,'utf8') : '';

const checks = [
  ['V41 tag once', (html.match(/header-wallet-restore-v41\.js\?v=41\.0\.0/g)||[]).length===1],
  ['runtime exists', fs.existsSync(runtime)],
  ['runtime syntax', fs.existsSync(runtime) && spawnSync(process.execPath,['--check',runtime],{encoding:'utf8'}).status===0],
  ['phone hides bottom wallet', /mf-w41-phone[\s\S]*\[data-sheet="wallet"\][\s\S]*display:none!important/.test(rt)],
  ['phone uses 5 slots', /mf-w41-phone[\s\S]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/.test(rt)],
  ['phone header wallet candidates visible', /mf-w41-phone[\s\S]*#walletConnectTop[\s\S]*visibility:visible!important/.test(rt)],
  ['tablet uses 6 slots', /mf-w41-tablet[\s\S]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important/.test(rt)],
  ['desktop sidebar wallet restored', /mf-w41-desktop[\s\S]*\.sidebar \.nav a\[href="#wallet"\][\s\S]*display:block!important/.test(rt)]
];
console.log('=== MEMEFLOW V41 VERIFY ===');
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
const failed = checks.filter(([,ok]) => !ok);
if (failed.length) {
  console.error(`V41 VERIFY FAILED: ${failed.length}`);
  process.exit(1);
}
console.log('V41 VERIFY OK: 8/8');
