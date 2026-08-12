import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app','game.html'))?path.join(root,'memeflow-app'):root;
const pkg=path.dirname(new URL(import.meta.url).pathname);
const source=path.join(pkg,'source');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expectedBase={
  'game.html':'843686d211650170f1eca8e3d916f6109d64805a8a95243efc235c2651eb6276',
  'game.css':'af7dba16d475ef7238bddf32b15d05471296c15d62a5563915d767669ce0938d',
  'game.js':'e46bdff4d0717f37f465dc015976e1800c901c8aa18808463e5de2068d748148',
  'game-engine.mjs':'316745a891c1280cb13574fb0a8c9cb69a7e637aa812e98e3330ba723974469e'
};
const expectedNew={
  'game.html':'93f752e1497503319b31b697a40d9f2936917af8fd78daa501b7848f926c4122',
  'game.css':'c40b519cc1540c8fc36c33c1d03ca3c067bcdb1b354bd7c6aa229861b19efadc',
  'game.js':'c5f143c024055bb2191330f9902121338b09fb10e4180c582467971a39b9b13d'
};
for(const f of ['game.html','game.css','game.js','src/game-engine.mjs','app-server.mjs','index.html']){
  if(!fs.existsSync(path.join(app,f))) throw new Error(`Missing ${path.join(app,f)}`);
}
const engine=path.join(app,'src/game-engine.mjs'),server=path.join(app,'app-server.mjs'),index=path.join(app,'index.html');
if(sha(engine)!==expectedBase['game-engine.mjs']) throw new Error('Refusing V5.9 visual update: Game trading engine is not the expected site-authority engine. V5.9 will not alter or guess trading logic.');
for(const f of ['game.html','game.css','game.js']){
  const h=sha(path.join(app,f));
  if(h!==expectedBase[f]&&h!==expectedNew[f]) throw new Error(`Refusing V5.9 update: ${f} is not V5.8 or V5.9. This prevents visual layer conflicts.`);
}
const engineHash=sha(engine),serverHash=sha(server),indexHash=sha(index);
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=path.join(app,'.memeflow-patches','pepe-game-v59',stamp);
fs.mkdirSync(backup,{recursive:true});
for(const f of ['game.html','game.css','game.js']) fs.copyFileSync(path.join(app,f),path.join(backup,f));
fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify({version:'5.9',createdAt:new Date().toISOString(),files:['game.html','game.css','game.js'],engineHashBefore:engineHash,appServerHashBefore:serverHash,indexHashBefore:indexHash},null,2));
for(const f of ['game.html','game.css','game.js']) fs.copyFileSync(path.join(source,f),path.join(app,f));
if(sha(engine)!==engineHash) throw new Error('Safety failure: game-engine.mjs changed during V5.9 visual update.');
if(sha(server)!==serverHash) throw new Error('Safety failure: app-server.mjs changed during V5.9 visual update.');
if(sha(index)!==indexHash) throw new Error('Safety failure: index.html changed during V5.9 visual update.');
for(const f of ['game.html','game.css','game.js']) if(sha(path.join(app,f))!==expectedNew[f]) throw new Error(`Post-write hash mismatch: ${f}`);
fs.writeFileSync(path.join(app,'.pepe-game-v59-last-backup'),backup);
console.log('Pepe Rocket V5.9 immersive visual update installed.');
console.log('Changed ONLY: game.html, game.css, game.js');
console.log('UNCHANGED: game-engine.mjs, app-server.mjs, index.html, settings, BUY/SELL logic');
console.log('Backup:',backup);
