import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const server=path.join(appDir,'app-server.mjs');
const s=fs.readFileSync(server,'utf8');

assert(s.includes('MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT'));
assert(s.includes('function fastPhaseAStart(mint,curve)'));
console.log('PASS: fast Phase-A bootstrap installed');

const fastFn=s.indexOf('function fastPhaseAStart(mint,curve)');
const priceIn=s.indexOf('ensurePriceTimer(mint,curve||token.curve)',fastFn);
const holderIn=s.indexOf('holderQueue.enqueue(mint)',fastFn);
const evalIn=s.indexOf('evaluateAll(token)',fastFn);
assert(priceIn>fastFn && holderIn>fastFn && evalIn>fastFn);
console.log('PASS: price + holder + initial evaluation are in fast Phase-A');

const enrichFn=s.indexOf('async function enrich(mint,curve)');
const fastCall=s.indexOf('fastPhaseAStart(mint,curve)',enrichFn);
const heavyCall=s.indexOf('await enrichToken(mint,curve',enrichFn);
assert(fastCall>enrichFn && heavyCall>fastCall);
console.log('PASS: fast Phase-A precedes slow full enrichment');

const discovery=s.indexOf('fastPhaseAStart(result.mint,result.curve)');
const background=s.indexOf('void enrich(result.mint,result.curve)',discovery);
assert(discovery>=0 && background>discovery);
console.log('PASS: discovery bootstraps before background enrich scheduling');

assert(s.includes('fullEnrichBackgroundStarted'));
assert(s.includes('fullEnrichBackgroundSucceeded'));
assert(s.includes('fullEnrichBackgroundFailed'));
console.log('PASS: background full-enrich metrics installed');

const r=spawnSync(process.execPath,['--check',server],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr||r.stdout);
console.log('PASS: app-server.mjs syntax-valid');

console.log('');
console.log('ALL V12.4 SELF-TESTS PASSED');
