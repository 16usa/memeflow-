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
if (!target) { console.error('ABORT: app-server.mjs not found'); process.exit(1); }

let src = fs.readFileSync(target, 'utf8');
const MARKER = 'MEMEFLOW_V12_12_HOLDER_ADMISSION_FIX';
if (src.includes(MARKER)) { console.log('PASS: V12.12 already installed'); process.exit(0); }

function findFunctionBlock(source, name) {
  const re = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`, 'm');
  const m = re.exec(source);
  if (!m) return null;
  const start = m.index;
  const open = source.indexOf('{', start);
  let depth = 0, quote = null, esc = false, line = false, block = false;
  for (let i = open; i < source.length; i++) {
    const ch = source[i], nx = source[i+1];
    if (line) { if (ch === '\n') line = false; continue; }
    if (block) { if (ch === '*' && nx === '/') { block = false; i++; } continue; }
    if (quote) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && nx === '/') { line = true; i++; continue; }
    if (ch === '/' && nx === '*') { block = true; i++; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { start, end:i+1, text:source.slice(start,i+1) };
    }
  }
  return null;
}

const block = findFunctionBlock(src, 'holderAdmissionForActiveUsers');
if (!block) { console.error('ABORT: holderAdmissionForActiveUsers() not found'); process.exit(2); }

let fn = block.text;
const patterns = [
  /const\s+s\s*=\s*store\.settings\s*\(\s*uid\s*\)\s*\|\|\s*\{\s*\}\s*;/,
  /const\s+s\s*=\s*store\.settings\s*\(\s*uid\s*\)\s*\?\?\s*\{\s*\}\s*;/
];
let matched = null;
for (const p of patterns) { if (p.test(fn)) { matched = p; break; } }
if (!matched) {
  console.error('ABORT: expected settings anchor not found inside holderAdmissionForActiveUsers()');
  process.exit(3);
}

const repl = `/* ${MARKER}
 * Admission-only settings view: minBuyPressure must not block holder enrichment.
 * The stored user setting remains unchanged and evaluateAll() still enforces it.
 */
const __holderAdmissionSettings = store.settings(uid) || {};
const s = {...__holderAdmissionSettings, minBuyPressure: null};`;

fn = fn.replace(matched, repl);
const patched = src.slice(0, block.start) + fn + src.slice(block.end);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = `${target}.before-v12-12-holder-admission-${stamp}`;
fs.copyFileSync(target, backup);
fs.writeFileSync(target, patched, 'utf8');

const check = spawnSync(process.execPath, ['--check', target], { encoding:'utf8' });
if (check.status !== 0) {
  fs.copyFileSync(backup, target);
  console.error('ABORT: syntax check failed; backup restored');
  console.error(check.stderr || check.stdout);
  process.exit(4);
}

const verify = fs.readFileSync(target,'utf8');
if (!verify.includes(MARKER) || !verify.includes('minBuyPressure: null')) {
  fs.copyFileSync(backup, target);
  console.error('ABORT: verification failed; backup restored');
  process.exit(5);
}

console.log('PASS: MEMEFLOW V12.12 HOLDER ADMISSION FIX installed');
console.log('Target:', target);
console.log('Backup:', backup);
console.log('Next: restart MEMEFLOW with npm start');
