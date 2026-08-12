import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root='/home/runner/workspace';
const app=path.join(root,'memeflow-app');
const pkg=path.join(root,'pepe-game-v7.2-clean-final');
const backup=path.join(pkg,'backup-v72-before-clean');
const baseline={"game.html": "8ee9437218c17326e16745c3ad6782f3a2779bfac898901ee311ed473f049a28", "game.css": "0801d014d528abdc8bbb52f177c804cd4470a5a5b1817e4977a5fef8df647995", "game.js": "7b80e523e243bd3bcc3de1b8b6be08830da28874099f71ba0aa737f1feb6cb90"};
const next={"game.html": "279e2be99aee05343bf0a043a92d59a807bcf8da76c8960f3216dd3b45fca936", "game.css": "979a1be421379aa9b1db676d3a6ca4cc997908c02f6331e708bef710720df54f", "game.js": "d9ad38b1f93044a5988c57f909a9f86abb83a04c943d7e547f81219709472cc8"};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

for(const f of Object.keys(baseline)){
  const p=path.join(app,f);
  if(!fs.existsSync(p)) throw new Error('Missing '+p);
}
fs.mkdirSync(backup,{recursive:true});
for(const f of Object.keys(baseline)){
  const p=path.join(app,f), h=sha(p);
  if(h===next[f]){ console.log('UNCHANGED',f,'already CLEAN V7.2'); continue; }
  if(h!==baseline[f]) throw new Error('REFUSING '+f+': current file is not exact V7.2 baseline');
  const b=path.join(backup,f);
  if(!fs.existsSync(b)) fs.copyFileSync(p,b);
  fs.copyFileSync(path.join(pkg,'payload',f),p);
  console.log('CLEANED',f);
}
console.log('PEPE GAME V7.2 CLEAN FINAL installed.');
console.log('Trading/server/protected project files were not touched.');
