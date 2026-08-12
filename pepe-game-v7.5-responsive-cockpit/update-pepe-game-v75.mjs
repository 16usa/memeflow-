import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root='/home/runner/workspace',app=path.join(root,'memeflow-app'),pkg=path.join(root,'pepe-game-v7.5-responsive-cockpit'),backup=path.join(pkg,'backup-v74');
const baseline={"game.html": "1960875ffd61deffdd4eb669f04e30274531bdd84aff822b765a6df9b4353b80", "game.css": "d0db270236631f25383dbb0f22c90ab84a2b6cf4571ee5669043a35f16c3230e", "game.js": "04c03223736d197f1d89a2b8749fa9222e9ceac46c27c9415171fb01ea8a3509"},next={"game.html": "479abd5c4246924b113548fb6d5833a5ac484a591b72bfc8a66895d8071e7ec7", "game.css": "dcd068d94a3e399cf7815840e030771325c41847df98b2b78a34621aa4b37923", "game.js": "04c03223736d197f1d89a2b8749fa9222e9ceac46c27c9415171fb01ea8a3509"};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

for(const f of Object.keys(baseline)){
  const p=path.join(app,f);
  if(!fs.existsSync(p))throw new Error('Missing '+p);
  const h=sha(p);
  if(h!==baseline[f]&&h!==next[f])throw new Error('REFUSING '+f+': current file is neither exact V7.4 nor exact V7.5');
}

fs.mkdirSync(backup,{recursive:true});
for(const f of Object.keys(baseline)){
  const p=path.join(app,f),b=path.join(backup,f),h=sha(p);
  if(!fs.existsSync(b)){
    if(h!==baseline[f])throw new Error('REFUSING backup for '+f+': original V7.4 baseline is no longer available');
    fs.copyFileSync(p,b);console.log('BACKUP',f);
  }
  if(h===next[f]){console.log('UNCHANGED',f,'already V7.5');continue;}
  fs.copyFileSync(path.join(pkg,'payload',f),p);console.log('UPDATED',f);
}
console.log('PEPE GAME V7.5 Responsive Cockpit installed. Trading/server files untouched.');
