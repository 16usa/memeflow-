import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const server=path.join(appDir,'app-server.mjs');
const index=path.join(appDir,'index.html');
const modulePath=path.join(appDir,'src','candidate-visibility.mjs');

for(const p of [server,index]){
 const b=p+'.before-qualified-candidates-v8';
 if(!fs.existsSync(b)){console.error('ABORT: backup missing '+b);process.exit(1)}
 fs.copyFileSync(b,p);
 console.log('Restored:',p);
}
const mb=modulePath+'.before-qualified-candidates-v8';
if(fs.existsSync(mb)){fs.copyFileSync(mb,modulePath);console.log('Restored:',modulePath)}
else if(fs.existsSync(modulePath)){fs.unlinkSync(modulePath);console.log('Removed:',modulePath)}

console.log('V8 rollback complete.');
