import fs from 'node:fs';
import path from 'node:path';
const START='<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V3_START -->';
const END='<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V3_END -->';
const SKIP=new Set(['.git','node_modules','.cache','.next','dist','build','coverage','.old-replit-components']);
function strip(s){for(;;){const a=s.indexOf(START);if(a<0)return s;const b=s.indexOf(END,a+START.length);if(b<0)return s;s=s.slice(0,a)+s.slice(b+END.length)}}
function walk(d,o=[]){let es=[];try{es=fs.readdirSync(d,{withFileTypes:true})}catch{return o}for(const e of es){if(SKIP.has(e.name)||/backup|before-|\.bak$/i.test(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p,o);else if(e.isFile()&&/\.html?$/i.test(e.name))o.push(p)}return o}
const explicit=process.argv.slice(2).filter(Boolean).map(path.resolve);
const files=explicit.length?explicit:walk(process.cwd());
let n=0;
for(const f of files){if(!fs.existsSync(f))continue;const before=fs.readFileSync(f,'utf8');const after=strip(before);if(after!==before){fs.writeFileSync(f,after,'utf8');n++;console.log('REMOVED: '+path.relative(process.cwd(),f))}}
console.log('V3 removed from '+n+' HTML file(s).');
