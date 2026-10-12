import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {ingest,report,validateEvent} from '../scripts/quantum-stage21-monitor.mjs';
const mint='11111111111111111111111111111111',t=1700000000000;
const prediction={type:'prediction',mint,timestamp:t,price:1,decision:'BUY_READY',quantumDecision:'BUY_READY',quantumScore:75,quantumRisk:12,quantumPattern:'confirmed'};
const price={type:'price',mint,timestamp:t+5*60000,price:1.1};
const d=fs.mkdtempSync(path.join(os.tmpdir(),'mf-stage21-'));
try{
 assert.equal(ingest([prediction,price],{directory:d}).added,2);
 assert.equal(ingest([prediction,price],{directory:d}).duplicates,2);
 const events=fs.readFileSync(path.join(d,'events.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 const r=report(events,{feePct:2});assert.equal(r.horizons[0].quantum.count,1);assert.equal(r.horizons[0].baseline.count,1);assert.equal(r.horizons[0].quantum.meanNetPct,8);
 assert.equal(r.horizons[1].quantum.count,0);assert.equal(r.liveConnected,false);
 assert.throws(()=>validateEvent({...price,price:0}));assert.throws(()=>validateEvent({...prediction,decision:'SELL'}));
 console.log('Stage 21 offline monitor tests passed (7 assertions). No live validation.');
}finally{fs.rmSync(d,{recursive:true,force:true})}
