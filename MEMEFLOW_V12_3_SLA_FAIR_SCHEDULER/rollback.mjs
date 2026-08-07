import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const server=path.join(appDir,'app-server.mjs');
const backup=server+'.before-v12-3-sla-fair-scheduler';

if(!fs.existsSync(backup)){
  console.error('ABORT: backup missing '+backup);
  process.exit(1);
}
fs.copyFileSync(backup,server);
console.log('V12.3 rollback complete.');
