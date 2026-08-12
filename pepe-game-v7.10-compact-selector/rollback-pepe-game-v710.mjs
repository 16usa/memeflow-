import fs from 'node:fs';import path from 'node:path';
const root='/home/runner/workspace',app=path.join(root,'memeflow-app'),b=path.join(root,'pepe-game-v7.10-compact-selector','backup-v79');
for(const f of ['game.html','game.css','game.js']){const s=path.join(b,f);if(!fs.existsSync(s))throw new Error('Missing '+s);fs.copyFileSync(s,path.join(app,f));console.log('RESTORED',f)}
console.log('V7.10 rollback complete.');
