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
const live={html:path.join(app,'game.html'),css:path.join(app,'game.css'),js:path.join(app,'game.js'),engine:path.join(app,'src','game-engine.mjs'),server:path.join(app,'app-server.mjs')};
for(const [name,file] of Object.entries(live)) if(!fs.existsSync(file)) throw new Error(`Required current Game file missing (${name}): ${file}`);

const current={html:fs.readFileSync(live.html,'utf8'),css:fs.readFileSync(live.css,'utf8'),js:fs.readFileSync(live.js,'utf8'),engine:fs.readFileSync(live.engine,'utf8'),server:fs.readFileSync(live.server,'utf8')};
if(current.js.includes("const CLIENT_VERSION='5.5.0';")&&current.html.includes('/game.js?v=55')&&current.html.includes('/game.css?v=55')){
  console.log('Pepe Rocket V5.5 is already installed. Run the verifier.');
  process.exit(0);
}
if(!current.js.includes("const CLIENT_VERSION='5.4.0';")) throw new Error('V5.5 updater expects the existing Pepe Rocket V5.4 client. No files were changed.');
if(!current.engine.includes("const GAME_VERSION = '5.4.0';")) throw new Error('V5.5 keeps the existing V5.4 Game Engine. Expected engine 5.4.0; no files were changed.');
for(const marker of ['MF_PEPE_ROCKET_GAME_IMPORT','MF_PEPE_ROCKET_GAME_INSTANCE','MF_PEPE_ROCKET_GAME_API_ROUTES','/api/game/stream']) if(!current.server.includes(marker)) throw new Error(`Current server is missing ${marker}. No files were changed.`);
if((current.html.match(/\/game\.js/g)||[]).length!==1||(current.html.match(/\/game\.css/g)||[]).length!==1) throw new Error('Current Game must have exactly one game.js and one game.css reference. No files were changed.');

const next={html:fs.readFileSync(path.join(sourceDir,'game.html'),'utf8'),css:fs.readFileSync(path.join(sourceDir,'game.css'),'utf8'),js:fs.readFileSync(path.join(sourceDir,'game.js'),'utf8')};
execFileSync(process.execPath,['--check',path.join(sourceDir,'game.js')],{stdio:'pipe'});
if((next.html.match(/\/game\.js/g)||[]).length!==1||(next.html.match(/\/game\.css/g)||[]).length!==1) throw new Error('V5.5 preflight failed: duplicate linked Game files.');
if((next.css.match(/{/g)||[]).length!==(next.css.match(/}/g)||[]).length) throw new Error('V5.5 preflight failed: CSS block imbalance.');
const ids=[...next.html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
if(new Set(ids).size!==ids.length) throw new Error('V5.5 preflight failed: duplicate HTML ids.');
const refs=new Set([...next.js.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]));const idSet=new Set(ids);
for(const id of refs) if(!idSet.has(id)) throw new Error(`V5.5 preflight failed: game.js references missing #${id}.`);
if(!next.js.includes('queueResult')||!next.js.includes('dataset.outcome')) throw new Error('V5.5 preflight failed: end-flight sequence missing.');

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(app,'.memeflow-patches','pepe-game-v55',stamp);fs.mkdirSync(backupDir,{recursive:true});
for(const [key,name] of [['html','game.html'],['css','game.css'],['js','game.js']]) fs.copyFileSync(live[key],path.join(backupDir,name));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.writeFileSync(path.join(backupDir,'manifest.json'),JSON.stringify({version:'5.5.0',createdAt:new Date().toISOString(),files:['game.html','game.css','game.js'],before:{html:sha(live.html),css:sha(live.css),js:sha(live.js)},engineUntouched:sha(live.engine),serverUntouched:sha(live.server)},null,2));

function atomicWrite(content,dst){const tmp=dst+'.v55tmp';try{fs.unlinkSync(tmp)}catch{}fs.writeFileSync(tmp,content);fs.renameSync(tmp,dst);}
atomicWrite(next.html,live.html);atomicWrite(next.css,live.css);atomicWrite(next.js,live.js);
execFileSync(process.execPath,['--check',live.js],{stdio:'pipe'});
console.log('Pepe Rocket V5.5 cinematic-flight in-place update installed.');
console.log('Updated only the existing game.html, game.css and game.js.');
console.log('Game Engine unchanged. app-server unchanged. index.html unchanged. No extra CSS/JS layers.');
console.log('Backup:',backupDir);
