import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createStage24Capture,extractQuantumShadow} from '../src/quantum-stage24-capture.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf-s25-'));
try{
 const observer=createStage24Capture({dataDir:dir,enabled:true});
 const shadow={analysisVersion:'MEMEFLOW_QUANTUM_V1',scoreAuthority:'quantum-decision-engine',state:'WAITING',quantum:{score:72,risk:21,pattern:{ready:false,probability:null,confidence:null}}};
 assert.equal(extractQuantumShadow({quantumShadow:shadow})?.q.score,72);
 assert.equal(extractQuantumShadow({quantumShadow:{...shadow,scoreAuthority:'fake'}}),null);
 const d={state:'WATCH',score:64,quantumShadow:shadow};
 assert.equal(observer.observe({mint:'mint1',token:{priceSol:0.001,lastPriceAt:123},decision:d}),true);
 assert.equal(d.state,'WATCH');assert.equal(d.score,64);
 const p=path.join(dir,'quantum-stage24-decisions.ndjson');
 const e=JSON.parse(fs.readFileSync(p,'utf8').trim());
 assert.equal(e.version,25);assert.equal(e.quantumScore,72);assert.equal(e.quantumRisk,21);
 assert.equal(e.quantumState,'WAITING');assert.equal(e.quantumEvidenceAvailable,true);
 assert.equal(e.quantumVerified,false);assert.equal(e.state,'WATCH');assert.equal(e.priceAt,123);
 assert.equal(observer.status().trading,false);
 assert.equal(observer.observe({mint:'mint2',decision:{state:'BLOCKED'}}),true);
 const e2=JSON.parse(fs.readFileSync(p,'utf8').trim().split('\n')[1]);
 assert.equal(e2.quantumScore,null);assert.equal(e2.quantumEvidenceAvailable,false);
 console.log('Stage 25 offline shadow tests passed (16 assertions). No live authority validation.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
