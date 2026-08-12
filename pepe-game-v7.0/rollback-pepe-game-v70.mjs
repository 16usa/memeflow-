import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const app=path.resolve(process.cwd(),'memeflow-app'),latest=path.join(app,'.memeflow-patches','pepe-game-v70','latest.json');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');const fail=m=>{console.error('PEPE GAME V7.0 ROLLBACK: FAIL · '+m);process.exit(1)};
if(!fs.existsSync(latest))fail('no V7.0 backup metadata found');const meta=JSON.parse(fs.readFileSync(latest,'utf8')),files=['game.html','game.css','game.js'];
for(const f of ['src/game-engine.mjs','app-server.mjs','index.html']){const p=path.join(app,f);if(!fs.existsSync(p)||sha(p)!==meta.protectedBefore[f])fail('protected file changed independently; rollback aborted: '+f);}
for(const f of files){const p=path.join(app,f);if(!fs.existsSync(p)||sha(p)!==meta.newHashes[f])fail('current visual file changed independently; rollback aborted: '+f);}
for(const f of files){const from=path.join(meta.backup,f);if(!fs.existsSync(from))fail('backup missing '+f);fs.copyFileSync(from,path.join(app,f));if(sha(path.join(app,f))!==meta.oldHashes[f])fail('restored hash mismatch '+f);}
console.log('Pepe Rocket V7.0 rollback: PASS');console.log('Restored V6.9 visual files only. Trading/server files untouched.');
