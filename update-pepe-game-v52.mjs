import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const here=path.dirname(fileURLToPath(import.meta.url));
const sourceDir=path.join(here,'source');
const workspace=process.cwd();
let app=path.join(workspace,'memeflow-app');
if(!fs.existsSync(path.join(app,'game.html'))) app=workspace;
const htmlPath=path.join(app,'game.html');
const jsPath=path.join(app,'game.js');
const enginePath=path.join(app,'src','game-engine.mjs');
const serverPath=path.join(app,'app-server.mjs');
const cssPath=path.join(app,'game.css');
for(const f of [htmlPath,jsPath,enginePath,serverPath,cssPath]) if(!fs.existsSync(f)) throw new Error(`Required current Game file missing: ${f}`);

const currentEngine=fs.readFileSync(enginePath,'utf8');
if(currentEngine.includes("const GAME_VERSION = '5.2.0';")){
  console.log('Pepe Rocket V5.2 is already installed. Running verification is safe.');
  process.exit(0);
}
if(!currentEngine.includes("const GAME_VERSION = '5.1.0';")) throw new Error('This updater expects the current V5.1 Game Engine. No files were changed.');
const currentJs=fs.readFileSync(jsPath,'utf8');
if(!currentJs.includes('market feed stopped updating beyond the V5.1 safety window')) throw new Error('Current game.js does not match the expected V5.1 family. No files were changed.');
const currentServer=fs.readFileSync(serverPath,'utf8');
for(const marker of ['MF_PEPE_ROCKET_GAME_IMPORT','MF_PEPE_ROCKET_GAME_INSTANCE','MF_PEPE_ROCKET_GAME_API_ROUTES','/api/game/stream']) if(!currentServer.includes(marker)) throw new Error(`Current server is missing ${marker}. No files were changed.`);

// Preflight the new code before touching live files.
for(const f of ['game.js','game-engine.mjs']){
  const src=path.join(sourceDir,f);
  if(!fs.existsSync(src)) throw new Error(`Updater source missing: ${src}`);
  execFileSync(process.execPath,['--check',src],{stdio:'pipe'});
}

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(app,'.memeflow-patches','pepe-game-v52',stamp);
fs.mkdirSync(backupDir,{recursive:true});
for(const [src,name] of [[htmlPath,'game.html'],[jsPath,'game.js'],[enginePath,'game-engine.mjs']]) fs.copyFileSync(src,path.join(backupDir,name));
fs.writeFileSync(path.join(backupDir,'manifest.json'),JSON.stringify({version:'5.2.0',createdAt:new Date().toISOString(),files:['game.html','game.js','game-engine.mjs']},null,2));

let html=fs.readFileSync(htmlPath,'utf8');
const scriptRe=/<script\s+src=["']\/game\.js\?v=\d+["']\s+defer><\/script>/;
if(!scriptRe.test(html)) throw new Error('Cannot find the single current game.js cache-bust tag. Live files were not changed.');
html=html.replace(scriptRe,'<script src="/game.js?v=52" defer></script>');

const stage=path.join(backupDir,'.stage');fs.mkdirSync(path.join(stage,'src'),{recursive:true});
fs.writeFileSync(path.join(stage,'game.html'),html,'utf8');
fs.copyFileSync(path.join(sourceDir,'game.js'),path.join(stage,'game.js'));
fs.copyFileSync(path.join(sourceDir,'game-engine.mjs'),path.join(stage,'src','game-engine.mjs'));
execFileSync(process.execPath,['--check',path.join(stage,'game.js')],{stdio:'pipe'});
execFileSync(process.execPath,['--check',path.join(stage,'src','game-engine.mjs')],{stdio:'pipe'});

function atomicCopy(src,dst){const tmp=dst+'.v52tmp';try{fs.unlinkSync(tmp)}catch{}fs.copyFileSync(src,tmp);fs.renameSync(tmp,dst);}
atomicCopy(path.join(stage,'game.html'),htmlPath);
atomicCopy(path.join(stage,'game.js'),jsPath);
atomicCopy(path.join(stage,'src','game-engine.mjs'),enginePath);

console.log('Pepe Rocket V5.2 in-place update installed.');
console.log('Updated existing files only: game.html cache-bust, game.js, src/game-engine.mjs');
console.log('No new CSS layer. No new JS layer. No app-server rewrite. No index.html rewrite.');
console.log('Backup:',backupDir);
