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
  console.error('V31 VERIFY: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const html = fs.readFileSync(target, 'utf8');
const runtimePath = path.join(appDir, 'remove-duplicate-wallet-v31.js');
const runtime = fs.existsSync(runtimePath) ? fs.readFileSync(runtimePath, 'utf8') : '';

const checks = [
  ['native #walletConnectTop exists', /id=["']walletConnectTop["']/i.test(html)],
  ['V31 tag exactly once', (html.match(/remove-duplicate-wallet-v31\.js\?v=31\.0\.0/g) || []).length === 1],
  ['V31 runtime exists', fs.existsSync(runtimePath)],
  ['targets only injected mf-header-wallet-v* family', /DUP_SELECTOR = '\[id\^="mf-header-wallet-v"\]'/.test(runtime)],
  ['does not target walletConnectTop', !/walletConnectTop.*remove|remove.*walletConnectTop/.test(runtime)],
  ['does not target bottom-nav Wallet', !/data-sheet=.wallet.*remove|remove.*data-sheet=.wallet/.test(runtime)],
  ['does not contain API/evaluator calls', !/fetch\(|XMLHttpRequest|\/api\//.test(runtime)],
];

console.log('=== MEMEFLOW V31 VERIFY ===');
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

const failed = checks.filter(([, ok]) => !ok);

if (failed.length) {
  console.error(`V31 VERIFY FAILED: ${failed.length} check(s).`);
  process.exit(1);
}

console.log(`V31 VERIFY OK: ${checks.length}/${checks.length}`);
