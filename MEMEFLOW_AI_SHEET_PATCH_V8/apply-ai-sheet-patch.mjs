#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename=fileURLToPath(import.meta.url), __dirname=path.dirname(__filename), root=process.cwd();
const candidates=[path.join(root,'memeflow-app','index.html'),path.join(root,'index.html'),path.join(root,'artifacts','memeflow','index.html')];
const target=candidates.find(p=>fs.existsSync(p));
if(!target){console.error('MEMEFLOW patch: index.html not found');process.exit(1)}
const targetDir=path.dirname(target);
fs.copyFileSync(path.join(__dirname,'ai-sheet-v8.js'),path.join(targetDir,'ai-sheet-v8.js'));
let html=fs.readFileSync(target,'utf8');
const tag='<script src="./ai-sheet-v8.js?v=8.0.0" defer></script>';
html=html.replace(/<script\s+src=["']\.\/ai-sheet-v8\.js(?:\?v=[^"']*)?["']\s+defer><\/script>/ig,'');
if(!/<\/body>/i.test(html)){console.error('MEMEFLOW patch: </body> not found');process.exit(1)}
html=html.replace(/<\/body>/i,tag+'\n</body>');
fs.writeFileSync(target,html,'utf8');
console.log(`MEMEFLOW AI sheet patch v8 installed in: ${path.relative(root,target)}`);
console.log('Keeps v7 button placement; upgrades the opened AI window to a real mobile sheet.');
console.log('Script tag: ai-sheet-v8.js?v=8.0.0');
