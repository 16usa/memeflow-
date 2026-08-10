#!/usr/bin/env node
import fs from 'fs';import path from 'path';
const root=process.cwd();
const target=[path.join(root,'memeflow-app','index.html'),path.join(root,'index.html'),path.join(root,'artifacts','memeflow','index.html')].find(p=>fs.existsSync(p));
if(!target){console.error('V39 rollback: index.html not found.');process.exit(1)}
const appDir=path.dirname(target), backup=target+'.pre-ai-icon-v39.bak';
if(!fs.existsSync(backup)){console.error('V39 rollback: backup not found.');process.exit(1)}
fs.copyFileSync(backup,target);
const p=path.join(appDir,'ai-icon-center-v39.js'); if(fs.existsSync(p)) fs.unlinkSync(p);
console.log('V39 ROLLBACK OK.');
