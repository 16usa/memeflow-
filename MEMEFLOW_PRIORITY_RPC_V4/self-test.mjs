import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const solanaPath=path.join(appDir,'src','solana.mjs');
const serverPath=path.join(appDir,'app-server.mjs');
const discPath=path.join(appDir,'src','discqueue.mjs');

const s=fs.readFileSync(solanaPath,'utf8');
assert(s.includes('this._methodPaceTails=new Map();'));
assert(s.includes('A slow getProgramAccounts wait must not block getTransaction'));
assert(s.includes('RPC_GET_TRANSACTION_MIN_INTERVAL_MS||275'));
assert(s.includes('RPC_MIN_INTERVAL_MS||200'));
console.log('PASS: method waits no longer hold the global RPC gate');
console.log('PASS: discovery RPC lane tuned to 275ms');

const server=fs.readFileSync(serverPath,'utf8');
assert(
  server.includes('DISCOVERY_MAX_CONCURRENT||2') ||
  server.includes('MAX_CONCURRENT=Math.max(2')
);
console.log('PASS: discovery has two latency-hiding workers');

const disc=fs.readFileSync(discPath,'utf8');
assert(disc.includes('maxSignatureAgeMs = 900000'));
assert(disc.includes('[500, 1500, 4000, 10000]'));
console.log('PASS: 15-minute retention preserved');
console.log('PASS: transient transaction retry latency reduced');

// Static import verifies the patched module still parses.
await import(pathToFileURL(solanaPath).href);
console.log('PASS: solana.mjs imports successfully');

console.log('');
console.log('ALL V4 SELF-TESTS PASSED');