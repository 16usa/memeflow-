
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const appDir=fs.existsSync(path.join(root,'memeflow-app'))?path.join(root,'memeflow-app'):root;
for(const rel of ['src/evaluate.mjs','src/store.mjs']){
 const target=path.join(appDir,rel),backup=target+'.before-dead-candidate-fix';
 if(!fs.existsSync(backup)){console.error(`Missing backup: ${backup}`);process.exitCode=1;continue}
 fs.copyFileSync(backup,target);
 console.log(`Restored ${rel}`);
}
