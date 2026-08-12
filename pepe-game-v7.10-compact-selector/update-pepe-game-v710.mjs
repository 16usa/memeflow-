import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root='/home/runner/workspace',app=path.join(root,'memeflow-app'),pkg=path.join(root,'pepe-game-v7.10-compact-selector'),backup=path.join(pkg,'backup-v79');
const baseline={"game.html": "ec2a2219a464ad3edd1b9069087a0598379f46c427670cc250fb8cfcc29f7df6", "game.css": "3a53bae506799f5907a2e8add268456a837570ed06bc70db671cf498c9b61d97", "game.js": "04c03223736d197f1d89a2b8749fa9222e9ceac46c27c9415171fb01ea8a3509"},next={"game.html": "ecfbfe1095555b5958cbd060536250dce0ac27a50788404722d9c899c1feae8f", "game.css": "b149c818e5aa2233c59c14f0c01179e5a86cd26faf07534fe053b54813404420", "game.js": "04c03223736d197f1d89a2b8749fa9222e9ceac46c27c9415171fb01ea8a3509"};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const f of Object.keys(baseline)){
 const p=path.join(app,f);if(!fs.existsSync(p))throw new Error('Missing '+p);
 const h=sha(p);if(h!==baseline[f]&&h!==next[f])throw new Error('REFUSING '+f+': not exact V7.9/V7.10');
}
fs.mkdirSync(backup,{recursive:true});
for(const f of Object.keys(baseline)){
 const p=path.join(app,f),b=path.join(backup,f),h=sha(p);
 if(!fs.existsSync(b)){if(h!==baseline[f])throw new Error('Cannot create V7.9 backup for '+f);fs.copyFileSync(p,b);console.log('BACKUP',f);}
 if(h===next[f]){console.log('UNCHANGED',f);continue;}
 fs.copyFileSync(path.join(pkg,'payload',f),p);console.log('UPDATED',f);
}
console.log('PEPE GAME V7.10 Compact Selector installed. Trading/server untouched.');
