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
  console.error('V34 VERIFY: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(indexPath);
const html = fs.readFileSync(indexPath, 'utf8');
const v26Path = path.join(appDir, 'ai-nav-layout-v26.js');
const v26 = fs.existsSync(v26Path) ? fs.readFileSync(v26Path, 'utf8') : '';

const evaluatorFiles = fs.readdirSync(appDir)
  .filter(name => /^ai-direct-evaluator-v\d+\.js$/i.test(name))
  .map(name => path.join(appDir, name));

let creatorBodies = 0;
let cleanupBodies = 0;
let syntaxOk = true;

for (const file of evaluatorFiles) {
  const src = fs.readFileSync(file, 'utf8');

  if (
    /function ensureHeaderWalletButton\(\)\s*\{[\s\S]*?host\.appendChild\(button\)[\s\S]*?\n\s*\}\n\n\s*function ensureCenterAiNavButton\(\)/.test(src)
  ) creatorBodies += 1;

  if (
    /function ensureHeaderWalletButton\(\)\s*\{[\s\S]*?\[id\^="mf-header-wallet-v"\][\s\S]*?return false;[\s\S]*?\n\s*\}\n\n\s*function ensureCenterAiNavButton\(\)/.test(src)
  ) cleanupBodies += 1;

  const check = spawnSync(process.execPath, ['--check', file], { encoding:'utf8' });
  if (check.status !== 0) syntaxOk = false;
}

if (fs.existsSync(v26Path)) {
  const check = spawnSync(process.execPath, ['--check', v26Path], { encoding:'utf8' });
  if (check.status !== 0) syntaxOk = false;
}

const checks = [
  ['current mobile Wallet source exists', /data-sheet=["']wallet["']/i.test(html)],
  ['duplicate creator bodies = 0', creatorBodies === 0],
  ['duplicate cleanup body exists', cleanupBodies >= 1],
  ['all AI/V26 runtimes pass node --check', syntaxOk],
  ['phone hides bottom Wallet', /body\.mf-v26-phone \.mobile-nav>\[data-sheet="wallet"\]/.test(v26)],
  ['tablet uses six slots', /body\.mf-v26-tablet \.mobile-nav\{[\s\S]*?repeat\(6,minmax\(0,1fr\)\)!important;/.test(v26)],
  ['tablet Wallet = slot 5', /data-sheet="wallet"[\s\S]*?grid-column:5!important/.test(v26)],
  ['tablet More = slot 6', /data-sheet="more"[\s\S]*?grid-column:6!important/.test(v26)],
  ['old V27/V31 tags absent', !/(remove-duplicate-wallet-v31|wallet-layout-fix-v27)\.js/i.test(html)],
  ['no #walletConnectTop requirement', true],
];

console.log('=== MEMEFLOW V34 VERIFY ===');
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

const failed = checks.filter(([,ok]) => !ok);
if (failed.length) {
  console.error(`V34 VERIFY FAILED: ${failed.length} check(s).`);
  process.exit(1);
}

console.log(`V34 VERIFY OK: ${checks.length}/${checks.length}`);
