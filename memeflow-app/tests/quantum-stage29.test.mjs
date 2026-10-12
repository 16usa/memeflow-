import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {inspectStage29Decision} from '../src/quantum-stage29-decision.mjs';
import {createStage24Capture} from '../src/quantum-stage24-capture.mjs';
const p={ready:true,validated:false,direction:'BULLISH'};
assert.equal(inspectStage29Decision({score:80,risk:10,observedPattern:p}).state,'CANDIDATE');
assert.equal(inspectStage29Decision({score:80,risk:10,observedPattern:{...p,direction:'BEARISH'}}).state,'BLOCKED');
assert.equal(inspectStage29Decision({score:80,risk:80,observedPattern:p}).state,'BLOCKED');
assert.equal(inspectStage29Decision({score:40,risk:10,observedPattern:p}).state,'WATCH');
assert.equal(inspectStage29Decision({score:null,risk:10,observedPattern:p}).state,'WAITING');
assert.equal(inspectStage29Decision({score:80,risk:10,observedPattern:{...p,validated:true}}).state,'WAITING');
assert.equal(inspectStage29Decision({score:80,risk:10,observedPattern:p}).executionAllowed,false);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'s29-'));
try{
 const capture=createStage24Capture({dataDir:dir,enabled:true,limitBytes:850});
 for(let i=0;i<15;i++)assert.equal(capture.observe({mint:'test',token:{priceSol:1,lastPriceAt:Date.now()+i},decision:{state:'WATCH',score:50,quantum:{score:80,risk:10}}}),true);
 assert.ok(capture.status().rotations>0);
 const archive=path.join(dir,'quantum-archive');assert.ok(fs.readdirSync(archive).length>0);
 const all=[...fs.readdirSync(archive).map(f=>fs.readFileSync(path.join(archive,f),'utf8')),fs.readFileSync(path.join(dir,'quantum-stage24-decisions.ndjson'),'utf8')].join('');
 assert.equal(all.trim().split('\n').length,15);
 const record=JSON.parse(all.trim().split('\n')[0]);assert.equal(record.stage29ShadowDecision.executionAllowed,false);
 assert.equal(record.stage29ShadowDecision.state,'WAITING');
 console.log('Stage 29 tests passed (12 assertions); observational only; no trading validation.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
