import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root='/home/runner/workspace';
const app=path.join(root,'memeflow-app');
const pkg=path.join(root,'pepe-game-v8.0');
const src=path.join(pkg,'payload');
const backup=path.join(pkg,'backup-v71');
const baseline={"game.html": "a4587438b2cf58738fb82f9383d2f9f7171b1c858d126cc05c2bb5728fa16b76", "game.css": "11a94aed0125a5a8e7b1f38ac74eb57251c25a8887658d80bb3acad3c378245d", "game.js": "5c7e2f1f8a04b038b97e0c489f5e172124d06b21db300a5d5ee6af294b2e40e6"};
const target={"game.html": "93f007b6cadc87338f17fd9b2d33ebc00925ab31b203706d21f440bba524610d", "game.css": "44f2362784ab40ea65ec33829a6851cc23d459e70a3173942e2634ca88c0e096", "game.js": "303a31dd3084d65ce375f85f0cc50555ceeab0d12196100dd1381fcede225575"};
const protectedFiles=['src/game-engine.mjs','app-server.mjs','index.html'];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

for(const rel of protectedFiles){
  const p=path.join(app,rel);
  if(!fs.existsSync(p))throw new Error(`Missing protected file: ${rel}`);
}
const protectedBefore=Object.fromEntries(protectedFiles.map(rel=>[rel,sha(path.join(app,rel))]));

for(const f of Object.keys(baseline)){
  const dest=path.join(app,f);
  if(!fs.existsSync(dest))throw new Error(`Missing ${f}`);
  const current=sha(dest);
  if(current===target[f]){console.log(`UNCHANGED ${f} already V8.0`);continue;}
  if(current!==baseline[f])throw new Error(`REFUSING ${f}: current file is not exact V7.1 baseline`);
  fs.mkdirSync(backup,{recursive:true});
  const b=path.join(backup,f);if(!fs.existsSync(b))fs.copyFileSync(dest,b);
  fs.copyFileSync(path.join(src,f),dest);
  console.log(`UPDATED ${f}`);
}

for(const rel of protectedFiles){
  const after=sha(path.join(app,rel));
  if(after!==protectedBefore[rel])throw new Error(`Protected file changed unexpectedly: ${rel}`);
}
console.log('PEPE GAME V8.0 ARCADE COCKPIT installed. Trading/server files were not touched.');
