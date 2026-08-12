import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root='/home/runner/workspace';
const app=path.join(root,'memeflow-app');
const pkg=path.join(root,'pepe-game-v8.1');
const backup=path.join(pkg,'backup-v80');
const baseline={"game.html": "93f007b6cadc87338f17fd9b2d33ebc00925ab31b203706d21f440bba524610d", "game.css": "44f2362784ab40ea65ec33829a6851cc23d459e70a3173942e2634ca88c0e096", "game.js": "303a31dd3084d65ce375f85f0cc50555ceeab0d12196100dd1381fcede225575"};
const next={"game.html": "d11dca1ccf40b5b0d93988cf215d2e5bfdf046144572ba17cb25d40dc053c9a4", "game.css": "e609a0a0c5278030d35a9ade8339ca3b62dab11d03dd13ee4481b92927fbcd7b"};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

for(const f of ['game.html','game.css','game.js']){
  const p=path.join(app,f);
  if(!fs.existsSync(p))throw new Error(`Missing ${p}`);
}
if(sha(path.join(app,'game.js'))!==baseline['game.js'])
  throw new Error('REFUSING: game.js is not the exact V8.0 baseline. Trading/client behavior will not be guessed.');

fs.mkdirSync(backup,{recursive:true});
for(const f of ['game.html','game.css']){
  const target=path.join(app,f), current=sha(target);
  if(current===next[f]){console.log('UNCHANGED',f,'already V8.1');continue;}
  if(current!==baseline[f])throw new Error(`REFUSING ${f}: current file is not exact V8.0 baseline`);
  const b=path.join(backup,f);if(!fs.existsSync(b))fs.copyFileSync(target,b);
  fs.copyFileSync(path.join(pkg,'payload',f),target);
  console.log('UPDATED',f);
}
console.log('PEPE GAME V8.1 layout fix installed. game.js/trading/server files were not touched.');
