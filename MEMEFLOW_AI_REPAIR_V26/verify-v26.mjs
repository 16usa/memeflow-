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
  console.error('V26 VERIFY: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const html = fs.readFileSync(target, 'utf8');

const checks = [
  ['index.html non-empty', html.length > 10000],
  ['production/core markup still present', /class=["'][^"']*\bapp\b/i.test(html) && /class=["'][^"']*\bmain\b/i.test(html)],
  ['mobile nav present', /class=["'][^"']*\bmobile-nav\b/i.test(html)],
  ['Home node present', /data-sheet=["']home["']/i.test(html)],
  ['Candidates node present', /data-sheet=["']candidates["']/i.test(html)],
  ['Positions node present', /data-sheet=["']positions["']/i.test(html)],
  ['Wallet node preserved', /data-sheet=["']wallet["']/i.test(html)],
  ['More node present', /data-sheet=["']more["']/i.test(html)],
  ['V25 tags gone', !/ai-final-ui-v25(?:-config)?\.js/i.test(html)],
  ['V24 runtime exactly once', (html.match(/ai-direct-evaluator-v24\.js\?v=24\.0\.0/g) || []).length === 1],
  ['V24 config exactly once', (html.match(/ai-direct-evaluator-v24-config\.js\?v=24\.0\.0/g) || []).length === 1],
  ['V26 layout exactly once', (html.match(/ai-nav-layout-v26\.js\?v=26\.0\.0/g) || []).length === 1],
  ['V24 runtime file exists', fs.existsSync(path.join(appDir, 'ai-direct-evaluator-v24.js'))],
  ['V24 config file exists', fs.existsSync(path.join(appDir, 'ai-direct-evaluator-v24-config.js'))],
  ['V26 runtime file exists', fs.existsSync(path.join(appDir, 'ai-nav-layout-v26.js'))],
];

console.log('=== MEMEFLOW V26 VERIFY ===');
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`V26 VERIFY FAILED: ${failed.length} check(s).`);
  process.exit(1);
}

console.log(`V26 VERIFY OK: ${checks.length}/${checks.length}`);
