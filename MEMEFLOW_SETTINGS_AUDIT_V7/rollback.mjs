import fs from 'node:fs';
import path from 'node:path';
const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const rel=['src/settings.mjs','src/evaluate.mjs','src/paper-engine.mjs','src/store.mjs','app-server.mjs','index.html'];
for(const r of rel){const p=path.join(appDir,r),b=p+'.before-settings-audit-v7';if(!fs.existsSync(b)){console.error('ABORT: missing backup '+b);process.exit(1)}}
for(const r of rel){const p=path.join(appDir,r);fs.copyFileSync(p+'.before-settings-audit-v7',p);console.log('Restored:',p)}
console.log('V7 rollback complete.');
