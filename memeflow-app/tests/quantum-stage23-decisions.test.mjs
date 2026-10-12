import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {convertDecision,ingestDecisions} from '../scripts/quantum-stage23-decisions.mjs';
const now=Date.now();const mint='So11111111111111111111111111111111111111112';
const d={mint,timestamp:now,priceSol:0.001,priceAt:now,decision:'WAITING',quantumDecision:'BUY_READY',quantumScore:78,quantumRisk:21,quantumPattern:'MOMENTUM',quantumAuthorityVerified:true};
assert.equal(convertDecision(d,{now}).type,'prediction');
for(const patch of [{quantumAuthorityVerified:false},{priceAt:now-120000},{priceSol:null},{quantumScore:null},{quantumDecision:null},{timestamp:now-2*86400000},{quantumPattern:null}])assert.throws(()=>convertDecision({...d,...patch},{now}));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf23-'));
try{const a=ingestDecisions([d],{directory:dir,now});assert.equal(a.added,1);assert.equal(a.quantumAuthorityVerified,true);const b=ingestDecisions([d],{directory:dir,now});assert.equal(b.duplicates,1);assert.equal(fs.readFileSync(path.join(dir,'events.jsonl'),'utf8').trim().split('\n').length,1)}finally{fs.rmSync(dir,{recursive:true,force:true})}
console.log('Stage 23 tests passed (11 assertions); NO live decision capture or authority validation.');
