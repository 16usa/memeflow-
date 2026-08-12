import fs from 'node:fs';
import path from 'node:path';
const root='/home/runner/workspace';
const app=path.join(root,'memeflow-app');
const pkg=path.join(root,'pepe-game-v8.0');
const backup=path.join(pkg,'backup-v71');
for(const f of ['game.html','game.css','game.js']){
  const src=path.join(backup,f);
  if(!fs.existsSync(src))throw new Error(`Missing backup ${src}`);
  fs.copyFileSync(src,path.join(app,f));
  console.log(`RESTORED ${f}`);
}
console.log('PEPE GAME V8.0 rollback complete.');
