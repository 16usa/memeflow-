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
  console.error('V31 ROLLBACK: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-remove-duplicate-wallet-v31.bak';

if (!fs.existsSync(backup)) {
  console.error('V31 ROLLBACK: backup not found.');
  process.exit(1);
}

fs.copyFileSync(backup, target);

const runtime = path.join(appDir, 'remove-duplicate-wallet-v31.js');
if (fs.existsSync(runtime)) fs.unlinkSync(runtime);

console.log(`V31 ROLLBACK OK: restored ${path.relative(root, backup)}`);
