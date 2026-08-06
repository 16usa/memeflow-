import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
for(const rel of ['src/solana.mjs','app-server.mjs','src/discqueue.mjs']){
  const p=path.join(appDir,rel),b=p+'.before-discovery-throughput-v5';
  if(!fs.existsSync(b)){console.error('ABORT: missing backup '+b);process.exit(1)}
}
for(const rel of ['src/solana.mjs','app-server.mjs','src/discqueue.mjs']){
  const p=path.join(appDir,rel);
  fs.copyFileSync(p+'.before-discovery-throughput-v5',p);
  console.log('Restored:',p);
}
console.log('V5 rollback complete.');