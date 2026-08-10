#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const root = process.cwd();

const indexPath = [
  path.join(root, 'memeflow-app', 'index.html'),
  path.join(root, 'index.html'),
  path.join(root, 'artifacts', 'memeflow', 'index.html')
].find(p => fs.existsSync(p));

if (!indexPath) {
  console.error('V33 VERIFY: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(indexPath);
const html = fs.readFileSync(indexPath, 'utf8');

const evaluatorFiles = fs.readdirSync(appDir)
  .filter(name => /^ai-direct-evaluator-v\d+\.js$/i.test(name))
  .map(name => path.join(appDir, name));

const v26Path = path.join(appDir, 'ai-nav-layout-v26.js');
const v26 = fs.existsSync(v26Path) ? fs.readFileSync(v26Path, 'utf8') : '';

let creatorCalls = 0;
let syntaxOk = true;

for (const file of [...evaluatorFiles, v26Path].filter(fs.existsSync)) {
  const source = fs.readFileSync(file, 'utf8');
  creatorCalls += (source.match(/ensureHeaderWalletButton\(\);/g) || []).length;

  const result = spawnSync(process.execPath, ['--check', file], { encoding:'utf8' });
  if (result.status !== 0) syntaxOk = false;
}

const checks = [
  ['GitHub-native #walletConnectTop exists', /id=["']walletConnectTop["']/i.test(html)],
  ['GitHub-native mobile Wallet exists', /data-sheet=["']wallet["']/i.test(html)],
  ['no static injected wallet exists', !/id=["']mf-header-wallet-v/i.test(html)],
  ['no creator calls remain in AI runtimes', creatorCalls === 0],
  ['all modified runtimes pass node --check', syntaxOk],
  ['V26 phone hides bottom Wallet only', /body\.mf-v26-phone \.mobile-nav>\[data-sheet="wallet"\]/.test(v26)],
  ['V26 tablet uses six slots', /repeat\(6,minmax\(0,1fr\)\)/.test(v26)],
  ['V26 tablet Wallet is slot 5', /data-sheet="wallet"[\s\S]{0,180}grid-column:5!important/.test(v26)],
  ['V26 tablet More is slot 6', /data-sheet="more"[\s\S]{0,180}grid-column:6!important/.test(v26)],
  ['V31 redundant tag absent', !/remove-duplicate-wallet-v31\.js/i.test(html)],
  ['V27 redundant tag absent', !/wallet-layout-fix-v27\.js/i.test(html)],
];

console.log('=== MEMEFLOW V33 VERIFY ===');
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

const failed = checks.filter(([,ok]) => !ok);

if (failed.length) {
  console.error(`V33 VERIFY FAILED: ${failed.length} check(s).`);
  process.exit(1);
}

console.log(`V33 VERIFY OK: ${checks.length}/${checks.length}`);
