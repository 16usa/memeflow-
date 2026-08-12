import fs from 'node:fs';import path from 'node:path';
const root='/home/runner/workspace',app=path.join(root,'memeflow-app'),b=path.join(root,'pepe-game-v7.11.1-visible-layered-flight','backup-current');
for(const f of ['game.html','game.css','game.js']){
 const s=path.join(b,f);if(fs.existsSync(s)){fs.copyFileSync(s,path.join(app,f));console.log('RESTORED',f)}
}
const oldScene=path.join(b,'game-scene.js'),dst=path.join(app,'game-scene.js');
if(fs.existsSync(oldScene)){fs.copyFileSync(oldScene,dst);console.log('RESTORED game-scene.js')}
else if(fs.existsSync(dst)){fs.rmSync(dst);console.log('REMOVED game-scene.js')}
console.log('V7.11.1 rollback complete.');
