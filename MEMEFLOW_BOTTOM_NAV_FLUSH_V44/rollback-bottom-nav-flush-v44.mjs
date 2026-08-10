#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root=process.cwd();
const target=[
  path.join(root,'memeflow-app','index.html'),
  path.join(root,'index.html'),
  path.join(root,'artifacts','memeflow','index.html')
].find(p=>fs.existsSync(p));

if(!target){
  console.error('V44 rollback: index not found');
  process.exit(1);
}

const appDir=path.dirname(target);
const backup=target+'.pre-bottom-nav-v44.bak';

if(!fs.existsSync(backup)){
  console.error('V44 rollback: backup missing');
  process.exit(1);
}

fs.copyFileSync(backup,target);

const p=path.join(appDir,'bottom-nav-flush-v44.js');
if(fs.existsSync(p)) fs.unlinkSync(p);

console.log('V44 ROLLBACK OK');
