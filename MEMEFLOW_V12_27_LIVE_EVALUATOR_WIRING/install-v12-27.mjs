#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const target = path.join(cwd, 'memeflow-app', 'app-server.mjs');

if (!fs.existsSync(target)) {
  console.error('ABORT: memeflow-app/app-server.mjs not found from current directory.');
  process.exit(1);
}

const original = fs.readFileSync(target, 'utf8');
const backup = `${target}.before-v12-27-${new Date().toISOString().replace(/[:.]/g,'-')}`;
fs.writeFileSync(backup, original);

const oldForms = [
  "evaluateAI: typeof evaluateAI==='function'?evaluateAI:null",
  "evaluateAI:typeof evaluateAI==='function'?evaluateAI:null",
  "evaluateAI: typeof evaluateAI === 'function' ? evaluateAI : null",
  "evaluateAI:typeof evaluateAI === 'function' ? evaluateAI : null"
];

let found = null;
for (const s of oldForms) {
  if (original.includes(s)) { found = s; break; }
}

if (!found) {
  console.error('ABORT: Exact live-feed evaluateAI wiring was not found. No changes made.');
  console.error('Backup created at:', backup);
  process.exit(2);
}

if (!/const\s+evaluateAll\s*=\s*makeEvaluateForActiveUsers\s*\(/.test(original)) {
  console.error('ABORT: evaluateAll = makeEvaluateForActiveUsers(...) was not found. No changes made.');
  console.error('Backup created at:', backup);
  process.exit(3);
}

const replacement = found.replace(
  /typeof\s+evaluateAI\s*===\s*'function'\s*\?\s*evaluateAI\s*:\s*null/,
  "typeof evaluateAll==='function'?evaluateAll:null"
).replace(
  /typeof\s+evaluateAI\s*===\s*"function"\s*\?\s*evaluateAI\s*:\s*null/,
  "typeof evaluateAll==='function'?evaluateAll:null"
);

const updated = original.replace(found, replacement);

if (updated === original) {
  console.error('ABORT: Replacement produced no change.');
  process.exit(4);
}

fs.writeFileSync(target, updated);

console.log('PASS: V12.27 live evaluator wiring installed');
console.log('Changed only startPumpLiveTradeFeed evaluateAI callback: evaluateAI -> evaluateAll');
console.log('Trading thresholds/evaluate.mjs/liveeval.mjs/paper-engine/execution were NOT modified.');
console.log('Backup:', backup);
console.log('Next: node MEMEFLOW_V12_27_LIVE_EVALUATOR_WIRING/self-test-v12-27.mjs');
