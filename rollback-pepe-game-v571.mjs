import fs from 'node:fs';
import path from 'node:path';
const workspace=process.cwd();let app=path.join(workspace,'memeflow-app');if(!fs.existsSync(path.join(app,'game.html')))app=workspace;
const root=path.join(app,'.memeflow-patches','pepe-game-v571');
if(!fs.existsSync(root)) throw new Error('No V5.7.1 backup directory found.');
const dirs=fs.readdirSync(root).map(x=>path.join(root,x)).filter(x=>fs.statSync(x).isDirectory()).sort().reverse();
const backup=dirs.find(d=>fs.existsSync(path.join(d,'manifest.json')));
if(!backup) throw new Error('No valid V5.7.1 backup found.');
for(const [src,dst] of [['game.html',path.join(app,'game.html')],['game.css',path.join(app,'game.css')],['game.js',path.join(app,'game.js')],['game-engine.mjs',path.join(app,'src','game-engine.mjs')]]){
  const from=path.join(backup,src);if(!fs.existsSync(from))throw new Error(`Backup missing ${src}`);fs.copyFileSync(from,dst);
}
console.log('Pepe Rocket V5.7.1 rolled back exactly to the pre-repair Game files.');
console.log('Restored from:',backup);
