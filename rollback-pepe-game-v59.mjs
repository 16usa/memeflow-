import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app','game.html'))?path.join(root,'memeflow-app'):root;
const pointer=path.join(app,'.pepe-game-v59-last-backup');
if(!fs.existsSync(pointer)) throw new Error('No V5.9 backup pointer found.');
const backup=fs.readFileSync(pointer,'utf8').trim();
const manifest=JSON.parse(fs.readFileSync(path.join(backup,'manifest.json'),'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const engine=path.join(app,'src/game-engine.mjs'),server=path.join(app,'app-server.mjs'),index=path.join(app,'index.html');
if(sha(engine)!==manifest.engineHashBefore) throw new Error('Refusing rollback because game-engine.mjs changed independently after V5.9.');
if(sha(server)!==manifest.appServerHashBefore) throw new Error('Refusing rollback because app-server.mjs changed independently after V5.9.');
if(sha(index)!==manifest.indexHashBefore) throw new Error('Refusing rollback because index.html changed independently after V5.9.');
for(const f of manifest.files){const b=path.join(backup,f);if(!fs.existsSync(b))throw new Error('Missing backup '+b);fs.copyFileSync(b,path.join(app,f));}
console.log('Pepe Rocket V5.9 visual update rolled back.');
console.log('Trading logic was not touched.');
