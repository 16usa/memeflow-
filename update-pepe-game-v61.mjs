import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app','game.html'))?path.join(root,'memeflow-app'):root;
const pkg=path.dirname(new URL(import.meta.url).pathname);
const source=path.join(pkg,'source');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expectedBase={"game.html": "86af63a492d5b314747e0a21ffdca2cad8cdecd708d0d561c4db0620c3c89c0a", "game.css": "b02f1d06294f40bc402b6df0f3aa854c41d5a97cd400091826045da7a86d6b53", "game.js": "a4d94bec011dacfd54cddee47ac763110d967ee57abcc0d760c87a3b8086eb3a"};
const expectedNew={"game.html": "b0b66a8d814c831c0347f865af7faa6f19319503b619eaf2b1f203652dc6ab2d", "game.css": "e171a0a9fa960797a02d0176d4c73e44f2c2d36a725b6f7e3154de345c0f622e", "game.js": "448d9e10ac24eb0745eedc81d08163d5f26dd90d49863cc054d8bea4b824ede6"};
const expectedEngine='316745a891c1280cb13574fb0a8c9cb69a7e637aa812e98e3330ba723974469e';

for(const f of ['game.html','game.css','game.js','src/game-engine.mjs','app-server.mjs','index.html']){
  if(!fs.existsSync(path.join(app,f))) throw new Error(`Missing ${path.join(app,f)}`);
}
const engine=path.join(app,'src/game-engine.mjs'),server=path.join(app,'app-server.mjs'),index=path.join(app,'index.html');
if(sha(engine)!==expectedEngine) throw new Error('Refusing V6.1 visual update: Game engine is not the expected site-authority engine. This package never rewrites trading logic.');

const current=Object.fromEntries(['game.html','game.css','game.js'].map(f=>[f,sha(path.join(app,f))]));
const allBase=Object.keys(expectedBase).every(f=>current[f]===expectedBase[f]);
const allNew=Object.keys(expectedNew).every(f=>current[f]===expectedNew[f]);
if(allNew){
  console.log('Pepe Rocket V6.1 is already installed. No files were rewritten.');
  console.log('Trading engine untouched.');
  process.exit(0);
}
if(!allBase) throw new Error('Refusing V6.1 update: visual files are not a clean V6.0 set. This prevents CSS/JS layer conflicts.');

const engineHash=sha(engine),serverHash=sha(server),indexHash=sha(index);
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=path.join(app,'.memeflow-patches','pepe-game-v61',stamp);
fs.mkdirSync(backup,{recursive:true});
for(const f of ['game.html','game.css','game.js']) fs.copyFileSync(path.join(app,f),path.join(backup,f));
fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify({
  version:'6.1',createdAt:new Date().toISOString(),files:['game.html','game.css','game.js'],
  engineHashBefore:engineHash,appServerHashBefore:serverHash,indexHashBefore:indexHash,
  visualHashesBefore:current
},null,2));

for(const f of ['game.html','game.css','game.js']) fs.copyFileSync(path.join(source,f),path.join(app,f));

if(sha(engine)!==engineHash) throw new Error('Safety failure: game-engine.mjs changed during V6.1 visual update.');
if(sha(server)!==serverHash) throw new Error('Safety failure: app-server.mjs changed during V6.1 visual update.');
if(sha(index)!==indexHash) throw new Error('Safety failure: index.html changed during V6.1 visual update.');
for(const f of ['game.html','game.css','game.js']) if(sha(path.join(app,f))!==expectedNew[f]) throw new Error(`Post-write hash mismatch: ${f}`);

fs.writeFileSync(path.join(app,'.pepe-game-v61-last-backup'),backup);
console.log('Pepe Rocket V6.1 visual/runtime update installed.');
console.log('Changed ONLY: game.html, game.css, game.js');
console.log('UNCHANGED: game-engine.mjs, app-server.mjs, index.html, settings, BUY/SELL logic');
console.log('Backup:',backup);
