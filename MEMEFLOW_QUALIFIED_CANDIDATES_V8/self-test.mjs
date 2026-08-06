import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const modulePath=path.join(appDir,'src','candidate-visibility.mjs');
const server=path.join(appDir,'app-server.mjs');
const index=path.join(appDir,'index.html');

const mod=await import(pathToFileURL(modulePath).href+'?v='+Date.now());
const {classifyDecisionVisibility,candidateFeed,candidateVisibilityCounts}=mod;

const rows=[
 {mint:'GOOD',state:'BUY READY',score:90,confidence:90},
 {mint:'WAIT',state:'WAITING',primaryReason:'holder data pending'},
 {mint:'LOW_SCORE',state:'WATCH',score:60,confidence:90},
 {mint:'HOLDERS_FAIL',state:'BLOCKED',primaryReason:'Holders 37 below minimum 100'},
 {mint:'OLD',state:'EXPIRED',terminal:true}
];

assert.equal(classifyDecisionVisibility(rows[0]),'candidate');
assert.equal(classifyDecisionVisibility(rows[1]),'processing');
assert.equal(classifyDecisionVisibility(rows[2]),'filtered');
assert.equal(classifyDecisionVisibility(rows[3]),'filtered');
assert.equal(classifyDecisionVisibility(rows[4]),'filtered');
console.log('PASS: decision visibility classification');

assert.deepEqual(candidateFeed(rows).map(x=>x.mint),['GOOD']);
console.log('PASS: default Candidates feed contains BUY READY only');

assert.deepEqual(candidateFeed(rows,'processing').map(x=>x.mint),['WAIT']);
console.log('PASS: incomplete WAITING tokens stay in backend processing only');

assert.deepEqual(candidateFeed(rows,'filtered').map(x=>x.mint),['LOW_SCORE','HOLDERS_FAIL','OLD']);
console.log('PASS: failed/non-qualified tokens remain available for diagnostics');

assert.equal(candidateFeed(rows,'all').length,5);
console.log('PASS: audit scope preserves every evaluated decision');

const counts=candidateVisibilityCounts(rows);
assert.deepEqual(counts,{candidates:1,processing:1,filtered:3,totalEvaluated:5});
console.log('PASS: candidate/processing/filtered counts are correct');

const serverText=fs.readFileSync(server,'utf8');
assert(serverText.includes("url.searchParams.get('scope')||'candidates'"));
assert(serverText.includes('candidateFeed(_all,_scope)'));
assert(serverText.includes('candidateVisibilityCounts(_all)'));
assert(serverText.includes("candidateFeed(store.decisions(u.id),'candidates')"));
console.log('PASS: server endpoint and chart use qualified-candidate policy');

const indexText=fs.readFileSync(index,'utf8');
assert(indexText.includes('/api/ai/decisions?scope=candidates&limit=50'));
assert(indexText.includes("return stateName==='BUY READY'"));
assert(indexText.includes('No qualified candidates yet.'));
console.log('PASS: desktop/mobile Candidates UI requests and enforces qualified-only feed');

for(const f of [modulePath,server]){
 const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr||r.stdout);
}
console.log('PASS: server-side JavaScript syntax checks');

console.log('');
console.log('ALL V8 SELF-TESTS PASSED');
