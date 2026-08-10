#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {spawnSync} from 'child_process';

const root=process.cwd();
const appDir=[path.join(root,'memeflow-app'),root,path.join(root,'artifacts','memeflow')]
 .find(p=>fs.existsSync(path.join(p,'index.html'))&&fs.existsSync(path.join(p,'app-server.mjs')));
if(!appDir){console.error('V49 VERIFY: project not found.');process.exit(1)}

const html=fs.readFileSync(path.join(appDir,'index.html'),'utf8');
const server=fs.readFileSync(path.join(appDir,'app-server.mjs'),'utf8');
const front=path.join(appDir,'native-ai-sheet-v49.js');
const evaluator=path.join(appDir,'src','evaluate.mjs');
const backup=path.join(appDir,'.memeflow-v49-backup');
const helper=(server.match(/\/\* MEMEFLOW_AI_STANDALONE_V49_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V49_END \*\//)||[''])[0];
const route=(server.match(/\/\* MEMEFLOW_AI_STANDALONE_V49_ROUTE_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V49_ROUTE_END \*\//)||[''])[0];
const frontendText=fs.existsSync(front)?fs.readFileSync(front,'utf8'):'';
const evaluatorText=fs.existsSync(evaluator)?fs.readFileSync(evaluator,'utf8'):'';

const checks=[
 ['V49 frontend file',fs.existsSync(front)],
 ['V49 tag exactly once',(html.match(/native-ai-sheet-v49\.js\?v=49\.0\.0/g)||[]).length===1],
 ['V48/V47 tags absent',!/native-ai-sheet-v(?:47|48)\.js/i.test(html)],
 ['standalone route once',(server.match(/MEMEFLOW_AI_STANDALONE_V49_ROUTE_BEGIN/g)||[]).length===1],
 ['canonical evaluator exists',fs.existsSync(evaluator)],
 ['canonical evaluator exports evaluate',/\bexport\s+function\s+evaluate\s*\(|\bexport\s*\{[^}]*\bevaluate\b[^}]*\}/s.test(evaluatorText)],
 ['scanner dynamically loads same evaluator',helper.includes("await import('./src/evaluate.mjs')")],
 ['scanner calls imported evaluate',/mf49Evaluate\(evalToken,u\.settings\)/.test(helper)],
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
 ['frontend has independent scan input',/mf49TokenInput/.test(frontendText)],
 ['frontend does not use Candidate Feed for scanning',!/\/api\/ai\/decisions/.test(frontendText)],
 ['frontend does not query/control MANUAL AI SCAN DOM',!/(querySelector|querySelectorAll|getElementById)\([^\n)]*manual|\/api\/[^'"`]*manual/i.test(frontendText)]
];

console.log('=== MEMEFLOW V49 VERIFY ===');
for(const [n,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${n}`);
const failed=checks.filter(([,o])=>!o);
if(failed.length){console.error(`V49 VERIFY FAILED: ${failed.length}`);process.exit(1)}
console.log('V49 VERIFY OK: 21/21');
