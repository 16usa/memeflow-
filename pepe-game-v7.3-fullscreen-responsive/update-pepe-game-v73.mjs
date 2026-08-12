import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root='/home/runner/workspace',app=path.join(root,'memeflow-app'),pkg=path.join(root,'pepe-game-v7.3-fullscreen-responsive');
const baseline={"game.html": "279e2be99aee05343bf0a043a92d59a807bcf8da76c8960f3216dd3b45fca936", "game.css": "979a1be421379aa9b1db676d3a6ca4cc997908c02f6331e708bef710720df54f", "game.js": "d9ad38b1f93044a5988c57f909a9f86abb83a04c943d7e547f81219709472cc8"};
const next={"game.html": "430959c4b16a19eb8c3d0d1f3fe763dcdff6d86742d092a8482d77fbb6441e6d", "game.css": "a351aa951b195918c64430512ce612a1db3b5d50a4c4bea11c88fd14d95c1ef3", "game.js": "04c03223736d197f1d89a2b8749fa9222e9ceac46c27c9415171fb01ea8a3509"};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const backup=path.join(pkg,'backup-v72-before-v73');fs.mkdirSync(backup,{recursive:true});
for(const f of Object.keys(baseline)){const p=path.join(app,f);if(!fs.existsSync(p))throw new Error('Missing '+p);const h=sha(p);if(h===next[f]){console.log('UNCHANGED',f,'already V7.3');continue}if(h!==baseline[f])throw new Error('REFUSING '+f+': expected exact V7.2 CLEAN baseline');const b=path.join(backup,f);if(!fs.existsSync(b))fs.copyFileSync(p,b);fs.copyFileSync(path.join(pkg,'payload',f),p);console.log('UPDATED',f)}
console.log('PEPE GAME V7.3 FULLSCREEN RESPONSIVE installed. Server/trading engine untouched.');
