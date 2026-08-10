#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root=process.cwd();
const appDir=[path.join(root,'memeflow-app'),root,path.join(root,'artifacts','memeflow')]
 .find(p=>fs.existsSync(path.join(p,'index.html')));
if(!appDir){console.error('V50 rollback: project not found.');process.exit(1)}

const backup=path.join(appDir,'.memeflow-v50-backup');
const indexBackup=path.join(backup,'index.html');
const v49Backup=path.join(backup,'native-ai-sheet-v49.js');

if(!fs.existsSync(indexBackup)||!fs.existsSync(v49Backup)){
  console.error('V50 rollback backup missing. Nothing changed.');
  process.exit(1);
}

fs.copyFileSync(indexBackup,path.join(appDir,'index.html'));
fs.copyFileSync(v49Backup,path.join(appDir,'native-ai-sheet-v49.js'));
const v50=path.join(appDir,'native-ai-sheet-v50.js');
if(fs.existsSync(v50))fs.unlinkSync(v50);

console.log('V50 ROLLBACK OK: exact V49 frontend restored.');
console.log('No server was started.');
