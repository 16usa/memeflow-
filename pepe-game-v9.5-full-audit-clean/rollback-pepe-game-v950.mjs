import fs from 'node:fs';import path from 'node:path';
const root='/home/runner/workspace',app=path.join(root,'memeflow-app'),b=path.join(root,'pepe-game-v9.5-full-audit-clean','backup-v943');
for(const f of ['game.html','game.css','game.js','game-webgl-v9.js']){const s=path.join(b,f);if(!fs.existsSync(s))throw new Error('Missing backup '+s);fs.copyFileSync(s,path.join(app,f));console.log('RESTORED',f)}
console.log('V9.5 rollback complete.');
