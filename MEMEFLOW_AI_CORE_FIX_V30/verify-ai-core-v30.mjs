#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();

const target = [
  path.join(root, 'memeflow-app', 'index.html'),
  path.join(root, 'index.html'),
  path.join(root, 'artifacts', 'memeflow', 'index.html')
].find(p => fs.existsSync(p));

if (!target) {
  console.error('V30 VERIFY: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const html = fs.readFileSync(target, 'utf8');
const runtimePath = path.join(appDir, 'ai-direct-evaluator-v30.js');
const runtime = fs.existsSync(runtimePath) ? fs.readFileSync(runtimePath, 'utf8') : '';

const checks = [
  ['V30 runtime tag exactly once', (html.match(/ai-direct-evaluator-v30\.js\?v=30\.0\.0/g) || []).length === 1],
  ['V24 config tag remains', /ai-direct-evaluator-v24-config\.js/i.test(html)],
  ['V28 absent', !/ai-duplicate-modal-fix-v28\.js/i.test(html)],
  ['V29 absent', !/ai-modal-click-fix-v29\.js/i.test(html)],
  ['V26 remains', /ai-nav-layout-v26\.js/i.test(html)],
  ['V30 runtime file exists', fs.existsSync(runtimePath)],
  ['native sheet ID kept for V26/V27 compatibility', /SHEET_ID = 'sheet-ai-direct-v24'/.test(runtime)],
  ['mobile AI ID kept for V26/V27 compatibility', /AI_NAV_ID = 'mf-ai-center-nav-v24'/.test(runtime)],
  ['never hides overlay with display:none', !/backendOverlay\.style\.setProperty\('display', 'none'/.test(runtime)],
  ['never hides a root containing native sheet', /root\.contains\?\.\(sheet\)/.test(runtime)],
  ['all legacy backend copies are captured', /captureAndHideAllLegacyBackends/.test(runtime)],
  ['legacy guard stops when sheet closes', /stopLegacyGuard/.test(runtime)],
  ['native sheet gets top z-index', /z-index:2147483000!important/.test(runtime)],
  ['direct evaluator still uses V24 config', /__MEMEFLOW_AI_DIRECT_V24_CONFIG__/.test(runtime)],
];

console.log('=== MEMEFLOW V30 VERIFY ===');
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

const failed = checks.filter(([,ok]) => !ok);

if (failed.length) {
  console.error(`V30 VERIFY FAILED: ${failed.length} check(s).`);
  process.exit(1);
}

console.log(`V30 VERIFY OK: ${checks.length}/${checks.length}`);
