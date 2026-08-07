import fs from 'node:fs';
import path from 'node:path';
const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
for(const rel of ['src/enrich.mjs','app-server.mjs']){
  const p=path.join(appDir,rel),b=p+'.before-v10-lifecycle-diag';
  if(!fs.existsSync(b)){console.error('ABORT: backup missing '+b);process.exit(1)}
  fs.copyFileSync(b,p);console.log('Restored:',p);
}
console.log('V10 rollback complete.');
