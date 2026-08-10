#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root=process.cwd();
const appDir=[
  path.join(root,'memeflow-app'),root,path.join(root,'artifacts','memeflow')
].find(p=>fs.existsSync(path.join(p,'index.html'))&&fs.existsSync(path.join(p,'app-server.mjs')));

if(!appDir){console.error('V48 rollback: project not found.');process.exit(1)}

const backup=path.join(appDir,'.memeflow-v48-backup');
const indexBackup=path.join(backup,'index.html');
const serverBackup=path.join(backup,'app-server.mjs');

if(!fs.existsSync(indexBackup)||!fs.existsSync(serverBackup)){
  console.error('V48 rollback: exact pre-V48 backup is missing. Nothing changed.');
  process.exit(1);
}

fs.copyFileSync(indexBackup,path.join(appDir,'index.html'));
fs.copyFileSync(serverBackup,path.join(appDir,'app-server.mjs'));

const savedV47=path.join(backup,'native-ai-sheet-v47.js');
const liveV47=path.join(appDir,'native-ai-sheet-v47.js');
if(fs.existsSync(savedV47)) fs.copyFileSync(savedV47,liveV47);

const liveV48=path.join(appDir,'native-ai-sheet-v48.js');
if(fs.existsSync(liveV48)) fs.unlinkSync(liveV48);

console.log('V48 ROLLBACK OK.');
console.log('Exact pre-V48 index.html and app-server.mjs restored.');
console.log('No server was started.');
