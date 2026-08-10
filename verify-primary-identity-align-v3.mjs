import fs from 'node:fs';
import path from 'node:path';
const START='<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V3_START -->';
const SKIP=new Set(['.git','node_modules','.cache','.next','dist','build','coverage','.old-replit-components']);
function walk(d,o=[]){let es=[];try{es=fs.readdirSync(d,{withFileTypes:true})}catch{return o}for(const e of es){if(SKIP.has(e.name)||/backup|before-|\.bak$/i.test(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p,o);else if(e.isFile()&&/\.html?$/i.test(e.name))o.push(p)}return o}
const rows=[];
for(const f of walk(process.cwd())){let s='';try{s=fs.readFileSync(f,'utf8')}catch{continue}if(s.includes('id="primary-candidate"')&&s.includes('id="primaryScore"'))rows.push({file:path.relative(process.cwd(),f),v3:s.includes(START),v2:s.includes('MF_PATCH_PRIMARY_IDENTITY_ALIGN_V2_START'),old:s.includes('MF_PATCH_PRIMARY_AVATAR_SCORE_HEIGHT_START')})}
if(!rows.length){console.error('No Primary Candidate HTML found.');process.exit(1)}
for(const r of rows)console.log(`${r.v3?'OK':'MISSING'}  ${r.file}  V3=${r.v3?'YES':'NO'}  oldV2=${r.v2?'YES':'NO'}  oldAvatar=${r.old?'YES':'NO'}`);
if(rows.some(r=>!r.v3)){process.exitCode=2}
