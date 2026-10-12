import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('memeflow-app/app-server.mjs','utf8');
assert.match(s,/MEMEFLOW_QUANTUM_STAGE8_ADMISSION_ISOLATION/);
assert.match(s,/const eligible=quantumAnalysisMode \|\| admission\?\.admitted===true;/);
assert.match(s,/!quantumAnalysisMode &&\s+eligible &&/);
assert.match(s,/MEMEFLOW_QUANTUM_MODE\|\|'SHADOW'\)\.trim\(\)\.toUpperCase\(\)!=='ENFORCE' && admission\?\.admitted!==true/);
console.log('Stage 8 static isolation assertions passed (not live-trading validation)');
