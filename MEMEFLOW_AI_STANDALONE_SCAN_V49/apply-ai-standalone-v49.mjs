#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {spawnSync} from 'child_process';
import {fileURLToPath} from 'url';

const patchDir=path.dirname(fileURLToPath(import.meta.url));
const root=process.cwd();
const appDir=[
  path.join(root,'memeflow-app'),
  root,
  path.join(root,'artifacts','memeflow')
].find(p=>fs.existsSync(path.join(p,'index.html'))&&fs.existsSync(path.join(p,'app-server.mjs')));

if(!appDir){console.error('V49: MEMEFLOW app not found.');process.exit(1)}

const indexPath=path.join(appDir,'index.html');
const serverPath=path.join(appDir,'app-server.mjs');
const evaluatorPath=path.join(appDir,'src','evaluate.mjs');
const v49Path=path.join(appDir,'native-ai-sheet-v49.js');
const backupDir=path.join(appDir,'.memeflow-v49-backup');
const manifestPath=path.join(backupDir,'manifest.json');

let html=fs.readFileSync(indexPath,'utf8');
let server=fs.readFileSync(serverPath,'utf8');
let evaluatorText='';
try{evaluatorText=fs.readFileSync(evaluatorPath,'utf8')}catch{}

const decisionsRouteRe=/if\s*\(\s*url\.pathname\s*===\s*['"]\/api\/ai\/decisions['"]\s*\)/;

const prechecks=[
 ['native mobile nav',/class=["'][^"']*mobile-nav/i.test(html)],
 ['Candidates sheet',/id=["']sheet-candidates["']/i.test(html)],
 ['Positions sheet',/id=["']sheet-positions["']/i.test(html)],
 ['Wallet sheet',/id=["']sheet-wallet["']/i.test(html)],
 ['More button',/data-sheet=["']more["']/i.test(html)],
 ['OpenAI status route',server.includes('/api/openai/status')],
 ['OpenAI ask route',server.includes('/api/openai/ask')],
 ['canonical evaluator file',fs.existsSync(evaluatorPath)],
 ['canonical evaluator exports evaluate',/\bexport\s+function\s+evaluate\s*\(|\bexport\s*\{[^}]*\bevaluate\b[^}]*\}/s.test(evaluatorText)],
 ['handler anchor',server.includes('async function handler(req,res){')],
 ['AI decisions anchor',decisionsRouteRe.test(server)]
];

console.log('=== V49 PRECHECK ===');
for(const [n,o] of prechecks)console.log(`${o?'PASS':'FAIL'}  ${n}`);
if(prechecks.some(([,o])=>!o)){console.error('V49: prerequisite check failed. Nothing was changed.');process.exit(1)}

if(!fs.existsSync(backupDir)){
 fs.mkdirSync(backupDir,{recursive:true});
 fs.copyFileSync(indexPath,path.join(backupDir,'index.html'));
 fs.copyFileSync(serverPath,path.join(backupDir,'app-server.mjs'));
 const aiFiles=fs.readdirSync(appDir).filter(n=>/^native-ai-sheet-v\d+\.js$/i.test(n));
 for(const name of aiFiles)fs.copyFileSync(path.join(appDir,name),path.join(backupDir,name));
 fs.writeFileSync(manifestPath,JSON.stringify({createdAt:new Date().toISOString(),aiFiles},null,2));
}

const aiRuntimeNames=[
 'native-ai-sheet-v49','native-ai-sheet-v48','native-ai-sheet-v47','native-ai-sheet-v46',
 'native-ai-sheet-v45','native-ai-sheet-v44','native-ai-sheet-v43','native-ai-sheet-v42',
 'native-ai-sheet','ai-direct-evaluator-v24','ai-direct-evaluator-v30',
 'ai-duplicate-modal-fix-v28','ai-modal-click-fix-v29'
];
for(const name of aiRuntimeNames){
 html=html.replace(new RegExp(`\\s*<script\\b[^>]*src=["'][^"']*${name}\\.js(?:\\?[^"']*)?["'][^>]*><\\/script>\\s*`,'ig'),'\n');
}
if(!/<\/body>/i.test(html)){
 console.error('V49: </body> not found. Restoring pre-V49 backup.');
 fs.copyFileSync(path.join(backupDir,'index.html'),indexPath);
 fs.copyFileSync(path.join(backupDir,'app-server.mjs'),serverPath);
 process.exit(1);
}
html=html.replace(/<\/body>/i,'<script src="./native-ai-sheet-v49.js?v=49.0.0" defer></script>\n</body>');
fs.writeFileSync(indexPath,html,'utf8');
fs.copyFileSync(path.join(patchDir,'native-ai-sheet-v49.js'),v49Path);

server=server.replace(/\/\* MEMEFLOW_AI_STANDALONE_V48_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V48_END \*\/\s*/g,'');
server=server.replace(/\/\* MEMEFLOW_AI_STANDALONE_V48_ROUTE_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V48_ROUTE_END \*\/\s*/g,'');
server=server.replace(/\/\* MEMEFLOW_AI_STANDALONE_V49_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V49_END \*\/\s*/g,'');
server=server.replace(/\/\* MEMEFLOW_AI_STANDALONE_V49_ROUTE_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V49_ROUTE_END \*\/\s*/g,'');

const helpers=fs.readFileSync(path.join(patchDir,'server-helpers-v49.txt'),'utf8');
const route=fs.readFileSync(path.join(patchDir,'server-route-v49.txt'),'utf8');

server=server.replace('async function handler(req,res){',helpers+'\nasync function handler(req,res){');

const m=server.match(decisionsRouteRe);
if(!m){
 console.error('V49: /api/ai/decisions route anchor disappeared. Restoring backup.');
 fs.copyFileSync(path.join(backupDir,'index.html'),indexPath);
 fs.copyFileSync(path.join(backupDir,'app-server.mjs'),serverPath);
 if(fs.existsSync(v49Path))fs.unlinkSync(v49Path);
 process.exit(1);
}
server=server.slice(0,m.index)+route+'\n '+server.slice(m.index);
fs.writeFileSync(serverPath,server,'utf8');

const currentHtml=fs.readFileSync(indexPath,'utf8');
const currentServer=fs.readFileSync(serverPath,'utf8');
const helperBlock=(currentServer.match(/\/\* MEMEFLOW_AI_STANDALONE_V49_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V49_END \*\//)||[''])[0];

const checks=[
 ['V49 frontend exactly once',(currentHtml.match(/native-ai-sheet-v49\.js\?v=49\.0\.0/g)||[]).length===1],
 ['older standalone AI tags removed',!/native-ai-sheet-v(?:4[2-8])\.js/i.test(currentHtml)],
 ['standalone scan route exactly once',(currentServer.match(/MEMEFLOW_AI_STANDALONE_V49_ROUTE_BEGIN/g)||[]).length===1],
 ['OpenAI ask preserved',currentServer.includes('/api/openai/ask')],
 ['Candidates preserved',/id=["']sheet-candidates["']/i.test(currentHtml)],
 ['Positions preserved',/id=["']sheet-positions["']/i.test(currentHtml)],
 ['Wallet preserved',/id=["']sheet-wallet["']/i.test(currentHtml)],
 ['More preserved',/data-sheet=["']more["']/i.test(currentHtml)],
 ['frontend syntax',spawnSync(process.execPath,['--check',v49Path],{encoding:'utf8'}).status===0],
 ['server syntax',spawnSync(process.execPath,['--check',serverPath],{encoding:'utf8'}).status===0],
 ['scanner loads canonical evaluator',helperBlock.includes("await import('./src/evaluate.mjs')")],
 ['scan helper does not write Candidate Feed',!/(setDecision|evaluateAll|setToken|addToken)\s*\(/.test(helperBlock)],
 ['rollback backup exists',fs.existsSync(path.join(backupDir,'index.html'))&&fs.existsSync(path.join(backupDir,'app-server.mjs'))]
];

console.log('=== MEMEFLOW V49 INSTALL CHECK ===');
for(const [n,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${n}`);
const failed=checks.filter(([,o])=>!o);
if(failed.length){
 fs.copyFileSync(path.join(backupDir,'index.html'),indexPath);
 fs.copyFileSync(path.join(backupDir,'app-server.mjs'),serverPath);
 if(fs.existsSync(v49Path))fs.unlinkSync(v49Path);
 console.error(`V49 FAILED: ${failed.length} check(s). Exact pre-V49 backup restored.`);
 process.exit(1);
}
console.log('V49 INSTALL OK: 13/13');
console.log('Rollback point: memeflow-app/.memeflow-v49-backup');
console.log('No server was started.');
