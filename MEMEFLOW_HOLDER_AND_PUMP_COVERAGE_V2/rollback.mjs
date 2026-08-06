import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const files=[
  path.join(appDir,'src','enrich.mjs'),
  path.join(appDir,'src','solana.mjs'),
  path.join(appDir,'app-server.mjs')
];
for(const p of files){
  const b=p+'.before-holder-pump-v2';
  if(!fs.existsSync(b)){console.error('ABORT: missing backup '+b);process.exit(1)}
}
for(const p of files){
  fs.copyFileSync(p+'.before-holder-pump-v2',p);
  console.log('Restored:',p);
}
console.log('V2 rollback complete.');