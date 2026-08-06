import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const rels=['src/store.mjs','src/liveeval.mjs','src/discqueue.mjs','src/solana.mjs','src/enrich.mjs','app-server.mjs'];
const suffix='.before-discovery-reliability-v1';

for(const rel of rels){
  const file=path.join(appDir,rel), backup=file+suffix;
  if(!fs.existsSync(backup)){
    console.error('ROLLBACK ABORTED: missing',backup);
    process.exit(1);
  }
}
for(const rel of rels){
  const file=path.join(appDir,rel);
  fs.copyFileSync(file+suffix,file);
  console.log('Restored:',file);
}
console.log('Rollback complete.');