import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createStage24Capture} from '../src/quantum-stage24-capture.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-s24-'));
try{
 const off=createStage24Capture({dataDir:dir});assert.equal(off.observe({mint:'x',decision:{state:'WATCH'}}),false);
 assert.equal(fs.existsSync(path.join(dir,'quantum-stage24-decisions.ndjson')),false);
 const on=createStage24Capture({dataDir:dir,enabled:true});
 assert.equal(on.observe({mint:'x',token:{priceSol:0.1,lastPriceAt:123},decision:{state:'WATCH',score:42}}),true);
 const e=JSON.parse(fs.readFileSync(path.join(dir,'quantum-stage24-decisions.ndjson'),'utf8').trim());
 assert.equal(e.priceSol,0.1);assert.equal(e.score,42);assert.equal(e.quantumScore,null);assert.equal(e.quantumVerified,false);assert.equal(e.state,'WATCH');assert.equal(on.status().trading,false);
 console.log('Stage 24 capture offline tests passed (8 assertions); NOT live validated.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
