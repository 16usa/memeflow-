import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const target = path.resolve('memeflow-app/src/enrich.mjs');
if (!fs.existsSync(target)) {
  console.error('ABORT: memeflow-app/src/enrich.mjs not found. Run from ~/workspace.');
  process.exit(1);
}

let s = fs.readFileSync(target, 'utf8');
const marker = 'MEMEFLOW_V12_16_1_HOLDER_THROUGHPUT_SAFE_FIX';

if (s.includes(marker)) {
  console.log('PASS: MEMEFLOW V12.16.1 already installed');
  process.exit(0);
}

if (!/holder worker timeout after|workerTimeoutMs|HOLDER_WORKER_TIMEOUT/i.test(s)) {
  console.error('ABORT: V12.15.x holder worker timeout protection not detected.');
  process.exit(2);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = target + `.before-v12-16-1-${stamp}`;
fs.copyFileSync(target, backup);

let changed = 0;

// Adaptive: match old and newer V12.15.x formatting of maxConcurrent.
const patterns = [
  /const\s+maxConcurrent\s*=\s*Math\.max\(\s*1\s*,\s*Number\(\s*config\?\.\s*maxConcurrent\s*\?\?\s*([^)]+)\)\s*\)\s*;/,
  /const\s+maxConcurrent\s*=\s*Math\.max\(\s*1\s*,\s*Number\(\s*config\?\.maxConcurrent\s*\?\?\s*([^)]+)\)\s*\)\s*;/,
  /const\s+maxConcurrent\s*=\s*Number\(\s*config\?\.\s*maxConcurrent\s*\?\?\s*([^)]+)\)\s*;/,
  /let\s+maxConcurrent\s*=\s*Math\.max\(\s*1\s*,\s*Number\(\s*config\?\.\s*maxConcurrent\s*\?\?\s*([^)]+)\)\s*\)\s*;/
];

let matched = false;
for (const re of patterns) {
  if (re.test(s)) {
    s = s.replace(re,
`/* ${marker}
   Raise holder worker capacity to a safe minimum of 4.
   Existing timeout/watchdog/retry/backoff logic is intentionally untouched. */
  const maxConcurrent=Math.max(4,Number(config?.maxConcurrent??4));`);
    matched = true;
    changed++;
    break;
  }
}

if (!matched) {
  console.error('ABORT: could not find maxConcurrent declaration in current V12.15.x enrich.mjs.');
  console.error('No file was changed.');
  fs.copyFileSync(backup, target);
  process.exit(3);
}

// Add lightweight diagnostic marker near makeHolderQueue return without depending on active Set/Map shape.
if (/inspect\(mint\)\s*\{/.test(s) && !/throughputFixVersion/.test(s)) {
  s = s.replace(/inspect\(mint\)\s*\{\s*\n?/, m => m +
`      const throughputFixVersion='V12.16.1';
`);
  // Inject fields into the returned inspect object if queueRetries exists.
  s = s.replace(
    /(queueRetries\s*:\s*p\?\.retries\s*\?\?\s*row\?\.retries\s*\?\?\s*0)(\s*[,\n}])/,
    `$1,\n        throughputFixVersion,\n        configuredMaxConcurrent:maxConcurrent$2`
  );
}

// Write and syntax-check. Roll back automatically on failure.
fs.writeFileSync(target, s);
const check = spawnSync(process.execPath, ['--check', target], {encoding:'utf8'});
if (check.status !== 0) {
  fs.copyFileSync(backup, target);
  console.error('ABORT: node --check failed; backup restored.');
  console.error(check.stderr || check.stdout);
  process.exit(4);
}

console.log('PASS: MEMEFLOW V12.16.1 HOLDER THROUGHPUT SAFE FIX installed');
console.log('Target:', target);
console.log('Backup:', backup);
console.log('Change: holder maxConcurrent now has a safe minimum of 4');
console.log('Preserved: worker timeout/watchdog, retries, backoff, admission, holder logic');
