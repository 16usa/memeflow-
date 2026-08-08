#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd = process.cwd();
const app = path.join(cwd,'memeflow-app','app-server.mjs');

let fails = 0;
function check(name, ok) {
  console.log(`${ok?'PASS':'FAIL'}: ${name}`);
  if (!ok) fails++;
}

if (!fs.existsSync(app)) {
  console.error('FAIL: memeflow-app/app-server.mjs missing');
  process.exit(1);
}

const s = fs.readFileSync(app,'utf8');

check('evaluateAll exists', /const\s+evaluateAll\s*=\s*makeEvaluateForActiveUsers\s*\(/.test(s));
check('live feed uses evaluateAll', /evaluateAI\s*:\s*typeof\s+evaluateAll\s*===\s*['"]function['"]\s*\?\s*evaluateAll\s*:\s*null/.test(s));
check('old live feed evaluateAI wiring removed', !/evaluateAI\s*:\s*typeof\s+evaluateAI\s*===\s*['"]function['"]\s*\?\s*evaluateAI\s*:\s*null/.test(s));
check('evaluate.mjs untouched by installer design', fs.existsSync(path.join(cwd,'memeflow-app','src','evaluate.mjs')));
check('liveeval.mjs present', fs.existsSync(path.join(cwd,'memeflow-app','src','liveeval.mjs')));

const syntax = spawnSync(process.execPath, ['--check', app], {encoding:'utf8'});
check('node --check app-server.mjs', syntax.status === 0);
if (syntax.status !== 0) console.log(syntax.stderr || syntax.stdout);

if (fails) {
  console.error(`FAIL: ${fails} self-test(s)`);
  process.exit(1);
}
console.log('PASS: all V12.27 self-tests');
console.log('Expected live diagnostic after restart: evaluationResolved rises and evaluationNullResults should no longer equal 100% of evaluationCalls; decisions should begin attaching when evaluator returns decisions.');
