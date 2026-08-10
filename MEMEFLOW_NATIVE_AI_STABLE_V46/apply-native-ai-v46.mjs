#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=process.cwd();
const appDir=[
  path.join(root,'memeflow-app'),
  root,
  path.join(root,'artifacts','memeflow')
].find(p=>fs.existsSync(path.join(p,'index.html'))&&fs.existsSync(path.join(p,'app-server.mjs')));

if(!appDir){
  console.error('V46: could not find index.html + app-server.mjs.');
  process.exit(1);
}

const indexPath=path.join(appDir,'index.html');
const serverPath=path.join(appDir,'app-server.mjs');
const packagePath=path.join(appDir,'package.json');

for(const p of [indexPath,serverPath,packagePath]){
  if(fs.existsSync(p)&&!fs.existsSync(p+'.pre-v46.bak')) fs.copyFileSync(p,p+'.pre-v46.bak');
}

let html=fs.readFileSync(indexPath,'utf8');
let server=fs.readFileSync(serverPath,'utf8');

if(!/class=["'][^"']*mobile-nav/i.test(html)||!/id=["']sheet-positions["']/i.test(html)){
  console.error('V46: native MEMEFLOW sheet structure was not found.');
  process.exit(1);
}
if(!server.includes("async function handler(req,res)")){
  console.error('V46: app-server handler anchor was not found.');
  process.exit(1);
}

/* Remove V45 bootstrap dependency from package.json. Manual `node app-server.mjs` works again. */
if(fs.existsSync(packagePath)){
  const pkg=JSON.parse(fs.readFileSync(packagePath,'utf8'));
  pkg.scripts=pkg.scripts||{};
  pkg.scripts.start='node app-server.mjs';
  fs.writeFileSync(packagePath,JSON.stringify(pkg,null,2)+'\n');
}

/* Remove V45 bootstrap file; V46 patches the real server directly. */
for(const old of ['native-ai-bootstrap.mjs','native-ai-sheet.js']){
  const p=path.join(appDir,old);
  if(fs.existsSync(p)) fs.unlinkSync(p);
}

/* Remove old AI runtime SCRIPT TAGS only. Keep V26/V44 responsive/wallet layers. */
const obsolete=[
  'native-ai-sheet',
  'native-ai-sheet-v46',
  'ai-direct-evaluator-v24',
  'ai-direct-evaluator-v30',
  'ai-duplicate-modal-fix-v28',
  'ai-modal-click-fix-v29',
  'ai-sparkles-icon-v36',
  'ai-icon-compact-v37',
  'ai-icon-final-v38',
  'ai-icon-center-v39',
  'ai-icon-true-center-v40'
];
for(const name of obsolete){
  html=html.replace(new RegExp(`\\s*<script\\b[^>]*src=["']\\./${name}\\.js(?:\\?[^"']*)?["'][^>]*><\\/script>\\s*`,'ig'),'\n');
}

/* Add ONE V46 script at the end so it wins over old inline/nav handlers. */
const tag='<script src="./native-ai-sheet-v46.js?v=46.0.0" defer></script>';
if(!/<\/body>/i.test(html)){
  console.error('V46: </body> not found.');
  process.exit(1);
}
html=html.replace(/<\/body>/i,`${tag}\n</body>`);
fs.writeFileSync(indexPath,html,'utf8');
fs.copyFileSync(path.join(__dirname,'native-ai-sheet-v46.js'),path.join(appDir,'native-ai-sheet-v46.js'));

/* Replace any prior V46 server injection, then add helpers directly before handler. */
server=server.replace(/\/\* MEMEFLOW_NATIVE_AI_V46_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_NATIVE_AI_V46_END \*\/\s*/g,'');
server=server.replace(/\/\* MEMEFLOW_NATIVE_AI_V46_ROUTES_BEGIN \*\/[\s\S]*?\/\* MEMEFLOW_NATIVE_AI_V46_ROUTES_END \*\/\s*/g,'');

const helpers=fs.readFileSync(path.join(__dirname,'server-helpers-v46.txt'),'utf8');
const routes=fs.readFileSync(path.join(__dirname,'server-routes-v46.txt'),'utf8');

server=server.replace('async function handler(req,res){',helpers+'\nasync function handler(req,res){');

const routeAnchor=" if(url.pathname==='/api/health')";
if(!server.includes(routeAnchor)){
  console.error('V46: /api/health route anchor not found.');
  process.exit(1);
}
server=server.replace(routeAnchor,routes+'\n'+routeAnchor);

fs.writeFileSync(serverPath,server,'utf8');

const checks=[
  ['server syntax',spawnSync(process.execPath,['--check',serverPath],{encoding:'utf8'}).status===0],
  ['frontend syntax',spawnSync(process.execPath,['--check',path.join(appDir,'native-ai-sheet-v46.js')],{encoding:'utf8'}).status===0],
  ['V46 script once',(fs.readFileSync(indexPath,'utf8').match(/native-ai-sheet-v46\.js\?v=46\.0\.0/g)||[]).length===1],
  ['old V45 bootstrap removed',!fs.existsSync(path.join(appDir,'native-ai-bootstrap.mjs'))],
  ['direct OpenAI routes installed',fs.readFileSync(serverPath,'utf8').includes("'/api/openai/status'")&&fs.readFileSync(serverPath,'utf8').includes("'/api/openai/analyze'")],
  ['native sheets preserved',/id=["']sheet-positions["']/i.test(fs.readFileSync(indexPath,'utf8'))&&/id=["']sheet-wallet["']/i.test(fs.readFileSync(indexPath,'utf8'))],
  ['More preserved',/data-sheet=["']more["']/i.test(fs.readFileSync(indexPath,'utf8'))]
];

console.log('=== MEMEFLOW V46 INSTALL CHECK ===');
for(const [label,ok] of checks) console.log(`${ok?'PASS':'FAIL'}  ${label}`);

const failed=checks.filter(([,ok])=>!ok);
if(failed.length){
  for(const p of [indexPath,serverPath,packagePath]){
    if(fs.existsSync(p+'.pre-v46.bak')) fs.copyFileSync(p+'.pre-v46.bak',p);
  }
  console.error(`V46 FAILED: ${failed.length} check(s). Backups restored.`);
  process.exit(1);
}

console.log('V46 INSTALL OK: 7/7');
console.log('Start command is back to: node app-server.mjs');
console.log('V45 bootstrap monkey-patch removed.');
console.log('MEMEFLOW OpenAI is now a native mobile-sheet with direct server routes.');
