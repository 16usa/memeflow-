#!/usr/bin/env node
import fs from 'fs';import path from 'path';import {spawnSync} from 'child_process';
const root=process.cwd();
const appDir=[path.join(root,'memeflow-app'),root,path.join(root,'artifacts','memeflow')].find(p=>fs.existsSync(path.join(p,'index.html'))&&fs.existsSync(path.join(p,'app-server.mjs')));
if(!appDir){console.error('V46 VERIFY: project not found.');process.exit(1)}
const html=fs.readFileSync(path.join(appDir,'index.html'),'utf8');
const server=fs.readFileSync(path.join(appDir,'app-server.mjs'),'utf8');
const front=path.join(appDir,'native-ai-sheet-v46.js');
const pkg=JSON.parse(fs.readFileSync(path.join(appDir,'package.json'),'utf8'));
const checks=[
 ['V46 frontend tag once',(html.match(/native-ai-sheet-v46\.js\?v=46\.0\.0/g)||[]).length===1],
 ['legacy V30 runtime tag absent',!/ai-direct-evaluator-v30\.js/i.test(html)],
 ['native Candidates sheet preserved',/id=["']sheet-candidates["']/i.test(html)],
 ['native Positions sheet preserved',/id=["']sheet-positions["']/i.test(html)],
 ['native Wallet sheet preserved',/id=["']sheet-wallet["']/i.test(html)],
 ['More button preserved',/data-sheet=["']more["']/i.test(html)],
 ['server helper installed',/MEMEFLOW_NATIVE_AI_V46_BEGIN/.test(server)],
 ['server routes installed',/MEMEFLOW_NATIVE_AI_V46_ROUTES_BEGIN/.test(server)],
 ['server syntax',spawnSync(process.execPath,['--check',path.join(appDir,'app-server.mjs')]).status===0],
 ['frontend syntax',fs.existsSync(front)&&spawnSync(process.execPath,['--check',front]).status===0],
 ['no V45 bootstrap file',!fs.existsSync(path.join(appDir,'native-ai-bootstrap.mjs'))],
 ['console launch works without import',pkg?.scripts?.start==='node app-server.mjs']
];
console.log('=== MEMEFLOW V46 VERIFY ===');
for(const [l,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${l}`);
const f=checks.filter(([,o])=>!o);
if(f.length){console.error(`V46 VERIFY FAILED: ${f.length}`);process.exit(1)}
console.log('V46 VERIFY OK: 12/12');
