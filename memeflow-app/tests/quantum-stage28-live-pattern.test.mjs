import assert from 'node:assert/strict';
import {createStage28PatternTracker} from '../src/quantum-stage28-live-pattern.mjs';
import {createStage24Capture} from '../src/quantum-stage24-capture.mjs';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const t=createStage28PatternTracker({maxMints:2});let now=Date.now();
let p=t.observe('mint',{priceSol:1,lastPriceAt:now-120000},now);
assert.equal(p.ready,false);
for(let i=0;i<8;i++)p=t.observe('mint',{priceSol:1+i*.03,lastPriceAt:now-110000+i*12000},now);
assert.equal(p.ready,true);assert.equal(p.direction,'BULLISH');assert.equal(p.probability,null);
const before=p.observations;
p=t.observe('mint',{priceSol:1.21,lastPriceAt:now-110000+7*12000},now);
assert.equal(p.observations,before);
t.observe('other',{priceSol:1,lastPriceAt:now},now);t.observe('third',{priceSol:1,lastPriceAt:now},now);
assert.equal(t.status().trackedMints,2);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'s28-'));
try{
 const capture=createStage24Capture({dataDir:dir,enabled:true});
 for(let i=0;i<8;i++)capture.observe({mint:'a',token:{priceSol:1+i*.03,lastPriceAt:now-110000+i*12000},decision:{state:'WATCH',score:60}});
 const rows=fs.readFileSync(path.join(dir,'quantum-stage24-decisions.ndjson'),'utf8').trim().split('\n').map(JSON.parse);
 assert.equal(rows.at(-1).observedPattern.ready,true);
 assert.equal(rows.at(-1).observedPattern.direction,'BULLISH');
 assert.equal(rows.at(-1).quantumVerified,false);
 assert.equal(rows.at(-1).quantumPattern,null);
 assert.equal(rows.at(-1).source,'STORE_SET_DECISION_SHADOW');
 assert.equal(capture.status().trading,false);
}finally{fs.rmSync(dir,{recursive:true,force:true})}
console.log('Stage 28 tests passed (10 assertions); runtime integration requires manual restart; no predictive accuracy validated.');
