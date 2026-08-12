import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const here=path.dirname(fileURLToPath(import.meta.url));
const payload=path.join(here,'payload');
const app=path.resolve(process.cwd(),'memeflow-app');
const files=['game.html','game.css','game.js'];
const oldHashes={"game.html":"8a09f72b2d2c93abaeb00cd55b9323bfa621d7c1bdda4b43c5e3413aa1d346a8","game.css":"10c5313021dba5fb04c45dfff84a5bbbd1d1d11035ec2d876cca707fd9463362","game.js":"106bd3bb646467271fce539d6f4d18d09dc2fba33026c4ebe7cdd5f88c496837"};
const newHashes={"game.html":"a144d830140cf45229864ce6c2d8653adfebaa236dd239ac70168e2ab57144aa","game.css":"a67ae47ad0f927212d51addfc3c05fb5252b734f31201b0836983241c8581a1a","game.js":"1d5d67e2823f3faf614e60a59e0f62fec93897da0aeca222d9707c584debd4d3"};
const protectedFiles=['src/game-engine.mjs','app-server.mjs','index.html'];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const fail=m=>{console.error('PEPE GAME V6.4 UPDATE: FAIL · '+m);process.exit(1)};

if(!fs.existsSync(app))fail('run from /home/runner/workspace; memeflow-app not found');
if(path.basename(here)!=='pepe-game-v6.4')fail('package folder must be pepe-game-v6.4');
for(const f of files)if(!fs.existsSync(path.join(payload,f)))fail('package payload missing '+f);
const payloadNames=fs.readdirSync(payload).sort();
if(JSON.stringify(payloadNames)!==JSON.stringify([...files].sort()))fail('payload must contain visual files only');
for(const f of files)if(sha(path.join(payload,f))!==newHashes[f])fail('package hash mismatch for '+f);

for(const f of protectedFiles)if(!fs.existsSync(path.join(app,f)))fail('protected MEMEFLOW file missing: '+f);
const protectedBefore=Object.fromEntries(protectedFiles.map(f=>[f,sha(path.join(app,f))]));
execFileSync(process.execPath,['--check',path.join(payload,'game.js')],{stdio:'inherit'});

const current=Object.fromEntries(files.map(f=>[f,fs.existsSync(path.join(app,f))?sha(path.join(app,f)):null]));
if(files.every(f=>current[f]===newHashes[f])){
  console.log('Pepe Rocket V6.4 already installed; no files rewritten.');
  console.log('Trading/server files were not touched.');
  process.exit(0);
}
for(const f of files)if(current[f]!==oldHashes[f])fail('unexpected current '+f+'; expected V6.3. Refusing to stack/conflict visual layers.');

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=path.join(app,'.memeflow-patches','pepe-game-v64',stamp);
fs.mkdirSync(backup,{recursive:true});
for(const f of files)fs.copyFileSync(path.join(app,f),path.join(backup,f));
fs.writeFileSync(path.join(backup,'protected-hashes.json'),JSON.stringify(protectedBefore,null,2));

for(const f of files)fs.copyFileSync(path.join(payload,f),path.join(app,f));
for(const f of files)if(sha(path.join(app,f))!==newHashes[f])fail('post-write hash mismatch '+f);
for(const f of protectedFiles)if(sha(path.join(app,f))!==protectedBefore[f])fail('protected MEMEFLOW file changed unexpectedly: '+f);

const latest=path.join(app,'.memeflow-patches','pepe-game-v64','latest.json');
fs.writeFileSync(latest,JSON.stringify({backup,installedAt:Date.now(),oldHashes,newHashes,protectedBefore},null,2));
console.log('Pepe Rocket V6.4 installed in place.');
console.log('Changed: game.html, game.css, game.js only');
console.log('Protected trading/server files: unchanged');
console.log('Backup:',backup);
