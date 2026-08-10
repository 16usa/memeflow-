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
  console.error('ROLLBACK V25: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-ai-final-ui-v25.bak';

if (!fs.existsSync(backup)) {
  console.error('ROLLBACK V25: backup not found.');
  process.exit(1);
}

fs.copyFileSync(backup, target);

for (const name of ['ai-final-ui-v25.js', 'ai-final-ui-v25-config.js']) {
  const p = path.join(appDir, name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

console.log(`ROLLBACK V25 OK: restored ${path.relative(root, backup)}`);
