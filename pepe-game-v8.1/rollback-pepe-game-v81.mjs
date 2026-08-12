import fs from 'node:fs';import path from 'node:path';
const root='/home/runner/workspace',app=path.join(root,'memeflow-app'),backup=path.join(root,'pepe-game-v8.1','backup-v80');
for(const f of ['game.html','game.css']){const b=path.join(backup,f);if(!fs.existsSync(b))throw new Error(`Missing backup ${b}`);fs.copyFileSync(b,path.join(app,f));console.log('RESTORED',f)}
console.log('PEPE GAME V8.1 rollback complete.');
