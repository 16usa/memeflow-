import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app','game.html'))?path.join(root,'memeflow-app'):root;
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expectedNew={"game.html": "b0b66a8d814c831c0347f865af7faa6f19319503b619eaf2b1f203652dc6ab2d", "game.css": "e171a0a9fa960797a02d0176d4c73e44f2c2d36a725b6f7e3154de345c0f622e", "game.js": "448d9e10ac24eb0745eedc81d08163d5f26dd90d49863cc054d8bea4b824ede6"};
const pointer=path.join(app,'.pepe-game-v61-last-backup');
if(!fs.existsSync(pointer)) throw new Error('No V6.1 backup pointer found.');
const backup=fs.readFileSync(pointer,'utf8').trim();
const manifestPath=path.join(backup,'manifest.json');
if(!fs.existsSync(manifestPath)) throw new Error('V6.1 backup manifest is missing.');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
for(const f of ['game.html','game.css','game.js']){
  const live=path.join(app,f),saved=path.join(backup,f);
  if(!fs.existsSync(live)||!fs.existsSync(saved)) throw new Error(`Missing rollback file: ${f}`);
  if(sha(live)!==expectedNew[f]) throw new Error(`Refusing rollback: ${f} is no longer the exact V6.1 file. This avoids overwriting later visual work.`);
}
for(const f of ['game.html','game.css','game.js']) fs.copyFileSync(path.join(backup,f),path.join(app,f));
for(const f of ['game.html','game.css','game.js']) if(sha(path.join(app,f))!==manifest.visualHashesBefore[f]) throw new Error(`Rollback hash mismatch: ${f}`);
console.log('Pepe Rocket V6.1 visual rollback complete.');
console.log('Restored ONLY: game.html, game.css, game.js');
console.log('Trading/server files were not written.');
