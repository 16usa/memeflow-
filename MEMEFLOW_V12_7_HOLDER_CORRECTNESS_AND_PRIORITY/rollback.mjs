import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const p=path.join(appDir,'src','enrich.mjs');
const b=p+'.before-v12-7-holder-correctness-priority';

if(!fs.existsSync(b)){
  console.error('ABORT: backup missing '+b);
  process.exit(1);
}
fs.copyFileSync(b,p);
console.log('V12.7 rollback complete.');
