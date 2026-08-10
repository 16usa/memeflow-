#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const root=process.cwd();
const candidates=[path.join(root,'memeflow-app','index.html'),path.join(root,'index.html'),path.join(root,'artifacts','memeflow','index.html')];
const target=candidates.find(p=>fs.existsSync(p));
if(!target){console.error('MEMEFLOW patch: index.html not found');process.exit(1)}
const targetDir=path.dirname(target);
fs.copyFileSync(path.join(__dirname,'ai-manual-scan-sheet-patch.js'),path.join(targetDir,'ai-manual-scan-sheet-patch.js'));
let html=fs.readFileSync(target,'utf8');
html=html.replace(/<script\s+src=["']\.\/ai-bottom-nav-patch\.js(?:\?v=[^"']*)?["']\s+defer><\/script>/ig,'');
html=html.replace(/<script\s+src=["']\.\/ai-manual-scan-sheet-patch\.js(?:\?v=[^"']*)?["']\s+defer><\/script>/ig,'');
const tag='<script src="./ai-manual-scan-sheet-patch.js?v=6.0.0" defer></script>';
if(!/<\/body>/i.test(html)){console.error('MEMEFLOW patch: </body> not found');process.exit(1)}
html=html.replace(/<\/body>/i,`${tag}\n</body>`);
fs.writeFileSync(target,html,'utf8');
console.log(`MEMEFLOW manual-AI patch v6 installed in: ${path.relative(root,target)}`);
console.log('Script tag: ai-manual-scan-sheet-patch.js?v=6.0.0');
