import fs from 'node:fs';
const p='memeflow-app/index.html';
if(!fs.existsSync(p)){console.error('NOT FOUND: '+p);process.exit(1)}
const s=fs.readFileSync(p,'utf8');
const yes=x=>s.includes(x)?'YES':'NO';
console.log(`OK  ${p}  V5=${yes('MF_PATCH_PRIMARY_IDENTITY_ALIGN_V5_START')}  V4=${yes('MF_PATCH_PRIMARY_IDENTITY_ALIGN_V4_START')}  V3=${yes('MF_PATCH_PRIMARY_IDENTITY_ALIGN_V3_START')}  V2=${yes('MF_PATCH_PRIMARY_IDENTITY_ALIGN_V2_START')}`);
if(!s.includes('MF_PATCH_PRIMARY_IDENTITY_ALIGN_V5_START'))process.exit(2);
