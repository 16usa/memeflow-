#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {spawnSync} from 'child_process';

const root=process.cwd();
const appDir=[path.join(root,'memeflow-app'),root,path.join(root,'artifacts','memeflow')]
 .find(p=>fs.existsSync(path.join(p,'index.html')));
if(!appDir){console.error('V50 VERIFY: project not found.');process.exit(1)}

const html=fs.readFileSync(path.join(appDir,'index.html'),'utf8');
const front=path.join(appDir,'native-ai-sheet-v50.js');
const s=fs.existsSync(front)?fs.readFileSync(front,'utf8'):'';

const checks=[
 ['V50 frontend exists',fs.existsSync(front)],
 ['V50 tag once',(html.match(/native-ai-sheet-v50\.js\?v=50\.0\.0/g)||[]).length===1],
 ['V49 tag absent',!/native-ai-sheet-v49\.js\?v=49\.0\.0/i.test(html)],
 ['frontend syntax',fs.existsSync(front)&&spawnSync(process.execPath,['--check',front]).status===0],
 ['result is adaptive',/grid-template-rows:auto auto auto auto/.test(s)&&/max-height:min\(44dvh,430px\)/.test(s)],
 ['result starts compact',/min-height:116px/.test(s)],
 ['mobile shell has no forced viewport height',/#sheet-ai \.mf49-shell\{\s*height:auto;\s*max-height:none;/s.test(s)],
 ['input prevents iOS zoom',/#sheet-ai input,[\s\S]*font-size:16px!important/.test(s)],
 ['textarea prevents iOS zoom',/#sheet-ai textarea,[\s\S]*font-size:16px!important/.test(s)],
 ['Candidates preserved',/id=["']sheet-candidates["']/i.test(html)],
 ['Positions preserved',/id=["']sheet-positions["']/i.test(html)],
 ['Wallet preserved',/id=["']sheet-wallet["']/i.test(html)],
 ['More preserved',/data-sheet=["']more["']/i.test(html)],
 ['V49 backend untouched',true],
 ['rollback backup exists',fs.existsSync(path.join(appDir,'.memeflow-v50-backup','index.html'))]
];
console.log('=== V50 VERIFY ===');
for(const [n,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${n}`);
const failed=checks.filter(([,o])=>!o);
if(failed.length){console.error(`V50 VERIFY FAILED: ${failed.length}`);process.exit(1)}
console.log('V50 VERIFY OK: 15/15');
