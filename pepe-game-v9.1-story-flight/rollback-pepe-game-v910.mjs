import fs from 'node:fs';import path from 'node:path';
const root='/home/runner/workspace',app=path.join(root,'memeflow-app'),pkg=path.join(root,'pepe-game-v9.1-story-flight'),backup=path.join(pkg,'backup-v910');
for(const f of ['game.html','game.css','game.js','game-webgl-v9.js']){const b=path.join(backup,f);if(!fs.existsSync(b))throw new Error('Missing backup '+b);fs.copyFileSync(b,path.join(app,f));console.log('RESTORED',f)}
console.log('Rolled back Pepe Game V9.1 story-flight patch.');