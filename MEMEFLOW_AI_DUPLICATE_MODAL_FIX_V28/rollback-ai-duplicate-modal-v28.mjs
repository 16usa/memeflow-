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
  console.error('V28 ROLLBACK: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-ai-duplicate-modal-v28.bak';

if (!fs.existsSync(backup)) {
  console.error('V28 ROLLBACK: backup not found.');
  process.exit(1);
}

fs.copyFileSync(backup, target);

const runtime = path.join(appDir, 'ai-duplicate-modal-fix-v28.js');
if (fs.existsSync(runtime)) fs.unlinkSync(runtime);

console.log(`V28 ROLLBACK OK: restored ${path.relative(root, backup)}`);
