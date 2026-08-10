#!/usr/bin/env node
import fs from 'fs';import path from 'path';
const root=process.cwd();
const appDir=[path.join(root,'memeflow-app'),root,path.join(root,'artifacts','memeflow')].find(p=>fs.existsSync(path.join(p,'index.html'))&&fs.existsSync(path.join(p,'app-server.mjs')));
if(!appDir){console.error('V47 rollback: project not found.');process.exit(1)}
const index=path.join(appDir,'index.html'),old46=path.join(appDir,'native-ai-sheet-v46.js'),new47=path.join(appDir,'native-ai-sheet-v47.js');
if(fs.existsSync(index+'.pre-v47.bak'))fs.copyFileSync(index+'.pre-v47.bak',index);
if(fs.existsSync(old46+'.pre-v47.bak'))fs.copyFileSync(old46+'.pre-v47.bak',old46);
if(fs.existsSync(new47))fs.unlinkSync(new47);
console.log('V47 ROLLBACK OK.');
