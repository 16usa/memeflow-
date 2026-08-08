#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const candidates = [
  path.join(process.cwd(), 'memeflow-app', 'app-server.mjs'),
  path.join(process.cwd(), 'app-server.mjs'),
  '/workspace/memeflow-app/app-server.mjs'
];
const target = candidates.find(p => fs.existsSync(p));
if (!target) { console.error('FAIL: app-server.mjs not found'); process.exit(1); }

const s = fs.readFileSync(target,'utf8');
const checks = [
  ['marker', s.includes('MEMEFLOW_V12_12_HOLDER_ADMISSION_FIX')],
  ['admission function', s.includes('holderAdmissionForActiveUsers')],
  ['admission-only clone', s.includes('__holderAdmissionSettings')],
  ['pressure disabled only in admission clone', s.includes('minBuyPressure: null')]
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failed = true;
}
const syntax = spawnSync(process.execPath, ['--check', target], { encoding:'utf8' });
console.log(`${syntax.status === 0 ? 'PASS' : 'FAIL'}: node --check`);
if (syntax.status !== 0) failed = true;
process.exit(failed ? 2 : 0);
