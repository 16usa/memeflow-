import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const here=path.dirname(fileURLToPath(import.meta.url));
const payload=path.join(here,'payload');
const app=path.resolve(process.cwd(),'memeflow-app');
const files=['game.html','game.css','game.js'];
const oldHashes={"game.html":"971125d44159695220ef7223800042f81a8b6c288e59f087c6716eb81b1288e1","game.css":"2a3b73861a6b838e35b927dafe59b3a975f48dbc719c6bf037719cdc553adeff","game.js":"f8575f7752245ed5058302b8414b1be77dd0bd314d6aff70d6121bc156fac9aa"};
const newHashes={"game.html":"6dd95bd83f8c4a6142e96aa1fb2b37fa55fa0b2d863f340cb0d6ed3c509388b6","game.css":"837d6972fdde1abf0fcab28312ba699ae8f0e4c85157781df0c55f6538da89fc","game.js":"066c9f750703df79a6be91fec9869819d51afe12a6a6d975eebf626b1068cc40"};
const protectedFiles=['src/game-engine.mjs','app-server.mjs','index.html'];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const fail=m=>{console.error('PEPE GAME V6.8 UPDATE: FAIL · '+m);process.exit(1)};

if(!fs.existsSync(app))fail('run from /home/runner/workspace; memeflow-app not found');
if(path.basename(here)!=='pepe-game-v6.8')fail('package folder must be pepe-game-v6.8');
for(const f of files)if(!fs.existsSync(path.join(payload,f)))fail('package payload missing '+f);
if(JSON.stringify(fs.readdirSync(payload).sort())!==JSON.stringify([...files].sort()))fail('payload must contain visual files only');
for(const f of files)if(sha(path.join(payload,f))!==newHashes[f])fail('package hash mismatch for '+f);
for(const f of protectedFiles)if(!fs.existsSync(path.join(app,f)))fail('protected MEMEFLOW file missing: '+f);
const protectedBefore=Object.fromEntries(protectedFiles.map(f=>[f,sha(path.join(app,f))]));
execFileSync(process.execPath,['--check',path.join(payload,'game.js')],{stdio:'inherit'});
const current=Object.fromEntries(files.map(f=>[f,fs.existsSync(path.join(app,f))?sha(path.join(app,f)):null]));
if(files.every(f=>current[f]===newHashes[f])){console.log('Pepe Rocket V6.8 already installed; no files rewritten.');console.log('Trading/server files were not touched.');process.exit(0);}
for(const f of files)if(current[f]!==oldHashes[f])fail('unexpected current '+f+'; expected V6.7. Refusing to stack/conflict visual layers.');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=path.join(app,'.memeflow-patches','pepe-game-v68',stamp);fs.mkdirSync(backup,{recursive:true});
for(const f of files)fs.copyFileSync(path.join(app,f),path.join(backup,f));
fs.writeFileSync(path.join(backup,'protected-hashes.json'),JSON.stringify(protectedBefore,null,2));
for(const f of files)fs.copyFileSync(path.join(payload,f),path.join(app,f));
for(const f of files)if(sha(path.join(app,f))!==newHashes[f])fail('post-write hash mismatch '+f);
for(const f of protectedFiles)if(sha(path.join(app,f))!==protectedBefore[f])fail('protected MEMEFLOW file changed unexpectedly: '+f);
const latest=path.join(app,'.memeflow-patches','pepe-game-v68','latest.json');fs.writeFileSync(latest,JSON.stringify({backup,installedAt:Date.now(),oldHashes,newHashes,protectedBefore},null,2));
console.log('Pepe Rocket V6.8 installed in place.');
console.log('Changed: game.html, game.css, game.js only');
console.log('Protected trading/server files: unchanged');
console.log('Backup:',backup);
