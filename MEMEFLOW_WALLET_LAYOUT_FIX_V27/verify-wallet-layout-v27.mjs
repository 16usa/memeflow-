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
  console.error('V27 VERIFY: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const html = fs.readFileSync(target, 'utf8');
const runtimePath = path.join(appDir, 'wallet-layout-fix-v27.js');
const runtime = fs.existsSync(runtimePath) ? fs.readFileSync(runtimePath, 'utf8') : '';

const checks = [
  ['V26 runtime still present', /ai-nav-layout-v26\.js/i.test(html)],
  ['V27 runtime tag exactly once', (html.match(/wallet-layout-fix-v27\.js\?v=27\.0\.0/g) || []).length === 1],
  ['V27 runtime file exists', fs.existsSync(runtimePath)],
  ['original Wallet nav node preserved', /data-sheet=["']wallet["']/i.test(html)],
  ['original top Wallet control preserved', /id=["']walletConnectTop["']/i.test(html)],
  ['tablet six-column rule present', /repeat\(6,minmax\(0,1fr\)\)/.test(runtime)],
  ['tablet Wallet slot = 5', /data-sheet="wallet"[\s\S]{0,220}grid-column:5!important/.test(runtime)],
  ['tablet More slot = 6', /data-sheet="more"[\s\S]{0,220}grid-column:6!important/.test(runtime)],
  ['injected wallet prefix is removed/hidden', /\[id\^="mf-header-wallet-v"\]/.test(runtime)],
  ['AI evaluator source not modified by V27', !/fetch\(|XMLHttpRequest|\/api\//.test(runtime)],
];

console.log('=== MEMEFLOW V27 VERIFY ===');
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

const failed = checks.filter(([, ok]) => !ok);

if (failed.length) {
  console.error(`V27 VERIFY FAILED: ${failed.length} check(s).`);
  process.exit(1);
}

console.log(`V27 VERIFY OK: ${checks.length}/${checks.length}`);
