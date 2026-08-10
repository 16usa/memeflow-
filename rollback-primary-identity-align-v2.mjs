import fs from 'node:fs';
import path from 'node:path';
const START='<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V2_START -->';
const END='<!-- MF_PATCH_PRIMARY_IDENTITY_ALIGN_V2_END -->';
const explicit=process.argv[2];
const candidates=explicit?[path.resolve(explicit)]:[path.resolve('memeflow-app/index.html'),path.resolve('index.html')];
const target=candidates.find(fs.existsSync);
if(!target){console.error('ERROR: index.html not found');process.exit(1)}
let html=fs.readFileSync(target,'utf8');
let changed=false;
for(;;){const a=html.indexOf(START);if(a<0)break;const b=html.indexOf(END,a+START.length);if(b<0)break;html=html.slice(0,a)+html.slice(b+END.length);changed=true}
if(changed)fs.writeFileSync(target,html,'utf8');
console.log(changed?'Primary Identity Align V2 removed.':'Patch not found; nothing changed.');
