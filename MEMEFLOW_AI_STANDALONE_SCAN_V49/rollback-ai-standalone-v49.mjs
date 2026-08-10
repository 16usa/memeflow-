#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root=process.cwd();
const appDir=[path.join(root,'memeflow-app'),root,path.join(root,'artifacts','memeflow')]
 .find(p=>fs.existsSync(path.join(p,'index.html'))&&fs.existsSync(path.join(p,'app-server.mjs')));
if(!appDir){console.error('V49 rollback: project not found.');process.exit(1)}

const backup=path.join(appDir,'.memeflow-v49-backup');
const indexBackup=path.join(backup,'index.html');
const serverBackup=path.join(backup,'app-server.mjs');
const manifestPath=path.join(backup,'manifest.json');

if(!fs.existsSync(indexBackup)||!fs.existsSync(serverBackup)){
 console.error('V49 rollback: exact pre-V49 backup is missing. Nothing changed.');
 process.exit(1);
}

fs.copyFileSync(indexBackup,path.join(appDir,'index.html'));
fs.copyFileSync(serverBackup,path.join(appDir,'app-server.mjs'));

let manifest={aiFiles:[]};
try{manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'))}catch{}
for(const name of fs.readdirSync(appDir).filter(n=>/^native-ai-sheet-v\d+\.js$/i.test(n))){
 if(!manifest.aiFiles?.includes(name)){try{fs.unlinkSync(path.join(appDir,name))}catch{}}
}
for(const name of manifest.aiFiles||[]){
 const src=path.join(backup,name),dst=path.join(appDir,name);
 if(fs.existsSync(src))fs.copyFileSync(src,dst);
}

console.log('V49 ROLLBACK OK.');
console.log('Exact pre-V49 index.html, app-server.mjs and AI runtime set restored.');
console.log('No server was started.');
