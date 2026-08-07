import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const pairs=[
  [path.join(appDir,'app-server.mjs'),path.join(appDir,'app-server.mjs.before-v12-5-first-snapshot')],
  [path.join(appDir,'src','solana.mjs'),path.join(appDir,'src','solana.mjs.before-v12-5-first-snapshot')]
];

for(const [dst,bak] of pairs){
  if(!fs.existsSync(bak)){
    console.error('ABORT: backup missing '+bak);
    process.exit(1);
  }
}
for(const [dst,bak] of pairs)fs.copyFileSync(bak,dst);
console.log('V12.5 rollback complete.');
