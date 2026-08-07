import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const server=path.join(appDir,'app-server.mjs');
const s=fs.readFileSync(server,'utf8');

assert(s.includes("diagnosticVersion:'V10.1-fast'"));
assert(s.includes("store?._uidDec?.get?.(u.id)?.get?.(mint)"));
assert(!s.includes("const decision=store.decisions(u.id).find(d=>d.mint===mint)||null;"));

const r=spawnSync(process.execPath,['--check',server],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr||r.stdout);

console.log('PASS: V10.1 marker present');
console.log('PASS: expensive decisions scan removed');
console.log('PASS: app-server.mjs syntax-valid');
console.log('');
console.log('ALL V10.1 SELF-TESTS PASSED');
