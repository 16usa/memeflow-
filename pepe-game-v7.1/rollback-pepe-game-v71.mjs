import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root='/home/runner/workspace',app=path.join(root,'memeflow-app'),pkg=path.join(root,'pepe-game-v7.1'),backup=path.join(pkg,'backup-v70');
for(const f of ['game.html','game.css','game.js']){const b=path.join(backup,f);if(!fs.existsSync(b))throw new Error(`Missing backup ${b}`);fs.copyFileSync(b,path.join(app,f));console.log(`RESTORED ${f}`)}
console.log('PEPE GAME V7.1 rollback complete.');
