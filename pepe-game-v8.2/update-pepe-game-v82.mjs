import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root='/home/runner/workspace',app=path.join(root,'memeflow-app'),pkg=path.join(root,'pepe-game-v8.2'),backup=path.join(pkg,'backup-v81');
const baseline={"game.html": "d11dca1ccf40b5b0d93988cf215d2e5bfdf046144572ba17cb25d40dc053c9a4", "game.css": "e609a0a0c5278030d35a9ade8339ca3b62dab11d03dd13ee4481b92927fbcd7b", "game.js": "303a31dd3084d65ce375f85f0cc50555ceeab0d12196100dd1381fcede225575"},next={"game.html": "02f4d0c0f0363c1f72c98a83ff798a2416a01230d3b7d70b2b71239a51e41e70", "game.css": "7e3a1fe168858b22f2d9c535f0e952cb4c03392bf55d3b92af75dda10abea7c0"};const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const f of ['game.html','game.css','game.js'])if(!fs.existsSync(path.join(app,f)))throw new Error('Missing '+path.join(app,f));
if(sha(path.join(app,'game.js'))!==baseline['game.js'])throw new Error('REFUSING: game.js is not exact V8 baseline');
fs.mkdirSync(backup,{recursive:true});
for(const f of ['game.html','game.css']){const p=path.join(app,f),h=sha(p);if(h===next[f]){console.log('UNCHANGED',f);continue}if(h!==baseline[f])throw new Error('REFUSING '+f+': not exact V8.1 baseline');const b=path.join(backup,f);if(!fs.existsSync(b))fs.copyFileSync(p,b);fs.copyFileSync(path.join(pkg,'payload',f),p);console.log('UPDATED',f)}
console.log('PEPE GAME V8.2 one-screen cockpit installed. game.js/trading/server untouched.');
