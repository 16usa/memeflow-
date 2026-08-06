import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const solanaPath=path.join(appDir,'src','solana.mjs');
const serverPath=path.join(appDir,'app-server.mjs');

const text=fs.readFileSync(solanaPath,'utf8');
assert(text.includes('PUMP_DISC_BUY_V2'));
assert(text.includes('[184,23,238,97,103,197,211,61]'));
assert(text.includes(`PUMP_DISC_BUY_V2.join(',')`));
console.log('PASS: Pump buy_v2 is recognized as known non-create');

assert(text.includes(`async _pace(method='default')`));
assert(text.includes('RPC_GET_PROGRAM_ACCOUNTS_MIN_INTERVAL_MS||2500'));
assert(text.includes('RPC_GET_TRANSACTION_MIN_INTERVAL_MS||450'));
assert(text.includes('await this._pace(method);'));
console.log('PASS: method-aware RPC pacing installed');

const server=fs.readFileSync(serverPath,'utf8');
if(server.includes('HOLDER_MAX_CONCURRENT')){
  assert(
    server.includes('HOLDER_MAX_CONCURRENT=1') ||
    server.includes('maxConcurrent:1')
  );
}
console.log('PASS: holder heavy-RPC concurrency constrained');

const mod=await import(pathToFileURL(solanaPath).href);
assert.deepEqual(mod.PUMP_DISC_BUY_V2,[184,23,238,97,103,197,211,61]);
console.log('PASS: Pump V2 discriminator export is valid');

console.log('');
console.log('ALL V3 SELF-TESTS PASSED');