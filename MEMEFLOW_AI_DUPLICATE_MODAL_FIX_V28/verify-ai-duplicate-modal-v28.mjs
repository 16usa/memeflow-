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
  console.error('V28 VERIFY: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const html = fs.readFileSync(target, 'utf8');
const runtimePath = path.join(appDir, 'ai-duplicate-modal-fix-v28.js');
const runtime = fs.existsSync(runtimePath) ? fs.readFileSync(runtimePath, 'utf8') : '';

const checks = [
  ['V24 native AI runtime present', /ai-direct-evaluator-v24\.js/i.test(html)],
  ['V26 layout runtime present', /ai-nav-layout-v26\.js/i.test(html)],
  ['V28 tag exactly once', (html.match(/ai-duplicate-modal-fix-v28\.js\?v=28\.0\.0/g) || []).length === 1],
  ['V28 runtime exists', fs.existsSync(runtimePath)],
  ['native sheet explicitly excluded from hiding', /NATIVE_SHEET_ID = 'sheet-ai-direct-v24'/.test(runtime) && /isInsideNativeSheet/.test(runtime)],
  ['legacy root requires MEMEFLOW OpenAI', /MEMEFLOW OpenAI/.test(runtime)],
  ['legacy root requires input + textarea + Ask AI', /querySelector\?\.\('input'\)/.test(runtime) && /querySelector\?\.\('textarea'\)/.test(runtime) && /hasAskAi/.test(runtime)],
  ['legacy DOM is hidden, not removed', /forceHide/.test(runtime) && !/root\.remove\(\)/.test(runtime)],
  ['active guard stops when native sheet closes', /if \(!nativeSheetOpen\(\)\)[\s\S]*stopActiveGuard/.test(runtime)],
  ['V28 contains no evaluator/API requests', !/fetch\(|XMLHttpRequest|\/api\//.test(runtime)],
];

console.log('=== MEMEFLOW V28 VERIFY ===');
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

const failed = checks.filter(([, ok]) => !ok);

if (failed.length) {
  console.error(`V28 VERIFY FAILED: ${failed.length} check(s).`);
  process.exit(1);
}

console.log(`V28 VERIFY OK: ${checks.length}/${checks.length}`);
