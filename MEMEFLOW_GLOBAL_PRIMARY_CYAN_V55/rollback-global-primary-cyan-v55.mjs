#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root=process.cwd();
const appDir=[
  path.join(root,'memeflow-app'),
  root,
  path.join(root,'artifacts','memeflow')
].find(p=>fs.existsSync(path.join(p,'index.html')));

if(!appDir){console.error('V55 rollback: project not found.');process.exit(1)}

const backup=path.join(appDir,'.memeflow-v55-backup','index.html');
if(!fs.existsSync(backup)){
  console.error('V55 rollback backup missing. Nothing changed.');
  process.exit(1);
}

fs.copyFileSync(backup,path.join(appDir,'index.html'));
try{fs.unlinkSync(path.join(appDir,'global-primary-cyan-v55.js'))}catch{}

console.log('V55 ROLLBACK OK: exact pre-V55 index restored.');
console.log('Refresh the browser after rollback.');
