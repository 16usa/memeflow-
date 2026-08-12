import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const appDir=fs.existsSync(path.join(root,'memeflow-app','index.html'))?path.join(root,'memeflow-app'):(fs.existsSync(path.join(root,'index.html'))?root:null);
if(!appDir)throw new Error('MEMEFLOW app not found. Run from /home/runner/workspace or memeflow-app.');
const base=path.join(appDir,'.memeflow-patches','pepe-game-v51');
if(!fs.existsSync(base))throw new Error('No Pepe Game V5.1 backup directory exists.');
const dirs=fs.readdirSync(base).map(name=>path.join(base,name)).filter(p=>fs.statSync(p).isDirectory()).sort().reverse();
if(!dirs.length)throw new Error('No Pepe Game V5.1 backup snapshot exists.');
const backup=dirs[0];
const manifestPath=path.join(backup,'backup-manifest.json');
if(!fs.existsSync(manifestPath))throw new Error('Backup manifest missing: '+manifestPath);
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const targets=['index.html','app-server.mjs','game.html','game.css','game.js','src/game-engine.mjs','game-assets'];
for(const rel of targets){
  const dest=path.join(appDir,rel);const meta=manifest.files?.[rel];
  if(!meta?.existed){try{fs.rmSync(dest,{recursive:true,force:true})}catch{}continue;}
  const src=path.join(backup,rel);if(!fs.existsSync(src))throw new Error('Backup content missing: '+src);
  try{fs.rmSync(dest,{recursive:true,force:true})}catch{}
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  if(fs.statSync(src).isDirectory())fs.cpSync(src,dest,{recursive:true});else fs.copyFileSync(src,dest);
}
try{fs.unlinkSync(path.join(appDir,'.pepe-game-v51-installed'))}catch{}
console.log('Pepe Rocket V5.1 rolled back to snapshot: '+backup);
console.log('Restart MEMEFLOW after rollback.');
