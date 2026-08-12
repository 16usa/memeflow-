import fs from 'node:fs';
import path from 'node:path';
const workspace=process.cwd();let app=path.join(workspace,'memeflow-app');if(!fs.existsSync(path.join(app,'game.html')))app=workspace;
const root=path.join(app,'.memeflow-patches','pepe-game-v57');if(!fs.existsSync(root))throw new Error('No V5.7 backup directory found.');
const dirs=fs.readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort().reverse();let backup=null;
for(const d of dirs){const p=path.join(root,d);if(fs.existsSync(path.join(p,'manifest.json'))){backup=p;break;}}
if(!backup)throw new Error('No V5.7 backup manifest found.');
const manifest=JSON.parse(fs.readFileSync(path.join(backup,'manifest.json'),'utf8'));
for(const name of manifest.files||[]){const src=path.join(backup,name),dst=path.join(app,name);if(!fs.existsSync(src))throw new Error(`Backup file missing: ${src}`);const tmp=dst+'.v57rollback';try{fs.unlinkSync(tmp)}catch{}fs.copyFileSync(src,tmp);fs.renameSync(tmp,dst);}
console.log('Pepe Rocket V5.7 rollback complete from:',backup);
console.log('Only game.html, game.css and game.js were restored. Restart MEMEFLOW after rollback.');
