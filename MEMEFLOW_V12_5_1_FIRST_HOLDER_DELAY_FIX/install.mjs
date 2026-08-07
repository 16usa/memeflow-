import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd = process.cwd();
const appDir = fs.existsSync(path.join(cwd,'memeflow-app'))
  ? path.join(cwd,'memeflow-app')
  : cwd;

const serverPath = path.join(appDir,'app-server.mjs');

if (!fs.existsSync(serverPath)) {
  console.error('ABORT: missing ' + serverPath);
  process.exit(1);
}

let s = fs.readFileSync(serverPath,'utf8');

if (!s.includes('MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT')) {
  console.error('ABORT: V12.4 marker missing. Refusing to patch an unknown version.');
  process.exit(1);
}

const exactOld =
  "HOLDER_INITIAL_DELAY_MS=Number(process.env.HOLDER_INITIAL_DELAY_MS||8000)";
const exactNew =
  "HOLDER_INITIAL_DELAY_MS=Number(process.env.HOLDER_INITIAL_DELAY_MS||750)";

if (s.includes('MEMEFLOW_V12_5_1_FIRST_HOLDER_DELAY_FIX')) {
  console.log('V12.5.1 already installed.');
} else {
  if (!s.includes(exactOld)) {
    console.error('ABORT: exact current HOLDER_INITIAL_DELAY_MS=8000 anchor not found.');
    console.error('No files were modified.');
    process.exit(1);
  }

  if (!s.includes("HOLDER_RETRY_DELAY_MS=Number(process.env.HOLDER_RETRY_DELAY_MS||30000)")) {
    console.error('ABORT: expected retry-delay anchor (30000 ms) not found.');
    console.error('No files were modified.');
    process.exit(1);
  }

  if (!s.includes("initialDelayMs:HOLDER_INITIAL_DELAY_MS")) {
    console.error('ABORT: makeHolderQueue initialDelayMs wiring not found.');
    console.error('No files were modified.');
    process.exit(1);
  }

  const backup = serverPath + '.before-v12-5-1-first-holder-delay';
  if (!fs.existsSync(backup)) fs.copyFileSync(serverPath, backup);

  s = s.replace(exactOld, exactNew);

  const marker = `
// MEMEFLOW_V12_5_1_FIRST_HOLDER_DELAY_FIX
// Only the FIRST holder-queue delay default is reduced: 8000ms -> 750ms.
// Retry delay (30000ms), max retries, queue concurrency and rate-limit protections remain unchanged.
`;
  const anchor = "const holderQueue=makeHolderQueue(";
  const pos = s.indexOf(anchor);
  if (pos < 0) {
    console.error('ABORT: holderQueue construction anchor missing.');
    process.exit(1);
  }
  s = s.slice(0,pos) + marker + s.slice(pos);

  fs.writeFileSync(serverPath,s,'utf8');
}

const check = spawnSync(process.execPath,['--check',serverPath],{encoding:'utf8'});
if (check.status !== 0) {
  console.error(check.stderr || check.stdout);
  process.exit(check.status || 1);
}

console.log('PASS: app-server.mjs syntax-valid');
console.log('PASS: first holder delay default is 750 ms');
console.log('PASS: retry delay remains 30000 ms');
console.log('PASS: holder queue wiring remains intact');
console.log('V12.5.1 INSTALLED');
