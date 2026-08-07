import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const server=path.join(appDir,'app-server.mjs');
const s=fs.readFileSync(server,'utf8');

assert(s.includes('MEMEFLOW_V12_DISCOVERY_ENRICHMENT_BRIDGE'));
assert(s.includes('async function bridgeRepairToken'));
assert(s.includes('await enrich(mint,curve)'));
console.log('PASS: raw Pump token full-enrichment rescue installed');

assert(s.includes('holderQueue.enqueue(mint)'));
assert(s.includes('!priceTimers.has(mint)'));
assert(s.includes('ensurePriceTimer(mint,curve)'));
console.log('PASS: holder queue + price lifecycle rescue installed');

assert(s.includes('BRIDGE_MAX_FULL_ATTEMPTS'));
assert(s.includes('BRIDGE_HOLDER_RETRY_MS'));
assert(s.includes('for(const token of rows)await bridgeRepairToken(token,now)'));
console.log('PASS: bounded serial backpressure installed');

assert(s.includes('await evaluateAll(store.state.tokens[mint]||token)'));
console.log('PASS: missing decision rescue installed');

const r=spawnSync(process.execPath,['--check',server],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr||r.stdout);
console.log('PASS: app-server.mjs syntax-valid');

console.log('');
console.log('ALL V12 SELF-TESTS PASSED');
