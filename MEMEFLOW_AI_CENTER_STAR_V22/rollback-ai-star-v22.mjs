#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const candidates = [
  path.join(root, 'memeflow-app', 'index.html'),
  path.join(root, 'index.html'),
  path.join(root, 'artifacts', 'memeflow', 'index.html')
];

const target = candidates.find(p => fs.existsSync(p));
if (!target) {
  console.error('ROLLBACK v22: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-ai-star-v22.bak';

if (!fs.existsSync(backup)) {
  console.error('ROLLBACK v22: backup not found.');
  process.exit(1);
}

fs.copyFileSync(backup, target);

for (const name of [
  'ai-direct-evaluator-v22.js',
  'ai-direct-evaluator-v22-config.js'
]) {
  const p = path.join(appDir, name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

console.log(`ROLLBACK v22 OK: restored ${path.relative(root,backup)}`);
