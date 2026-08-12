#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const app = path.join(root, 'memeflow-app');

const srcRig = path.join(app, 'character-real-rig-v14.js');
const srcTest = path.join(app, 'character-real-test-v14.js');
const srcHtml = path.join(app, 'character-real-test-v14.html');

const dstRig = path.join(app, 'character-real-rig-v15.js');
const dstTest = path.join(app, 'character-real-test-v15.js');
const dstHtml = path.join(app, 'character-real-test-v15.html');

function die(msg) {
  console.error('\nERROR:', msg);
  process.exit(1);
}

for (const f of [srcRig, srcTest, srcHtml]) {
  if (!fs.existsSync(f)) die(`Missing ${path.relative(root, f)}. Run this patch from ~/workspace after V14 exists.`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(app, '.pepe-rig-backups', `v15-${stamp}`);
fs.mkdirSync(backupDir, { recursive: true });
for (const f of [srcRig, srcTest, srcHtml]) {
  fs.copyFileSync(f, path.join(backupDir, path.basename(f)));
}

function replaceFunctionBody(source, functionName, newBody) {
  const token = `function ${functionName}(`;
  const start = source.indexOf(token);
  if (start < 0) die(`Could not find ${functionName}() in V14 rig`);

  const open = source.indexOf('{', start);
  if (open < 0) die(`Could not find opening brace for ${functionName}()`);

  let depth = 0, close = -1;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) { close = i; break; }
    }
  }
  if (close < 0) die(`Could not find closing brace for ${functionName}()`);

  return source.slice(0, open + 1) + '\n' + newBody.trim() + '\n  ' + source.slice(close);
}

let rig = fs.readFileSync(srcRig, 'utf8');

// Rename only the V14 factory/version references in the copied file.
rig = rig.replaceAll('createPepeSkeletonV14', 'createPepeSkeletonV15');
rig = rig.replaceAll('REAL RIG V14', 'REAL RIG V15');
rig = rig.replaceAll('Real Rig V14', 'Real Rig V15');

// Strong front-arm pose. Works with the joints known from V14 and
// progressively uses elbow/forearm/hand joints if V14 exposes them.
const frontArmBody = String.raw`
    const frontNode = (node, z, order) => {
      if (!node) return;
      node.position.z = z;

      if (typeof node.traverse === 'function') {
        node.traverse((obj) => {
          if (!(obj?.isMesh || obj?.isSprite)) return;
          obj.renderOrder = order;

          const mats = Array.isArray(obj.material)
            ? obj.material
            : (obj.material ? [obj.material] : []);

          for (const mat of mats) {
            // V15 arms must visually cross IN FRONT of torso.
            mat.depthTest = false;
            mat.depthWrite = false;
            mat.transparent = true;
            mat.needsUpdate = true;
          }
        });
      }
    };

    // Shoulders move across the chest rather than disappearing behind torso.
    shoulderLeft.rotation.z = 0.86;
    shoulderRight.rotation.z = -0.86;

    // Bring the arms slightly toward camera.
    frontNode(shoulderLeft, 0.22, 40);
    frontNode(shoulderRight, 0.23, 41);

    // If segmented elbow joints already exist, bend them inward.
    if (joints?.elbowLeft) {
      joints.elbowLeft.rotation.z = -1.02;
      frontNode(joints.elbowLeft, 0.30, 44);
    }
    if (joints?.elbowRight) {
      joints.elbowRight.rotation.z = 1.02;
      frontNode(joints.elbowRight, 0.31, 45);
    }

    if (joints?.forearmLeft) frontNode(joints.forearmLeft, 0.34, 46);
    if (joints?.forearmRight) frontNode(joints.forearmRight, 0.35, 47);

    // Keep hands upright and clearly in front.
    wristLeft.rotation.z = -0.72;
    wristRight.rotation.z = 0.72;
    frontNode(wristLeft, 0.40, 50);
    frontNode(wristRight, 0.41, 51);

    if (joints?.handLeft) frontNode(joints.handLeft, 0.46, 54);
    if (joints?.handRight) frontNode(joints.handRight, 0.47, 55);
`;

rig = replaceFunctionBody(rig, 'lockFrontArmPose', frontArmBody);

// Give test/debug code something explicit to identify.
if (!rig.includes('PEPE_RIG_VERSION')) {
  const insertAt = rig.indexOf('\n');
  rig = rig.slice(0, insertAt + 1)
      + `\nexport const PEPE_RIG_VERSION = 'V15-front-arms';\n`
      + rig.slice(insertAt + 1);
}

fs.writeFileSync(dstRig, rig);

// Copy test JS and point it at V15.
let test = fs.readFileSync(srcTest, 'utf8');
test = test.replaceAll('character-real-rig-v14.js', 'character-real-rig-v15.js');
test = test.replaceAll('createPepeSkeletonV14', 'createPepeSkeletonV15');
test = test.replaceAll('V14', 'V15');
test = test.replaceAll('v14', 'v15');
test = test.replaceAll('joint-cross-1401', 'front-arms-1501');
fs.writeFileSync(dstTest, test);

// Copy HTML and point it at V15.
let html = fs.readFileSync(srcHtml, 'utf8');
html = html.replaceAll('character-real-test-v14.js', 'character-real-test-v15.js');
html = html.replaceAll('character-real-rig-v14.js', 'character-real-rig-v15.js');
html = html.replaceAll('V14', 'V15');
html = html.replaceAll('v14', 'v15');
html = html.replaceAll('ARMS FORWARD', 'REAL FRONT ARMS');
html = html.replaceAll('refresh=1401', 'refresh=1501');
fs.writeFileSync(dstHtml, html);

// Static checks.
const checks = [
  ['V15 rig created', fs.existsSync(dstRig)],
  ['V15 test JS created', fs.existsSync(dstTest)],
  ['V15 HTML created', fs.existsSync(dstHtml)],
  ['factory renamed', rig.includes('createPepeSkeletonV15')],
  ['front arm depth active', rig.includes('mat.depthTest = false')],
  ['shoulders brought forward', rig.includes('frontNode(shoulderLeft')],
  ['wrists brought forward', rig.includes('frontNode(wristLeft')],
];

console.log('\n===== PEPE REAL RIG V15 PATCH =====');
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK' : 'FAIL'}: ${label}`);
  if (!ok) process.exitCode = 1;
}

console.log(`\nBackup: ${path.relative(root, backupDir)}`);
console.log('\nV15 READY:');
console.log('/character-real-test-v15.html?refresh=1501');
