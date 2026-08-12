import fs from 'node:fs';import path from 'node:path';
const workspace=process.cwd();let app=path.join(workspace,'memeflow-app');if(!fs.existsSync(path.join(app,'game.html')))app=workspace;
const root=path.join(app,'.memeflow-patches','pepe-game-v52');if(!fs.existsSync(root))throw new Error('No V5.2 backup directory found.');
const dirs=fs.readdirSync(root).map(n=>path.join(root,n)).filter(p=>fs.statSync(p).isDirectory()).sort().reverse();const backup=dirs[0];if(!backup)throw new Error('No V5.2 backup snapshot found.');
for(const [name,dst] of [['game.html',path.join(app,'game.html')],['game.js',path.join(app,'game.js')],['game-engine.mjs',path.join(app,'src','game-engine.mjs')]]){const src=path.join(backup,name);if(!fs.existsSync(src))throw new Error('Backup file missing: '+src);const tmp=dst+'.v52rollback';fs.copyFileSync(src,tmp);fs.renameSync(tmp,dst);}console.log('Rolled back the latest V5.2 in-place update from:',backup);
