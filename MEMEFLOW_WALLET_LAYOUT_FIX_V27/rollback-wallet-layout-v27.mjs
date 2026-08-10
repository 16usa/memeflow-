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
  console.error('V27 ROLLBACK: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-wallet-layout-v27.bak';

if (!fs.existsSync(backup)) {
  console.error('V27 ROLLBACK: backup not found.');
  process.exit(1);
}

fs.copyFileSync(backup, target);

const runtime = path.join(appDir, 'wallet-layout-fix-v27.js');
if (fs.existsSync(runtime)) fs.unlinkSync(runtime);

console.log(`V27 ROLLBACK OK: restored ${path.relative(root, backup)}`);
