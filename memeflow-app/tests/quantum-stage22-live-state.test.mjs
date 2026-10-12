import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {snapshotEvents,sample} from '../scripts/quantum-stage22-live-state.mjs';
const mint='11111111111111111111111111111111';
const state={tokens:{[mint]:{mint,priceSol:0.00001}},decisions:{x:{mint,status:'BUY READY',quantumScore:77,quantumRisk:12,quantumDecision:'WAITING'}}};
const e=snapshotEvents(state,{timestamp:100000});assert.equal(e.prices.length,1);assert.equal(e.predictions.length,1);assert.equal(e.predictions[0].decision,'BUY_READY');assert.equal(e.predictions[0].quantumDecision,'WAITING');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mf22-'));try{const stateFile=path.join(dir,'state.json');const directory=path.join(dir,'out');fs.writeFileSync(stateFile,JSON.stringify(state));let r=sample({stateFile,directory,timestamp:100000});assert.equal(r.newPredictions,1);r=sample({stateFile,directory,timestamp:130000});assert.equal(r.newPredictions,0);assert.equal(r.prices,1);assert.equal(r.trading,false);const rows=fs.readFileSync(path.join(directory,'events.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert.equal(rows.filter(x=>x.type==='prediction').length,1);assert.equal(rows.filter(x=>x.type==='price').length,2)}finally{fs.rmSync(dir,{recursive:true,force:true})}
console.log('Stage 22 read-only local state adapter tests passed (9 assertions). NOT live validated.');
