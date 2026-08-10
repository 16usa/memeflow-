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
  console.error('ROLLBACK FINAL v14: index.html not found.');
  process.exit(1);
}

const backup = target + '.pre-ai-final-v14.bak';

if (!fs.existsSync(backup)) {
  console.error('ROLLBACK FINAL v14: backup not found.');
  process.exit(1);
}

fs.copyFileSync(backup, target);

const runtime = path.join(path.dirname(target), 'ai-final-native-v14.js');
if (fs.existsSync(runtime)) fs.unlinkSync(runtime);

console.log(`ROLLBACK FINAL v14 OK: restored ${path.relative(root, backup)}`);
