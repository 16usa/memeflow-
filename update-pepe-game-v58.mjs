
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const app = fs.existsSync(path.join(root,'memeflow-app','game.html')) ? path.join(root,'memeflow-app') : root;
const pkg = path.dirname(new URL(import.meta.url).pathname);
const source = path.join(pkg,'source');

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expectedBase = {
  "game.html": "831dfeb876673df9f96d86471d530342f56153be30050a7680c61582a3c1407a",
  "game.css": "92c638d9bcac49227c013b59453eae83d3a45d94799c77ca42aaba19448229cc",
  "game.js": "93c5dba4b09355e24f8cce6fae537461b53eb6f2366b63c5a8ef88f67de0c021",
  "game-engine.mjs": "316745a891c1280cb13574fb0a8c9cb69a7e637aa812e98e3330ba723974469e"
};
const expectedNew = {
  "game.html": "843686d211650170f1eca8e3d916f6109d64805a8a95243efc235c2651eb6276",
  "game.css": "af7dba16d475ef7238bddf32b15d05471296c15d62a5563915d767669ce0938d",
  "game.js": "e46bdff4d0717f37f465dc015976e1800c901c8aa18808463e5de2068d748148",
  "game-engine.mjs": "316745a891c1280cb13574fb0a8c9cb69a7e637aa812e98e3330ba723974469e"
};

for (const f of ['game.html','game.css','game.js','src/game-engine.mjs']) {
  const p=path.join(app,f);
  if(!fs.existsSync(p)) throw new Error(`Missing ${p}`);
}

const liveEngine=path.join(app,'src/game-engine.mjs');
const engineBefore=sha(liveEngine);
if(engineBefore!==expectedBase['game-engine.mjs']) {
  throw new Error('Refusing V5.8 update: game-engine.mjs does not match the V5.7.1 authority-fix engine. Trading logic must remain untouched.');
}

for (const f of ['game.html','game.css','game.js']) {
  const h=sha(path.join(app,f));
  if(h!==expectedBase[f] && h!==expectedNew[f]) {
    throw new Error(`Refusing V5.8 update: ${f} is not the expected V5.7.1 or V5.8 file. This prevents accidental layer/conflict installation.`);
  }
}

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=path.join(app,'.memeflow-patches','pepe-game-v58',stamp);
fs.mkdirSync(backup,{recursive:true});
for(const f of ['game.html','game.css','game.js']) fs.copyFileSync(path.join(app,f),path.join(backup,f));
const appServer=path.join(app,'app-server.mjs');
const manifest={
  version:'5.8',
  createdAt:new Date().toISOString(),
  files:['game.html','game.css','game.js'],
  engineHashBefore:engineBefore,
  appServerHashBefore:fs.existsSync(appServer)?sha(appServer):null
};
fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify(manifest,null,2));

for(const f of ['game.html','game.css','game.js']) {
  fs.copyFileSync(path.join(source,f),path.join(app,f));
}

if(sha(liveEngine)!==engineBefore) throw new Error('Safety failure: game-engine.mjs changed during visual update.');
if(fs.existsSync(appServer) && manifest.appServerHashBefore && sha(appServer)!==manifest.appServerHashBefore) throw new Error('Safety failure: app-server.mjs changed during visual update.');

for(const f of ['game.html','game.css','game.js']) {
  if(sha(path.join(app,f))!==expectedNew[f]) throw new Error(`Post-write hash mismatch: ${f}`);
}

fs.writeFileSync(path.join(app,'.pepe-game-v58-last-backup'),backup);
console.log('Pepe Rocket V5.8 visual-only update installed.');
console.log('Changed: game.html, game.css, game.js');
console.log('UNCHANGED: game-engine.mjs, app-server.mjs, index.html, trading settings/logic');
console.log('Backup:',backup);
