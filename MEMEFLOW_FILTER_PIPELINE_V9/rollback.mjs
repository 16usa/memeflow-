import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
for(const rel of ['src/evaluate.mjs','app-server.mjs']){
  const p=path.join(appDir,rel),b=p+'.before-filter-pipeline-v9';
  if(!fs.existsSync(b)){console.error('ABORT: backup missing '+b);process.exit(1)}
  fs.copyFileSync(b,p);
  console.log('Restored:',p);
}
console.log('V9 rollback complete.');
