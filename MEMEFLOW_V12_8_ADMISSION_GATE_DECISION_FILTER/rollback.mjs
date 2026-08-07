import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const pairs=[
  [path.join(appDir,'app-server.mjs'),path.join(appDir,'app-server.mjs.before-v12-8-admission-gate')],
  [path.join(appDir,'src','enrich.mjs'),path.join(appDir,'src','enrich.mjs.before-v12-8-admission-gate')]
];

for(const [dst,bak] of pairs){
  if(!fs.existsSync(bak)){console.error('ABORT: backup missing '+bak);process.exit(1)}
}
for(const [dst,bak] of pairs)fs.copyFileSync(bak,dst);
console.log('V12.8 rollback complete.');
