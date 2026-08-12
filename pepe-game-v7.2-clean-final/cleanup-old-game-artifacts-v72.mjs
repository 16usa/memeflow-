import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root='/home/runner/workspace';
const app=path.join(root,'memeflow-app');
const keepDir='pepe-game-v7.2-clean-final';
const apply=process.argv.includes('--apply');
const expected={"game.html": "279e2be99aee05343bf0a043a92d59a807bcf8da76c8960f3216dd3b45fca936", "game.css": "979a1be421379aa9b1db676d3a6ca4cc997908c02f6331e708bef710720df54f", "game.js": "d9ad38b1f93044a5988c57f909a9f86abb83a04c943d7e547f81219709472cc8"};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

for(const [f,h] of Object.entries(expected)){
  const p=path.join(app,f);
  if(!fs.existsSync(p)||sha(p)!==h)
    throw new Error('REFUSING CLEANUP: live '+f+' is not verified CLEAN V7.2');
}

const protectedNames=new Set([
  'memeflow-app','node_modules','.git','.replit','replit.nix',
  'package.json','package-lock.json','pnpm-lock.yaml','yarn.lock',
  keepDir,'pepe-game-v7.2-clean-final.zip'
]);

const legacyRootFile = name => {
  if(name==='pepe-game-v7.2-one-screen-stable.zip') return true;
  if(/^pepe-game-v(?!7\.2-clean-final).*\.(?:zip|mjs)$/i.test(name)) return true;
  if(/^(?:install-pepe-game|verify-pepe-game|rollback-pepe-game|install-game).*\.(?:mjs|js|zip)$/i.test(name)) return true;
  if(/^MEMEFLOW_Pepe_Rocket_Game.*(?:\.zip)?$/i.test(name)) return true;
  return false;
};

const legacyRootDir = name => {
  if(name===keepDir) return false;
  if(/^pepe-game-v/i.test(name)) return true;
  if(/^MEMEFLOW_Pepe_Rocket_Game/i.test(name)) return true;
  return false;
};

function safeLegacySource(dir){
  let sawGame=false, count=0, unsafe=false;
  const allowedFile=/^(?:game\.(?:html|css|js)|(?:install|verify|rollback)[^/]*\.(?:mjs|js)|README[^/]*\.txt|SHA256SUMS\.txt|[^/]*(?:pepe|game)[^/]*\.zip)$/i;
  const allowedDir=/^(?:payload|source|backup[^/]*|pepe-game-v[^/]*)$/i;
  function walk(d){
    for(const ent of fs.readdirSync(d,{withFileTypes:true})){
      count++; if(count>300){unsafe=true;return;}
      const p=path.join(d,ent.name);
      if(ent.isDirectory()){
        if(!allowedDir.test(ent.name)){unsafe=true;return;}
        walk(p); if(unsafe)return;
      } else {
        if(!allowedFile.test(ent.name)){unsafe=true;return;}
        if(/^game\.(?:html|css|js)$/i.test(ent.name)) sawGame=true;
      }
    }
  }
  try{walk(dir)}catch{return false}
  return !unsafe && sawGame;
}

const plan=[];
for(const ent of fs.readdirSync(root,{withFileTypes:true})){
  if(protectedNames.has(ent.name)) continue;
  const p=path.join(root,ent.name);
  if(ent.isDirectory() && legacyRootDir(ent.name)) plan.push({kind:'dir',path:p});
  else if(ent.isFile() && legacyRootFile(ent.name)) plan.push({kind:'file',path:p});
  else if(ent.isDirectory() && ent.name==='source' && safeLegacySource(p))
    plan.push({kind:'dir',path:p,note:'verified legacy Game staging folder'});
}

console.log(apply?'APPLY MODE':'DRY RUN');
console.log('Verified live version: V7.2 CLEAN FINAL');
if(!plan.length) console.log('No removable legacy Game artifacts found.');
for(const x of plan) console.log(apply?'DELETE':'WOULD DELETE',x.path,x.note||'');

if(apply){
  for(const x of plan){
    if(x.kind==='dir') fs.rmSync(x.path,{recursive:true,force:true});
    else fs.rmSync(x.path,{force:true});
  }
  console.log('CLEANUP COMPLETE:',plan.length,'legacy Game artifacts removed.');
  console.log('Protected memeflow-app/project files were not traversed or deleted.');
} else {
  console.log('Nothing deleted. Run again with --apply after reviewing this plan.');
}
