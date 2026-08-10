#!/usr/bin/env node
import fs from 'fs';import path from 'path';import {spawnSync} from 'child_process';
const root=process.cwd();
const appDir=[path.join(root,'memeflow-app'),root,path.join(root,'artifacts','memeflow')].find(p=>fs.existsSync(path.join(p,'index.html'))&&fs.existsSync(path.join(p,'app-server.mjs')));
if(!appDir){console.error('V47 VERIFY: project not found.');process.exit(1)}
const html=fs.readFileSync(path.join(appDir,'index.html'),'utf8');
const server=fs.readFileSync(path.join(appDir,'app-server.mjs'),'utf8');
const front=path.join(appDir,'native-ai-sheet-v47.js');
const checks=[
 ['V47 frontend exists',fs.existsSync(front)],
 ['V47 tag once',(html.match(/native-ai-sheet-v47\.js\?v=47\.0\.0/g)||[]).length===1],
 ['V46 frontend tag absent',!/native-ai-sheet-v46\.js/i.test(html)],
 ['V30 frontend tag absent',!/ai-direct-evaluator-v30\.js/i.test(html)],
 ['Candidates preserved',/id=["']sheet-candidates["']/i.test(html)],
 ['Positions preserved',/id=["']sheet-positions["']/i.test(html)],
 ['Wallet preserved',/id=["']sheet-wallet["']/i.test(html)],
 ['More preserved',/data-sheet=["']more["']/i.test(html)],
 ['OpenAI status route preserved',server.includes('/api/openai/status')],
 ['OpenAI analyze route preserved',server.includes('/api/openai/analyze')],
 ['OpenAI ask route preserved',server.includes('/api/openai/ask')],
 ['frontend syntax',fs.existsSync(front)&&spawnSync(process.execPath,['--check',front]).status===0],
 ['server syntax',spawnSync(process.execPath,['--check',path.join(appDir,'app-server.mjs')]).status===0]
];
console.log('=== MEMEFLOW V47 VERIFY ===');
for(const [n,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${n}`);
const failed=checks.filter(([,o])=>!o);
if(failed.length){console.error(`V47 VERIFY FAILED: ${failed.length}`);process.exit(1)}
console.log('V47 VERIFY OK: 13/13');
