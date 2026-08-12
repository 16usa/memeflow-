#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const app = path.join(cwd, 'memeflow-app');

const v14Rig  = path.join(app, 'character-real-rig-v14.js');
const v14Test = path.join(app, 'character-real-test-v14.js');
const v14Html = path.join(app, 'character-real-test-v14.html');

const v15Rig  = path.join(app, 'character-real-rig-v15.js');
const v15Test = path.join(app, 'character-real-test-v15.js');
const v15Html = path.join(app, 'character-real-test-v15.html');

function fail(msg) {
  console.error('\nFAIL:', msg);
  process.exit(1);
}

for (const f of [v14Rig, v14Test, v14Html]) {
  if (!fs.existsSync(f)) fail(`Missing ${path.relative(cwd, f)}`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(app, '.pepe-rig-backups', `v15-fix-${stamp}`);
fs.mkdirSync(backup, { recursive: true });

for (const f of [v14Rig, v14Test, v14Html]) {
  fs.copyFileSync(f, path.join(backup, path.basename(f)));
}

// ---- 1) Build V15 from CLEAN, KNOWN-WORKING V14 ----
let rig = fs.readFileSync(v14Rig, 'utf8');

// Only rename the exported factory. No arbitrary "V14" global replacement.
rig = rig.replace(/\bcreatePepeSkeletonV14\b/g, 'createPepeSkeletonV15');

if (!rig.includes('createPepeSkeletonV15')) {
  fail('Could not rename createPepeSkeletonV14 -> createPepeSkeletonV15');
}

// Find lockFrontArmPose and inject only safe statements BEFORE its closing brace.
// We retain all original V14 logic.
function injectBeforeFunctionClose(source, fnName, injection) {
  const token = `function ${fnName}(`;
  const start = source.indexOf(token);
  if (start < 0) fail(`Could not find ${fnName}() in V14`);

  const open = source.indexOf('{', start);
  if (open < 0) fail(`No opening brace for ${fnName}()`);

  let depth = 0;
  let close = -1;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = open; i < source.length; i++) {
    const c = source[i];
    const n = source[i + 1];

    if (lineComment) {
      if (c === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (c === '*' && n === '/') { blockComment = false; i++; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }

    if (c === '/' && n === '/') { lineComment = true; i++; continue; }
    if (c === '/' && n === '*') { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }

    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth === 0) { close = i; break; }
    }
  }

  if (close < 0) fail(`Could not locate end of ${fnName}()`);

  return source.slice(0, close) + '\n' + injection + '\n' + source.slice(close);
}

const injection = String.raw`
  // ===== V15 FRONT-ARM VISUAL OVERRIDE =====
  // Keep the proven V14 pose math, but force the arm branches
  // to render in front of the torso rather than disappearing behind it.
  const __v15BringForward = (node, z, order) => {
    if (!node) return;

    if (node.position) node.position.z = z;

    if (typeof node.traverse === 'function') {
      node.traverse((obj) => {
        if (!obj) return;

        if (obj.isMesh || obj.isSprite) {
          obj.renderOrder = order;

          const materials = Array.isArray(obj.material)
            ? obj.material
            : (obj.material ? [obj.material] : []);

          for (const material of materials) {
            if (!material) continue;
            material.depthTest = false;
            material.depthWrite = false;
            material.needsUpdate = true;
          }
        }
      });
    }
  };

  __v15BringForward(shoulderLeft,  0.18, 40);
  __v15BringForward(shoulderRight, 0.19, 41);
  __v15BringForward(wristLeft,     0.30, 50);
  __v15BringForward(wristRight,    0.31, 51);
  // ===== /V15 FRONT-ARM VISUAL OVERRIDE =====
`;

rig = injectBeforeFunctionClose(rig, 'lockFrontArmPose', injection);
fs.writeFileSync(v15Rig, rig);

// ---- 2) Test JS: exact two substitutions only ----
let test = fs.readFileSync(v14Test, 'utf8');
test = test
  .replace(/character-real-rig-v14\.js[^'"]*/g, 'character-real-rig-v15.js?v=front-arms-1502')
  .replace(/\bcreatePepeSkeletonV14\b/g, 'createPepeSkeletonV15');

if (!test.includes('createPepeSkeletonV15')) {
  fail('V15 test does not reference createPepeSkeletonV15');
}

fs.writeFileSync(v15Test, test);

// ---- 3) Test HTML: use V14 page unchanged except the module URL ----
let html = fs.readFileSync(v14Html, 'utf8');
html = html.replace(
  /character-real-test-v14\.js[^"'<>]*/g,
  'character-real-test-v15.js?v=front-arms-1502'
);

// Add a visible V15 marker without touching layout structure.
html = html.replace(
  '</body>',
  `<div style="position:fixed;left:10px;bottom:10px;z-index:99999;
  padding:6px 9px;border:1px solid #1d6b56;border-radius:8px;
  background:#03100d;color:#7fffc8;font:700 10px system-ui">
  V15 FRONT ARMS FIX 1502
  </div></body>`
);

fs.writeFileSync(v15Html, html);

// ---- 4) Syntax checks BEFORE user opens the page ----
for (const f of [v15Rig, v15Test]) {
  const check = spawnSync(process.execPath, ['--check', f], {
    cwd,
    encoding: 'utf8'
  });

  if (check.status !== 0) {
    console.error(check.stderr || check.stdout);
    fail(`Syntax check failed: ${path.relative(cwd, f)}`);
  }
}

// ---- 5) Verify imports/markers ----
const checks = [
  ['V15 rig exists', fs.existsSync(v15Rig)],
  ['V15 test exists', fs.existsSync(v15Test)],
  ['V15 HTML exists', fs.existsSync(v15Html)],
  ['factory V15 exists', rig.includes('createPepeSkeletonV15')],
  ['V14 factory removed from V15 rig', !rig.includes('createPepeSkeletonV14')],
  ['front-arm override injected', rig.includes('V15 FRONT-ARM VISUAL OVERRIDE')],
  ['test imports V15 rig', test.includes('character-real-rig-v15.js')],
];

console.log('\n===== V15 FIX 1502 =====');
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK' : 'FAIL'}: ${name}`);
  if (!ok) process.exitCode = 1;
}

console.log('\nOK: JavaScript syntax check passed');
console.log('OK: V14 was NOT modified');
console.log(`Backup: ${path.relative(cwd, backup)}`);
console.log('\nOPEN THIS EXACT PAGE:');
console.log('/character-real-test-v15.html?refresh=1502');
