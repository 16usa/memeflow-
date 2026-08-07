import fs from 'node:fs';
import path from 'node:path';
const cwd=process.cwd(),appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
for(const rel of ['app-server.mjs','src/enrich.mjs','src/solana.mjs']){const p=path.join(appDir,rel),b=p+'.before-v11-rpc-load-controller';if(!fs.existsSync(b)){console.error('ABORT backup missing '+b);process.exit(1)}fs.copyFileSync(b,p);console.log('Restored:',p)}
console.log('V11 rollback complete.');
