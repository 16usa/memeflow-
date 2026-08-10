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
  console.error('V29 VERIFY: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const html = fs.readFileSync(target, 'utf8');
const runtimePath = path.join(appDir, 'ai-modal-click-fix-v29.js');
const runtime = fs.existsSync(runtimePath) ? fs.readFileSync(runtimePath, 'utf8') : '';

const checks = [
  ['V24 runtime present', /ai-direct-evaluator-v24\.js/i.test(html)],
  ['V28 tag absent', !/ai-duplicate-modal-fix-v28\.js/i.test(html)],
  ['V29 tag exactly once', (html.match(/ai-modal-click-fix-v29\.js\?v=29\.0\.0/g) || []).length === 1],
  ['V29 runtime exists', fs.existsSync(runtimePath)],
  ['NO click interception in V29', !/addEventListener\(['"]click['"]/.test(runtime)],
  ['native sheet explicitly protected', /NATIVE_ID = 'sheet-ai-direct-v24'/.test(runtime) && /sheet && el\.contains\(sheet\)/.test(runtime)],
  ['NO ancestor overlay hiding', !/findLegacyOverlay|parentElement[\s\S]{0,200}forceHide/.test(runtime)],
  ['exact legacy root requires input + textarea + Ask AI', /inputs < 1/.test(runtime) && /textareas < 1/.test(runtime) && /hasAskAi/.test(runtime)],
  ['legacy DOM hidden but not deleted', /style\.setProperty\('display', 'none'/.test(runtime) && !/root\.remove\(\)/.test(runtime)],
  ['no evaluator/API requests in V29', !/fetch\(|XMLHttpRequest|\/api\//.test(runtime)],
  ['guard only works when native AI is open', /if \(!nativeOpen\(\)\) return/.test(runtime)],
];

console.log('=== MEMEFLOW V29 VERIFY ===');
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

const failed = checks.filter(([,ok]) => !ok);

if (failed.length) {
  console.error(`V29 VERIFY FAILED: ${failed.length} check(s).`);
  process.exit(1);
}

console.log(`V29 VERIFY OK: ${checks.length}/${checks.length}`);
