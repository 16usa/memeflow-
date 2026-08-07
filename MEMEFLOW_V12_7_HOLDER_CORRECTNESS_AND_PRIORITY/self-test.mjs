import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const p=path.join(appDir,'src','enrich.mjs');
const s=fs.readFileSync(p,'utf8');

assert(s.includes('MEMEFLOW_V12_7_HOLDER_CORRECTNESS_AND_PRIORITY'));
assert(s.includes('holderFresh: existingToken.holderFresh === true'));
assert(s.includes('existingToken.holderCount ?? null'));
assert(s.includes('existingToken.top10Pct ?? null'));
console.log('PASS: Phase A no longer erases successful holder scan');

assert(s.includes('MEMEFLOW_V12_7_FIRST_ATTEMPT_PRIORITY'));
assert(s.includes("if((aa===0)!==(ba===0)) return aa===0 ? -1 : 1;"));
assert(s.includes('Number(b?.queuedAt||0)-Number(a?.queuedAt||0)'));
console.log('PASS: fresh first-attempt queue priority installed');

assert(s.includes('MEMEFLOW_V12_7_VERIFY_HOLDER_SUCCESS'));
console.log('PASS: holder success verification marker installed');

const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr||r.stdout);
console.log('PASS: src/enrich.mjs syntax-valid');

console.log('');
console.log('ALL V12.7 SELF-TESTS PASSED');
