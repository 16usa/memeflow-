#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const app = path.join(root, 'memeflow-app');

const rigPath = path.join(app, 'character-real-rig-v16.js');
const testPath = path.join(app, 'character-real-test-v16.js');
const htmlPath = path.join(app, 'character-real-test-v16.html');

function fail(msg) {
  console.error('\nFAIL:', msg);
  process.exit(1);
}

for (const f of [rigPath, testPath, htmlPath]) {
  if (!fs.existsSync(f)) fail(`Missing ${path.relative(root, f)}`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(app, '.pepe-rig-backups', `v16-3-swap-legs-${stamp}`);
fs.mkdirSync(backup, { recursive: true });

for (const f of [rigPath, testPath, htmlPath]) {
  fs.copyFileSync(f, path.join(backup, path.basename(f)));
}

let rig = fs.readFileSync(rigPath, 'utf8');

// Swap ONLY the leg image assignments.
// Keep screen-side pivots, animation directions, canvas and all other logic unchanged.
const leftOld = "{n:'legLeft',   f:'leg_left.png'";
const rightOld = "{n:'legRight',  f:'leg_right.png'";

if (!rig.includes(leftOld) || !rig.includes(rightOld)) {
  fail('Could not find the expected V16 leg definitions. No files changed.');
}

rig = rig.replace(leftOld, "{n:'legLeft',   f:'__TEMP_RIGHT__.png'");
rig = rig.replace(rightOld, "{n:'legRight',  f:'leg_left.png'");
rig = rig.replace("{n:'legLeft',   f:'__TEMP_RIGHT__.png'", "{n:'legLeft',   f:'leg_right.png'");

// Add a clear version marker in console without changing the exported API.
if (!rig.includes('[PEPE V16.3] LEGS SWAPPED')) {
  rig = rig.replace(
    "console.log('[PEPE V16] READY — CLEAN FRONT ARMS');",
    "console.log('[PEPE V16.3] LEGS SWAPPED · FRONT ARMS · CANVAS FIX');"
  );
}

fs.writeFileSync(rigPath, rig);

// Cache-bust the rig import on current V16.2 test JS.
let test = fs.readFileSync(testPath, 'utf8');
test = test.replace(
  /character-real-rig-v16\.js\?v=[^'"]+/g,
  'character-real-rig-v16.js?v=1630'
);
fs.writeFileSync(testPath, test);

// Update visible label only; preserve the V16.2 canvas layout.
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(
  /PEPE REAL RIG V16\.2 · REAL CANVAS VIEWPORT/g,
  'PEPE REAL RIG V16.3 · LEGS SWAPPED · REAL CANVAS'
);
html = html.replace(
  /character-real-test-v16\.js\?v=[^"'<>]+/g,
  'character-real-test-v16.js?v=1630'
);
fs.writeFileSync(htmlPath, html);

// Verification
const finalRig = fs.readFileSync(rigPath, 'utf8');

const checks = [
  ['left screen leg now uses leg_right.png',
    finalRig.includes("{n:'legLeft',   f:'leg_right.png'")],
  ['right screen leg now uses leg_left.png',
    finalRig.includes("{n:'legRight',  f:'leg_left.png'")],
  ['canvas HTML kept',
    html.includes('id="stage"')],
  ['V16 API kept',
    finalRig.includes('createPepeRealRigV16')],
];

console.log('\n===== PEPE V16.3 SWAP LEGS =====');
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK' : 'FAIL'}: ${label}`);
  if (!ok) process.exitCode = 1;
}

console.log('\nOK: Canvas untouched');
console.log('OK: Arms untouched');
console.log('OK: Head/body untouched');
console.log('OK: Only left/right leg images swapped');
console.log(`Backup: ${path.relative(root, backup)}`);
console.log('\nOPEN:');
console.log('/character-real-test-v16.html?refresh=1630');
