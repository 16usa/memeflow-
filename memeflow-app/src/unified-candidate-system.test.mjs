import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('unified candidate integration is installed',()=>{
 assert.match(page,/MEMEFLOW_UNIFIED_CANDIDATE_SYSTEM_V1/);
 assert.match(page,/memeflow:statechange/);
 assert.match(page,/decisionTree/);
 assert.match(page,/executionReadinessCount/);
 assert.match(page,/marketChart/);
});
test('readiness uses nine real gates',()=>{
 for(const gate of ['Candidate selected','AI BUY READY','Verified price','Fresh holder evidence','Route approved','Risk approved','Fresh quote','Wallet connected','Balance approved']){
   assert.ok(page.includes(gate),gate+' missing');
 }
});
test('hardcoded fake readiness is overridden',()=>{
 assert.match(page,/passed===gates\.length/);
 assert.match(page,/passed\+' \/ '\+gates\.length\+' checks'/);
});
