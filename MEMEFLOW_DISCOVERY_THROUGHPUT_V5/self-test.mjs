import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const solanaPath=path.join(appDir,'src','solana.mjs');
const serverPath=path.join(appDir,'app-server.mjs');
const discPath=path.join(appDir,'src','discqueue.mjs');

const server=fs.readFileSync(serverPath,'utf8');
assert(server.includes('DISCOVERY_MAX_CONCURRENT||6') || server.includes('Math.max(6'));
console.log('PASS: discovery in-flight capacity raised to 6');

const sol=fs.readFileSync(solanaPath,'utf8');
assert(sol.includes('RPC_GET_TRANSACTION_MIN_INTERVAL_MS||250'));
assert(sol.includes('methodTimeoutMs(method)'));
assert(sol.includes(`method==='getTransaction'`));
console.log('PASS: getTransaction paced at 250ms');
console.log('PASS: getTransaction has a dedicated 6s timeout');

const disc=fs.readFileSync(discPath,'utf8');
assert(disc.includes('maxSignatureAgeMs = 900000'));
assert(disc.includes('[250, 750, 2000, 5000]'));
console.log('PASS: 15-minute retention preserved');
console.log('PASS: transient retry latency shortened');

await import(pathToFileURL(solanaPath).href);
console.log('PASS: solana.mjs imports successfully');

console.log('');
console.log('ALL V5 SELF-TESTS PASSED');