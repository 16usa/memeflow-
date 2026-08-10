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
  console.error('V47: MEMEFLOW app not found.');
  process.exit(1);
}

const indexPath=path.join(appDir,'index.html');
const serverPath=path.join(appDir,'app-server.mjs');
const old46=path.join(appDir,'native-ai-sheet-v46.js');
const new47=path.join(appDir,'native-ai-sheet-v47.js');

const htmlBefore=fs.readFileSync(indexPath,'utf8');
const server=fs.readFileSync(serverPath,'utf8');

if(!/class=["'][^"']*mobile-nav/i.test(htmlBefore)||!/id=["']sheet-positions["']/i.test(htmlBefore)){
  console.error('V47: native mobile navigation/sheets were not found; refusing to patch.');
  process.exit(1);
}

if(!server.includes('/api/openai/status')||!server.includes('/api/openai/analyze')||!server.includes('/api/openai/ask')){
  console.error('V47: V46 OpenAI server routes are not installed. Install V46 first.');
  process.exit(1);
}

for(const p of [indexPath,old46]){
  if(fs.existsSync(p)&&!fs.existsSync(p+'.pre-v47.bak')) fs.copyFileSync(p,p+'.pre-v47.bak');
}

let html=htmlBefore;

/* Remove only AI frontend runtimes; preserve wallet, layout, V44 and all native sheets. */
const obsolete=[
  'native-ai-sheet-v46',
  'native-ai-sheet-v47',
  'native-ai-sheet',
  'ai-direct-evaluator-v24',
  'ai-direct-evaluator-v30',
  'ai-duplicate-modal-fix-v28',
  'ai-modal-click-fix-v29'
];

for(const name of obsolete){
  html=html.replace(new RegExp(`\\s*<script\\b[^>]*src=["'][^"']*${name}\\.js(?:\\?[^"']*)?["'][^>]*><\\/script>\\s*`,'ig'),'\n');
}

if(!/<\/body>/i.test(html)){
  console.error('V47: </body> not found.');
  process.exit(1);
}

html=html.replace(/<\/body>/i,'<script src="./native-ai-sheet-v47.js?v=47.0.0" defer></script>\n</body>');
fs.writeFileSync(indexPath,html,'utf8');
fs.copyFileSync(path.join(patchDir,'native-ai-sheet-v47.js'),new47);

/* Old V46 frontend file is no longer used. */
if(fs.existsSync(old46)) fs.unlinkSync(old46);

const current=fs.readFileSync(indexPath,'utf8');
const checks=[
  ['V47 script exactly once',(current.match(/native-ai-sheet-v47\.js\?v=47\.0\.0/g)||[]).length===1],
  ['V46 frontend tag absent',!/native-ai-sheet-v46\.js/i.test(current)],
  ['old V30 AI tag absent',!/ai-direct-evaluator-v30\.js/i.test(current)],
  ['Candidates preserved',/id=["']sheet-candidates["']/i.test(current)],
  ['Positions preserved',/id=["']sheet-positions["']/i.test(current)],
  ['Wallet preserved',/id=["']sheet-wallet["']/i.test(current)],
  ['More preserved',/data-sheet=["']more["']/i.test(current)],
  ['V46 server routes preserved',server.includes('/api/openai/status')&&server.includes('/api/openai/analyze')&&server.includes('/api/openai/ask')],
  ['frontend syntax',spawnSync(process.execPath,['--check',new47],{encoding:'utf8'}).status===0]
];

console.log('=== MEMEFLOW V47 INSTALL CHECK ===');
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'}  ${name}`);

const failed=checks.filter(([,ok])=>!ok);
if(failed.length){
  if(fs.existsSync(indexPath+'.pre-v47.bak'))fs.copyFileSync(indexPath+'.pre-v47.bak',indexPath);
  if(fs.existsSync(old46+'.pre-v47.bak'))fs.copyFileSync(old46+'.pre-v47.bak',old46);
  if(fs.existsSync(new47))fs.unlinkSync(new47);
  console.error(`V47 FAILED: ${failed.length} check(s). Backup restored.`);
  process.exit(1);
}

console.log('V47 INSTALL OK: 9/9');
console.log('No server start was performed.');
