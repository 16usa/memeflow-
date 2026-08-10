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
if (!target) { console.error('ROLLBACK v19: index.html not found.'); process.exit(1); }
const backup = target + '.pre-ai-direct-v19.bak';
if (!fs.existsSync(backup)) { console.error('ROLLBACK v19: backup not found.'); process.exit(1); }
fs.copyFileSync(backup, target);
for (const name of ['ai-direct-evaluator-v19.js','ai-direct-evaluator-v19-config.js']) {
  const p = path.join(path.dirname(target), name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
console.log(`ROLLBACK v19 OK: restored ${path.relative(root,backup)}`);
