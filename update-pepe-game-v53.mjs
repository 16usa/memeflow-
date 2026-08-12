import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const here=path.dirname(fileURLToPath(import.meta.url));
const sourceDir=path.join(here,'source');
const workspace=process.cwd();
let app=path.join(workspace,'memeflow-app');
if(!fs.existsSync(path.join(app,'game.html'))) app=workspace;
const paths={
  html:path.join(app,'game.html'),
  css:path.join(app,'game.css'),
  js:path.join(app,'game.js'),
  engine:path.join(app,'src','game-engine.mjs'),
  server:path.join(app,'app-server.mjs')
};
for(const [name,file] of Object.entries(paths)) if(!fs.existsSync(file)) throw new Error(`Required current Game file missing (${name}): ${file}`);

const currentHtml=fs.readFileSync(paths.html,'utf8');
const currentCss=fs.readFileSync(paths.css,'utf8');
const currentJs=fs.readFileSync(paths.js,'utf8');
const currentEngine=fs.readFileSync(paths.engine,'utf8');
const currentServer=fs.readFileSync(paths.server,'utf8');
if(currentJs.includes("const CLIENT_VERSION='5.3.0';") && currentHtml.includes('/game.js?v=53') && currentHtml.includes('/game.css?v=53')){
  console.log('Pepe Rocket V5.3 is already installed. Running verification is safe.');
  process.exit(0);
}
if(!currentEngine.includes("const GAME_VERSION = '5.1.0';") && !currentEngine.includes("const GAME_VERSION = '5.2.0';")){
  throw new Error('V5.3 updater expects the existing V5.1 or V5.2 Game Engine. No files were changed.');
}
if(!currentJs.includes('server-authoritative paper game') && !currentJs.includes('market feed stopped updating')){
  throw new Error('Current game.js is not recognized as the V5.1/V5.2 Game family. No files were changed.');
}
for(const marker of ['MF_PEPE_ROCKET_GAME_IMPORT','MF_PEPE_ROCKET_GAME_INSTANCE','MF_PEPE_ROCKET_GAME_API_ROUTES','/api/game/stream']){
  if(!currentServer.includes(marker)) throw new Error(`Current server is missing ${marker}. No files were changed.`);
}
if((currentHtml.match(/\/game\.js/g)||[]).length!==1 || (currentHtml.match(/\/game\.css/g)||[]).length!==1){
  throw new Error('Current Game must have exactly one game.js and one game.css reference. No files were changed.');
}

for(const f of ['game.js','game-engine.mjs']) execFileSync(process.execPath,['--check',path.join(sourceDir,f)],{stdio:'pipe'});
const nextHtml=fs.readFileSync(path.join(sourceDir,'game.html'),'utf8');
const nextCss=fs.readFileSync(path.join(sourceDir,'game.css'),'utf8');
if((nextHtml.match(/\/game\.js/g)||[]).length!==1 || (nextHtml.match(/\/game\.css/g)||[]).length!==1) throw new Error('V5.3 preflight failed: duplicate linked Game files.');
if((nextCss.match(/{/g)||[]).length!==(nextCss.match(/}/g)||[]).length) throw new Error('V5.3 preflight failed: CSS block imbalance.');
const ids=[...nextHtml.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
if(new Set(ids).size!==ids.length) throw new Error('V5.3 preflight failed: duplicate HTML ids.');
const nextJs=fs.readFileSync(path.join(sourceDir,'game.js'),'utf8');
const refs=new Set([...nextJs.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]));
const idSet=new Set(ids);
for(const id of refs) if(!idSet.has(id)) throw new Error(`V5.3 preflight failed: game.js references missing #${id}.`);

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(app,'.memeflow-patches','pepe-game-v53',stamp);
fs.mkdirSync(backupDir,{recursive:true});
for(const [key,name] of [['html','game.html'],['css','game.css'],['js','game.js'],['engine','game-engine.mjs']]) fs.copyFileSync(paths[key],path.join(backupDir,name));
fs.writeFileSync(path.join(backupDir,'manifest.json'),JSON.stringify({version:'5.3.0',createdAt:new Date().toISOString(),files:['game.html','game.css','game.js','game-engine.mjs']},null,2));

const stage=path.join(backupDir,'.stage');
fs.mkdirSync(path.join(stage,'src'),{recursive:true});
for(const [src,dst] of [
  [path.join(sourceDir,'game.html'),path.join(stage,'game.html')],
  [path.join(sourceDir,'game.css'),path.join(stage,'game.css')],
  [path.join(sourceDir,'game.js'),path.join(stage,'game.js')],
  [path.join(sourceDir,'game-engine.mjs'),path.join(stage,'src','game-engine.mjs')]
]) fs.copyFileSync(src,dst);
execFileSync(process.execPath,['--check',path.join(stage,'game.js')],{stdio:'pipe'});
execFileSync(process.execPath,['--check',path.join(stage,'src','game-engine.mjs')],{stdio:'pipe'});

function atomicCopy(src,dst){const tmp=dst+'.v53tmp';try{fs.unlinkSync(tmp)}catch{}fs.copyFileSync(src,tmp);fs.renameSync(tmp,dst);}
atomicCopy(path.join(stage,'game.html'),paths.html);
atomicCopy(path.join(stage,'game.css'),paths.css);
atomicCopy(path.join(stage,'game.js'),paths.js);
atomicCopy(path.join(stage,'src','game-engine.mjs'),paths.engine);

console.log('Pepe Rocket V5.3 cinematic in-place update installed.');
console.log('Updated existing Game files only: game.html, game.css, game.js, src/game-engine.mjs');
console.log('No extra CSS file. No extra JS file. No app-server rewrite. No index.html rewrite.');
console.log('Backup:',backupDir);
