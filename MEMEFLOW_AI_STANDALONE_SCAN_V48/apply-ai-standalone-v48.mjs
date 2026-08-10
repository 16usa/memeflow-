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

if(!appDir){
  console.error('V48: MEMEFLOW app not found.');
  process.exit(1);
}

const indexPath=path.join(appDir,'index.html');
const serverPath=path.join(appDir,'app-server.mjs');
const v47Path=path.join(appDir,'native-ai-sheet-v47.js');
const v48Path=path.join(appDir,'native-ai-sheet-v48.js');
const backupDir=path.join(appDir,'.memeflow-v48-backup');
const manifestPath=path.join(backupDir,'manifest.json');

let html=fs.readFileSync(indexPath,'utf8');
let server=fs.readFileSync(serverPath,'utf8');

const prechecks=[
  ['native mobile nav',/class=["'][^"']*mobile-nav/i.test(html)],
  ['Candidates sheet',/id=["']sheet-candidates["']/i.test(html)],
  ['Positions sheet',/id=["']sheet-positions["']/i.test(html)],
  ['Wallet sheet',/id=["']sheet-wallet["']/i.test(html)],
  ['More button',/data-sheet=["']more["']/i.test(html)],
  ['OpenAI status route',server.includes('/api/openai/status')],
  ['OpenAI ask route',server.includes('/api/openai/ask')],
  ['evaluate import',server.includes("import {evaluate} from './src/evaluate.mjs'")],
  ['handler anchor',server.includes('async function handler(req,res){')]
];

console.log('=== V48 PRECHECK ===');
for(const [n,o] of prechecks) console.log(`${o?'PASS':'FAIL'}  ${n}`);
if(prechecks.some(([,o])=>!o)){
  console.error('V48: prerequisite check failed. Nothing was changed.');
  process.exit(1);
}

/* Preserve the exact pre-V48 state once. Re-running V48 will NOT overwrite the rollback point. */
if(!fs.existsSync(backupDir)){
  fs.mkdirSync(backupDir,{recursive:true});
  fs.copyFileSync(indexPath,path.join(backupDir,'index.html'));
  fs.copyFileSync(serverPath,path.join(backupDir,'app-server.mjs'));
  const manifest={createdAt:new Date().toISOString(),files:{v47:fs.existsSync(v47Path)}};
  if(fs.existsSync(v47Path)) fs.copyFileSync(v47Path,path.join(backupDir,'native-ai-sheet-v47.js'));
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
}

/* Frontend: replace AI frontend only. Do not touch V44/nav/wallet/responsive layers. */
for(const name of [
  'native-ai-sheet-v47','native-ai-sheet-v48','native-ai-sheet-v46','native-ai-sheet',
  'ai-direct-evaluator-v24','ai-direct-evaluator-v30','ai-duplicate-modal-fix-v28','ai-modal-click-fix-v29'
]){
  html=html.replace(new RegExp(`\\s*<script\\b[^>]*src=["'][^"']*${name}\\.js(?:\\?[^"']*)?["'][^>]*><\\/script>\\s*`,'ig'),'\n');
}
if(!/<\/body>/i.test(html)){
  console.error('V48: </body> not found. Nothing changed.');
  process.exit(1);
}
html=html.replace(/<\/body>/i,'<script src="./native-ai-sheet-v48.js?v=48.0.0" defer></script>\n</body>');
fs.writeFileSync(indexPath,html,'utf8');
fs.copyFileSync(path.join(patchDir,'native-ai-sheet-v48.js'),v48Path);

/* Server: idempotently replace ONLY the V48 standalone scan helper/route. */
server=server.replace(/\/\* MEMEFLOW_AI_STANDALONE_V48_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V48_END \*\/\s*/g,'');
server=server.replace(/\/\* MEMEFLOW_AI_STANDALONE_V48_ROUTE_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V48_ROUTE_END \*\/\s*/g,'');

const helpers=fs.readFileSync(path.join(patchDir,'server-helpers-v48.txt'),'utf8');
const route=fs.readFileSync(path.join(patchDir,'server-route-v48.txt'),'utf8');

server=server.replace('async function handler(req,res){',helpers+'\nasync function handler(req,res){');

const anchor=" if(url.pathname==='/api/ai/decisions')";
if(!server.includes(anchor)){
  console.error('V48: /api/ai/decisions route anchor not found. Restoring backup.');
  fs.copyFileSync(path.join(backupDir,'index.html'),indexPath);
  fs.copyFileSync(path.join(backupDir,'app-server.mjs'),serverPath);
  process.exit(1);
}
server=server.replace(anchor,route+'\n'+anchor);
fs.writeFileSync(serverPath,server,'utf8');

const currentHtml=fs.readFileSync(indexPath,'utf8');
const currentServer=fs.readFileSync(serverPath,'utf8');
const helperBlock=(currentServer.match(/\/\* MEMEFLOW_AI_STANDALONE_V48_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_AI_STANDALONE_V48_END \*\//)||[''])[0];

const checks=[
  ['V48 frontend exactly once',(currentHtml.match(/native-ai-sheet-v48\.js\?v=48\.0\.0/g)||[]).length===1],
  ['V47 frontend tag removed',!/native-ai-sheet-v47\.js/i.test(currentHtml)],
  ['standalone scan route exactly once',(currentServer.match(/MEMEFLOW_AI_STANDALONE_V48_ROUTE_BEGIN/g)||[]).length===1],
  ['V46 OpenAI ask preserved',currentServer.includes('/api/openai/ask')],
  ['Candidates preserved',/id=["']sheet-candidates["']/i.test(currentHtml)],
  ['Positions preserved',/id=["']sheet-positions["']/i.test(currentHtml)],
  ['Wallet preserved',/id=["']sheet-wallet["']/i.test(currentHtml)],
  ['More preserved',/data-sheet=["']more["']/i.test(currentHtml)],
  ['frontend syntax',spawnSync(process.execPath,['--check',v48Path],{encoding:'utf8'}).status===0],
  ['server syntax',spawnSync(process.execPath,['--check',serverPath],{encoding:'utf8'}).status===0],
  ['scan helper does not write Candidate Feed',!/(setDecision|evaluateAll|setToken|addToken)\s*\(/.test(helperBlock)],
  ['rollback backup exists',fs.existsSync(path.join(backupDir,'index.html'))&&fs.existsSync(path.join(backupDir,'app-server.mjs'))]
];

console.log('=== MEMEFLOW V48 INSTALL CHECK ===');
for(const [n,o] of checks) console.log(`${o?'PASS':'FAIL'}  ${n}`);

const failed=checks.filter(([,o])=>!o);
if(failed.length){
  fs.copyFileSync(path.join(backupDir,'index.html'),indexPath);
  fs.copyFileSync(path.join(backupDir,'app-server.mjs'),serverPath);
  if(fs.existsSync(path.join(backupDir,'native-ai-sheet-v47.js'))) fs.copyFileSync(path.join(backupDir,'native-ai-sheet-v47.js'),v47Path);
  if(fs.existsSync(v48Path)) fs.unlinkSync(v48Path);
  console.error(`V48 FAILED: ${failed.length} check(s). Exact pre-V48 backup restored.`);
  process.exit(1);
}

console.log('V48 INSTALL OK: 12/12');
console.log('Rollback point: memeflow-app/.memeflow-v48-backup');
console.log('No server was started.');
