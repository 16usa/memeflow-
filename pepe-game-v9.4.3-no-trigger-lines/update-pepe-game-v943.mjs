import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root='/home/runner/workspace',app=path.join(root,'memeflow-app'),pkg=path.join(root,'pepe-game-v9.4.3-no-trigger-lines'),backup=path.join(pkg,'backup-current');
const baseline={"game.html": "b99a3798122bc98f7cb91f8cc902b47abc0ce0e683c3763fe60c9559e85dfc00", "game.css": "1e05ca35a8d4eaa93feda58e2c4aec1bbadf23540fbb07651990b9fd3f79854e", "game.js": "52bc0d5236f48646cc30cce7db6841a92b5556ad197a605f50ca0afeeb31a3df", "game-webgl-v9.js": "4adca13095be31433268dd553ba732ca240bc684d4873a84b80020b586cc85b2"},next={"game.html": "42e04bfd65b904c2b022469b4c405c87f8fb6fbb42fb57e6f7a6b7a82712ab30", "game.css": "f11669d73d26055f92404f444fb4e6038fe076074261e90520b5a2dce338852f", "game.js": "52bc0d5236f48646cc30cce7db6841a92b5556ad197a605f50ca0afeeb31a3df", "game-webgl-v9.js": "4adca13095be31433268dd553ba732ca240bc684d4873a84b80020b586cc85b2"};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const f of Object.keys(next)){
  const p=path.join(app,f);
  if(!fs.existsSync(p))throw new Error('Missing '+p);
  const h=sha(p);
  if(h!==baseline[f]&&h!==next[f])throw new Error('REFUSING '+f+': expected exact V9.4.2 or V9.4.3');
}
fs.mkdirSync(backup,{recursive:true});
for(const f of Object.keys(next)){
  const p=path.join(app,f),b=path.join(backup,f),h=sha(p);
  if(!fs.existsSync(b)&&h!==next[f])fs.copyFileSync(p,b);
  if(h!==next[f]){fs.copyFileSync(path.join(pkg,'payload',f),p);console.log('UPDATED',f)}else console.log('UNCHANGED',f);
}
console.log('PEPE GAME V9.4.3 installed. Auto/Stop dotted guide lines removed; game logic untouched.');
