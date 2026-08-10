#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {spawnSync} from 'child_process';

const root=process.cwd();
const appDir=[
  path.join(root,'memeflow-app'),root,path.join(root,'artifacts','memeflow')
].find(p=>fs.existsSync(path.join(p,'index.html'))&&fs.existsSync(path.join(p,'app-server.mjs')));

if(!appDir){console.error('V48 VERIFY: project not found.');process.exit(1)}

const html=fs.readFileSync(path.join(appDir,'index.html'),'utf8');
const server=fs.readFileSync(path.join(appDir,'app-server.mjs'),'utf8');
const front=path.join(appDir,'native-ai-sheet-v48.js');
const backup=path.join(appDir,'.memeflow-v48-backup');
const helper=(server.match(/\/\* MEMEFLOW_AI_STANDALONE_V48_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V48_END \*\//)||[''])[0];
const route=(server.match(/\/\* MEMEFLOW_AI_STANDALONE_V48_ROUTE_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V48_ROUTE_END \*\//)||[''])[0];

const checks=[
 ['V48 frontend file',fs.existsSync(front)],
 ['V48 tag exactly once',(html.match(/native-ai-sheet-v48\.js\?v=48\.0\.0/g)||[]).length===1],
 ['V47 tag absent',!/native-ai-sheet-v47\.js/i.test(html)],
 ['standalone route once',(server.match(/MEMEFLOW_AI_STANDALONE_V48_ROUTE_BEGIN/g)||[]).length===1],
 ['scan uses same evaluate()',/const evaluation=evaluate\(evalToken,u\.settings\)/.test(helper)],
 ['scan does not write store/feed',!/(setDecision|evaluateAll|setToken|addToken)\s*\(/.test(helper+route)],
 ['OpenAI status preserved',server.includes('/api/openai/status')],
 ['OpenAI ask preserved',server.includes('/api/openai/ask')],
 ['Candidates preserved',/id=["']sheet-candidates["']/i.test(html)],
 ['Positions preserved',/id=["']sheet-positions["']/i.test(html)],
 ['Wallet preserved',/id=["']sheet-wallet["']/i.test(html)],
 ['More preserved',/data-sheet=["']more["']/i.test(html)],
 ['frontend syntax',fs.existsSync(front)&&spawnSync(process.execPath,['--check',front]).status===0],
 ['server syntax',spawnSync(process.execPath,['--check',path.join(appDir,'app-server.mjs')]).status===0],
 ['rollback backup complete',fs.existsSync(path.join(backup,'index.html'))&&fs.existsSync(path.join(backup,'app-server.mjs'))],
 ['frontend has independent scan input',fs.existsSync(front)&&/mf48TokenInput/.test(fs.readFileSync(front,'utf8'))],
 ['frontend does not use Candidate Feed for scanning',fs.existsSync(front)&&!/\/api\/ai\/decisions/.test(fs.readFileSync(front,'utf8'))],
 ['frontend does not control MANUAL AI SCAN DOM',fs.existsSync(front)&&!/(querySelector|querySelectorAll|getElementById)\([^\n)]*manual|\/api\/[^'\"`]*manual/i.test(fs.readFileSync(front,'utf8'))]
];

console.log('=== MEMEFLOW V48 VERIFY ===');
for(const [n,o] of checks) console.log(`${o?'PASS':'FAIL'}  ${n}`);
const failed=checks.filter(([,o])=>!o);
if(failed.length){console.error(`V48 VERIFY FAILED: ${failed.length}`);process.exit(1)}
console.log('V48 VERIFY OK: 18/18');
