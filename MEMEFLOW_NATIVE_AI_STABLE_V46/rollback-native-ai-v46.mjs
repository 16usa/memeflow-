#!/usr/bin/env node
import fs from 'fs';import path from 'path';
const root=process.cwd();
const appDir=[path.join(root,'memeflow-app'),root,path.join(root,'artifacts','memeflow')].find(p=>fs.existsSync(path.join(p,'index.html'))&&fs.existsSync(path.join(p,'app-server.mjs')));
if(!appDir){console.error('V46 rollback: project not found.');process.exit(1)}
for(const name of ['index.html','app-server.mjs','package.json']){
  const p=path.join(appDir,name),b=p+'.pre-v46.bak';
  if(fs.existsSync(b))fs.copyFileSync(b,p);
}
const front=path.join(appDir,'native-ai-sheet-v46.js');if(fs.existsSync(front))fs.unlinkSync(front);
console.log('V46 ROLLBACK OK.');
