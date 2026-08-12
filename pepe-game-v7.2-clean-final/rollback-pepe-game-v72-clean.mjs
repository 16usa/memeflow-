import fs from 'node:fs';
import path from 'node:path';
const root='/home/runner/workspace';
const app=path.join(root,'memeflow-app');
const b=path.join(root,'pepe-game-v7.2-clean-final','backup-v72-before-clean');
for(const f of ['game.html','game.css','game.js']){
  const src=path.join(b,f);
  if(!fs.existsSync(src)) throw new Error('Missing backup '+src);
  fs.copyFileSync(src,path.join(app,f));
  console.log('RESTORED',f);
}
console.log('V7.2 CLEAN rollback complete.');
