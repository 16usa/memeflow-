#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const patchDir=path.dirname(fileURLToPath(import.meta.url)),root=process.cwd();
const appDir=[path.join(root,'memeflow-app'),root,path.join(root,'artifacts','memeflow')].find(p=>fs.existsSync(path.join(p,'index.html')));
if(!appDir){console.error('V58: MEMEFLOW project not found.');process.exit(1)}
const indexPath=path.join(appDir,'index.html'),serverPath=[path.join(appDir,'app-server.mjs'),path.join(appDir,'server.mjs')].find(fs.existsSync);
if(!serverPath){console.error('V58: app-server.mjs/server.mjs not found.');process.exit(1)}
const backupDir=path.join(appDir,'.memeflow-v58-backup'),backupIndex=path.join(backupDir,'index.html'),backupServer=path.join(backupDir,path.basename(serverPath));
let html=fs.readFileSync(indexPath,'utf8'),server=fs.readFileSync(serverPath,'utf8');
const pre=[['MEMEFLOW index',/MEMEFLOW/i.test(html)],['OpenAI sheet',/MEMEFLOW OpenAI/i.test(html)],['evaluate',/\bevaluate\b/.test(server)],['validPubkey',/\bvalidPubkey\b/.test(server)],['rpcUrls',/\brpcUrls\b/.test(server)],['handler',/async function handler\s*\(req,res\)/.test(server)],['auth anchor',/if\s*\(!u\)\s*return json\(res,401,[^;]+;/.test(server)]];
console.log('=== V58 PRECHECK ===');for(const[n,o]of pre)console.log(`${o?'PASS':'FAIL'}  ${n}`);if(pre.some(([,o])=>!o)){console.error('V58: precheck failed. Nothing changed.');process.exit(1)}
if(!fs.existsSync(backupDir)){fs.mkdirSync(backupDir,{recursive:true});fs.copyFileSync(indexPath,backupIndex);fs.copyFileSync(serverPath,backupServer)}
html=html.replace(/\s*<script\b[^>]*src=["'][^"']*openai-token-info-v58\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig,'\n');
server=server.replace(/\/\* === MEMEFLOW OPENAI TOKEN INFO V58 START === \*\/[\s\S]*?\/\* === MEMEFLOW OPENAI TOKEN INFO V58 END === \*\//g,'').replace(/\/\* === MEMEFLOW OPENAI TOKEN INFO V58 ROUTE START === \*\/[\s\S]*?\/\* === MEMEFLOW OPENAI TOKEN INFO V58 ROUTE END === \*\//g,'');
const helper=fs.readFileSync(path.join(patchDir,'server-helper-v58.txt'),'utf8'),route=fs.readFileSync(path.join(patchDir,'server-route-v58.txt'),'utf8');
server=server.replace(/async function handler\s*\(req,res\)\s*\{/,helper+'\nasync function handler(req,res){');
const authRe=/if\s*\(!u\)\s*return json\(res,401,[^;]+;/,m=server.match(authRe);if(!m){console.error('V58: auth anchor disappeared. Nothing written.');process.exit(1)}server=server.replace(authRe,m[0]+'\n'+route);
html=html.replace(/<\/body>/i,'<script src="./openai-token-info-v58.js?v=58.0.0" defer></script>\n</body>');
fs.writeFileSync(indexPath,html);fs.writeFileSync(serverPath,server);fs.copyFileSync(path.join(patchDir,'openai-token-info-v58.js'),path.join(appDir,'openai-token-info-v58.js'));
const oh=fs.readFileSync(indexPath,'utf8'),os=fs.readFileSync(serverPath,'utf8');const checks=[['frontend tag once',(oh.match(/openai-token-info-v58\.js\?v=58\.0\.0/g)||[]).length===1],['helper once',(os.match(/MEMEFLOW OPENAI TOKEN INFO V58 START/g)||[]).length===1],['route once',(os.match(/MEMEFLOW OPENAI TOKEN INFO V58 ROUTE START/g)||[]).length===1],['endpoint',os.includes('/api/openai/token-scan-v58')],['runtime',fs.existsSync(path.join(appDir,'openai-token-info-v58.js'))],['index backup',fs.existsSync(backupIndex)],['server backup',fs.existsSync(backupServer)]];
console.log('=== V58 INSTALL CHECK ===');for(const[n,o]of checks)console.log(`${o?'PASS':'FAIL'}  ${n}`);if(checks.some(([,o])=>!o)){fs.copyFileSync(backupIndex,indexPath);fs.copyFileSync(backupServer,serverPath);try{fs.unlinkSync(path.join(appDir,'openai-token-info-v58.js'))}catch{}console.error('V58 FAILED. Exact pre-V58 files restored.');process.exit(1)}
console.log('V58 INSTALL OK: 7/7');console.log('No CSS/color files changed. Server was NOT started.');
