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

if(!appDir){console.error('V51: MEMEFLOW app not found.');process.exit(1)}

const indexPath=path.join(appDir,'index.html');
const serverPath=path.join(appDir,'app-server.mjs');
const v51Path=path.join(appDir,'native-ai-sheet-v51.js');
const backupDir=path.join(appDir,'.memeflow-v51-backup');
const manifestPath=path.join(backupDir,'manifest.json');

let html=fs.readFileSync(indexPath,'utf8');
let server=fs.readFileSync(serverPath,'utf8');

const pre=[
 ['mobile nav',/class=["'][^"']*mobile-nav/i.test(html)],
 ['Candidates',/id=["']sheet-candidates["']/i.test(html)],
 ['Positions',/id=["']sheet-positions["']/i.test(html)],
 ['Wallet',/id=["']sheet-wallet["']/i.test(html)],
 ['More',/data-sheet=["']more["']/i.test(html)],
 ['OpenAI status endpoint',server.includes('/api/openai/status')],
 ['OpenAI ask endpoint',server.includes('/api/openai/ask')],
 ['canonical evaluator',fs.existsSync(path.join(appDir,'src','evaluate.mjs'))],
 ['handler anchor',server.includes('async function handler(req,res){')],
 ['decisions route',/if\s*\(\s*url\.pathname\s*===\s*['"]\/api\/ai\/decisions['"]\s*\)/.test(server)]
];

console.log('=== V51 PRECHECK ===');
for(const [n,o] of pre)console.log(`${o?'PASS':'FAIL'}  ${n}`);
if(pre.some(([,o])=>!o)){console.error('V51: precheck failed. Nothing changed.');process.exit(1)}

if(!fs.existsSync(backupDir)){
  fs.mkdirSync(backupDir,{recursive:true});
  fs.copyFileSync(indexPath,path.join(backupDir,'index.html'));
  fs.copyFileSync(serverPath,path.join(backupDir,'app-server.mjs'));

  const aiFiles=fs.readdirSync(appDir).filter(n=>/^native-ai-sheet-v\d+\.js$/i.test(n));
  for(const name of aiFiles)fs.copyFileSync(path.join(appDir,name),path.join(backupDir,name));
  fs.writeFileSync(manifestPath,JSON.stringify({createdAt:new Date().toISOString(),aiFiles},null,2));
}

/* FRONTEND: remove only standalone AI runtime tags, leave the rest of MEMEFLOW untouched. */
for(const name of [
  'native-ai-sheet-v51','native-ai-sheet-v50','native-ai-sheet-v49','native-ai-sheet-v48',
  'native-ai-sheet-v47','native-ai-sheet-v46','native-ai-sheet-v45','native-ai-sheet-v44',
  'native-ai-sheet-v43','native-ai-sheet-v42','native-ai-sheet'
]){
  html=html.replace(new RegExp(`\\s*<script\\b[^>]*src=["'][^"']*${name}\\.js(?:\\?[^"']*)?["'][^>]*><\\/script>\\s*`,'ig'),'\n');
}
if(!/<\/body>/i.test(html)){
  console.error('V51: </body> missing. Restoring backup.');
  fs.copyFileSync(path.join(backupDir,'index.html'),indexPath);
  process.exit(1);
}
html=html.replace(/<\/body>/i,'<script src="./native-ai-sheet-v51.js?v=51.0.0" defer></script>\n</body>');
fs.writeFileSync(indexPath,html,'utf8');
fs.copyFileSync(path.join(patchDir,'native-ai-sheet-v51.js'),v51Path);

/* BACKEND: preserve working V49 backend; repair only when it is absent/partial. */
const hasHelper=/MEMEFLOW_AI_STANDALONE_V49_BEGIN/.test(server);
const hasRoute=/MEMEFLOW_AI_STANDALONE_V49_ROUTE_BEGIN/.test(server)&&server.includes('/api/ai/standalone-scan');
let backendChanged=false;

if(!(hasHelper&&hasRoute)){
  backendChanged=true;

  server=server.replace(/\/\* MEMEFLOW_AI_STANDALONE_V48_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V48_END \*\/\s*/g,'');
  server=server.replace(/\/\* MEMEFLOW_AI_STANDALONE_V48_ROUTE_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V48_ROUTE_END \*\/\s*/g,'');
  server=server.replace(/\/\* MEMEFLOW_AI_STANDALONE_V49_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V49_END \*\/\s*/g,'');
  server=server.replace(/\/\* MEMEFLOW_AI_STANDALONE_V49_ROUTE_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V49_ROUTE_END \*\/\s*/g,'');

  const helpers=fs.readFileSync(path.join(patchDir,'server-helpers-v51.txt'),'utf8');
  const route=fs.readFileSync(path.join(patchDir,'server-route-v51.txt'),'utf8');

  server=server.replace('async function handler(req,res){',helpers+'\nasync function handler(req,res){');

  const decisionRe=/if\s*\(\s*url\.pathname\s*===\s*['"]\/api\/ai\/decisions['"]\s*\)/;
  const m=server.match(decisionRe);
  if(!m){
    console.error('V51: decisions route anchor missing during backend repair. Restoring exact backup.');
    fs.copyFileSync(path.join(backupDir,'index.html'),indexPath);
    fs.copyFileSync(path.join(backupDir,'app-server.mjs'),serverPath);
    if(fs.existsSync(v51Path))fs.unlinkSync(v51Path);
    process.exit(1);
  }
  server=server.slice(0,m.index)+route+'\n '+server.slice(m.index);
  fs.writeFileSync(serverPath,server,'utf8');
}

const curHtml=fs.readFileSync(indexPath,'utf8');
const curServer=fs.readFileSync(serverPath,'utf8');
const front=fs.readFileSync(v51Path,'utf8');

const checks=[
 ['V51 tag once',(curHtml.match(/native-ai-sheet-v51\.js\?v=51\.0\.0/g)||[]).length===1],
 ['V50 tag absent',!/native-ai-sheet-v50\.js/i.test(curHtml)],
 ['idempotent sheet build',front.includes("if(sheet.dataset.mf51Built==='1') return sheet")],
 ['delegated click handlers',front.includes("window.__MEMEFLOW_AI_V51_EVENTS__")&&front.includes("document.addEventListener('click'")],
 ['Analyze handler',front.includes("if(target.id==='mf49Scan') return scanToken()")],
 ['Ask handler',front.includes("if(target.id==='mf49Ask') return ask()")],
 ['Strategy handler',front.includes("if(target.id==='mf49Strategy') return strategy()")],
 ['Auto AI handler',front.includes("if(target.id==='mf49Auto') return toggleAuto(target)")],
 ['standalone endpoint',curServer.includes('/api/ai/standalone-scan')],
 ['OpenAI endpoints preserved',curServer.includes('/api/openai/status')&&curServer.includes('/api/openai/ask')],
 ['frontend syntax',spawnSync(process.execPath,['--check',v51Path],{encoding:'utf8'}).status===0],
 ['server syntax',spawnSync(process.execPath,['--check',serverPath],{encoding:'utf8'}).status===0],
 ['Candidates preserved',/id=["']sheet-candidates["']/i.test(curHtml)],
 ['Positions preserved',/id=["']sheet-positions["']/i.test(curHtml)],
 ['Wallet preserved',/id=["']sheet-wallet["']/i.test(curHtml)],
 ['More preserved',/data-sheet=["']more["']/i.test(curHtml)],
 ['rollback backup',fs.existsSync(path.join(backupDir,'index.html'))&&fs.existsSync(path.join(backupDir,'app-server.mjs'))]
];

console.log('=== V51 INSTALL CHECK ===');
for(const [n,o] of checks)console.log(`${o?'PASS':'FAIL'}  ${n}`);
const failed=checks.filter(([,o])=>!o);
if(failed.length){
  fs.copyFileSync(path.join(backupDir,'index.html'),indexPath);
  fs.copyFileSync(path.join(backupDir,'app-server.mjs'),serverPath);
  if(fs.existsSync(v51Path))fs.unlinkSync(v51Path);
  console.error(`V51 FAILED: ${failed.length} check(s). Exact pre-V51 state restored.`);
  process.exit(1);
}

console.log('V51 INSTALL OK: 17/17');
console.log(`V51 BACKEND: ${backendChanged?'REPAIRED — restart server manually':'ALREADY PRESENT'}`);
console.log('No server was started.');
