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

const live={
  html:path.join(app,'game.html'),css:path.join(app,'game.css'),js:path.join(app,'game.js'),
  engine:path.join(app,'src','game-engine.mjs'),server:path.join(app,'app-server.mjs'),index:path.join(app,'index.html')
};
for(const [name,file] of Object.entries(live)) if(!fs.existsSync(file)) throw new Error(`Required current file missing (${name}): ${file}`);

const current=Object.fromEntries(Object.entries(live).map(([k,p])=>[k,fs.readFileSync(p,'utf8')]));
if(current.js.includes("const CLIENT_VERSION='5.7.1';")&&current.engine.includes("const GAME_VERSION = '5.7.1';")&&current.engine.includes("policy: 'MEMEFLOW_SETTINGS_ONLY'")){
  console.log('Pepe Rocket V5.7.1 site-engine authority repair is already installed. Run the verifier.');
  process.exit(0);
}
const supported=['5.4.0','5.5.0','5.6.0','5.7.0'];
if(!supported.some(v=>current.js.includes(`const CLIENT_VERSION='${v}';`))) throw new Error('V5.7.1 repair expects Pepe Rocket V5.4–V5.7. No files were changed.');
if(!current.engine.includes("const GAME_VERSION = '5.4.0';")) throw new Error('V5.7.1 repair expects the current V5.4 Game Engine baseline. No files were changed.');
for(const marker of ['MF_PEPE_ROCKET_GAME_IMPORT','MF_PEPE_ROCKET_GAME_INSTANCE','MF_PEPE_ROCKET_GAME_API_ROUTES','/api/game/stream']) if(!current.server.includes(marker)) throw new Error(`Current server is missing ${marker}. No files were changed.`);
if((current.html.match(/\/game\.js/g)||[]).length!==1||(current.html.match(/\/game\.css/g)||[]).length!==1) throw new Error('Current Game must have exactly one game.js and one game.css reference. No files were changed.');

const next={
  html:fs.readFileSync(path.join(sourceDir,'game.html'),'utf8'),
  css:fs.readFileSync(path.join(sourceDir,'game.css'),'utf8'),
  js:fs.readFileSync(path.join(sourceDir,'game.js'),'utf8'),
  engine:fs.readFileSync(path.join(sourceDir,'game-engine.mjs'),'utf8')
};
execFileSync(process.execPath,['--check',path.join(sourceDir,'game.js')],{stdio:'pipe'});
execFileSync(process.execPath,['--check',path.join(sourceDir,'game-engine.mjs')],{stdio:'pipe'});
if((next.html.match(/\/game\.js/g)||[]).length!==1||(next.html.match(/\/game\.css/g)||[]).length!==1) throw new Error('V5.7.1 preflight failed: duplicate linked Game files.');
if((next.css.match(/{/g)||[]).length!==(next.css.match(/}/g)||[]).length) throw new Error('V5.7.1 preflight failed: CSS block imbalance.');
for(const required of ["policy: 'MEMEFLOW_SETTINGS_ONLY'","String(decision?.state || '').toUpperCase() !== 'BUY READY'","selectorScore: score","No current MEMEFLOW BUY READY candidate with a valid price"]){
  if(!next.engine.includes(required)) throw new Error(`V5.7.1 preflight failed: missing ${required}`);
}
for(const forbidden of ['if (pAge === null || pAge > this.startPriceMaxAgeMs)','if (dAge === null || dAge > this.decisionMaxAgeMs)','decisionBehindPrice++; continue','decisionBehindHolder++; continue','- crowdingPenalty']){
  if(next.engine.includes(forbidden)) throw new Error(`V5.7.1 preflight failed: old Game-only selector gate still active: ${forbidden}`);
}
const ids=[...next.html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
if(new Set(ids).size!==ids.length) throw new Error('V5.7.1 preflight failed: duplicate HTML ids.');
const refs=new Set([...next.js.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1])),idSet=new Set(ids);
for(const id of refs) if(!idSet.has(id)) throw new Error(`V5.7.1 preflight failed: game.js references missing #${id}.`);

const shaFile=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupDir=path.join(app,'.memeflow-patches','pepe-game-v571',stamp);
fs.mkdirSync(backupDir,{recursive:true});
for(const [key,name] of [['html','game.html'],['css','game.css'],['js','game.js'],['engine','game-engine.mjs']]) fs.copyFileSync(live[key],path.join(backupDir,name));
fs.writeFileSync(path.join(backupDir,'manifest.json'),JSON.stringify({
  version:'5.7.1',purpose:'restore MEMEFLOW site settings as sole Game entry authority',createdAt:new Date().toISOString(),
  files:['game.html','game.css','game.js','game-engine.mjs'],
  before:{html:shaFile(live.html),css:shaFile(live.css),js:shaFile(live.js),engine:shaFile(live.engine)},
  serverUntouched:shaFile(live.server),indexUntouched:shaFile(live.index)
},null,2));
function atomicWrite(content,dst){const tmp=dst+'.v571tmp';try{fs.unlinkSync(tmp)}catch{}fs.writeFileSync(tmp,content);fs.renameSync(tmp,dst);}
atomicWrite(next.html,live.html);atomicWrite(next.css,live.css);atomicWrite(next.js,live.js);atomicWrite(next.engine,live.engine);
execFileSync(process.execPath,['--check',live.js],{stdio:'pipe'});execFileSync(process.execPath,['--check',live.engine],{stdio:'pipe'});
console.log('Pepe Rocket V5.7.1 site-engine authority repair installed.');
console.log('Game entry now follows the existing per-user MEMEFLOW BUY READY decision.');
console.log('Removed Game-only freshness/coherence/market-shape/crowding entry gates.');
console.log('Live settlement safety, stale-quote cashout protection, Auto Cash Out and Stop Loss remain.');
console.log('app-server.mjs and index.html were not changed. No extra CSS/JS layers were added.');
console.log('Backup:',backupDir);
