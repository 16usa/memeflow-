import fs from 'node:fs';
import path from 'node:path';
const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
for(const file of [path.join(appDir,'src','evaluate.mjs'),path.join(appDir,'app-server.mjs')]){const b=`${file}.before-live-decision-sync-fix`;if(!fs.existsSync(b)){console.error(`ROLLBACK ABORTED: missing ${b}`);process.exit(1)}fs.copyFileSync(b,file)}
console.log('Rolled back MEMEFLOW live decision synchronization fix.');
