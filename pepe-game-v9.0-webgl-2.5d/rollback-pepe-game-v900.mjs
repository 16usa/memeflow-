import fs from 'node:fs';import path from 'node:path';
const root='/home/runner/workspace',app=path.join(root,'memeflow-app'),b=path.join(root,'pepe-game-v9.0-webgl-2.5d','backup-v7111');
for(const f of ['game.html','game.css','game.js','game-scene.js']){const s=path.join(b,f);if(!fs.existsSync(s))throw new Error('Missing '+s);fs.copyFileSync(s,path.join(app,f));console.log('RESTORED',f)}
const nw=path.join(app,'game-webgl-v9.js');if(fs.existsSync(nw))fs.rmSync(nw);console.log('V9.0 rollback complete.');
