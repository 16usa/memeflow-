import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const cwd = process.cwd();
const appDir = fs.existsSync(path.join(cwd,'memeflow-app'))
  ? path.join(cwd,'memeflow-app')
  : cwd;
const serverPath = path.join(appDir,'app-server.mjs');
const s = fs.readFileSync(serverPath,'utf8');

assert(s.includes('MEMEFLOW_V12_5_1_FIRST_HOLDER_DELAY_FIX'));
console.log('PASS: V12.5.1 marker present');

assert(s.includes("HOLDER_INITIAL_DELAY_MS=Number(process.env.HOLDER_INITIAL_DELAY_MS||750)"));
console.log('PASS: first holder delay default = 750 ms');

assert(!s.includes("HOLDER_INITIAL_DELAY_MS=Number(process.env.HOLDER_INITIAL_DELAY_MS||8000)"));
console.log('PASS: old 8000 ms default removed');

assert(s.includes("HOLDER_RETRY_DELAY_MS=Number(process.env.HOLDER_RETRY_DELAY_MS||30000)"));
console.log('PASS: retry delay still = 30000 ms');

assert(s.includes("HOLDER_MAX_RETRIES=Number(process.env.HOLDER_MAX_RETRIES||8)"));
console.log('PASS: max retries still = 8');

assert(s.includes("HOLDER_RPC_MAX_CONCURRENCY||1"));
console.log('PASS: holder RPC concurrency protection unchanged');

assert(s.includes("initialDelayMs:HOLDER_INITIAL_DELAY_MS"));
assert(s.includes("retryDelayMs:HOLDER_RETRY_DELAY_MS"));
assert(s.includes("maxRetries:HOLDER_MAX_RETRIES"));
console.log('PASS: makeHolderQueue wiring intact');

assert(s.includes('MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT'));
console.log('PASS: V12.4 fast Phase-A preserved');

const check = spawnSync(process.execPath,['--check',serverPath],{encoding:'utf8'});
assert.equal(check.status,0,check.stderr || check.stdout);
console.log('PASS: app-server.mjs syntax-valid');

console.log('');
console.log('ALL V12.5.1 SELF-TESTS PASSED');
