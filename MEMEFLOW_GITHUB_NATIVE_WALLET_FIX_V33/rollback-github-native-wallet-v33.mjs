#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();

const indexPath = [
  path.join(root, 'memeflow-app', 'index.html'),
  path.join(root, 'index.html'),
  path.join(root, 'artifacts', 'memeflow', 'index.html')
].find(p => fs.existsSync(p));

if (!indexPath) {
  console.error('V33 ROLLBACK: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(indexPath);
let restored = 0;

for (const name of fs.readdirSync(appDir)) {
  if (!/\.pre-wallet-v33\.bak$/i.test(name)) continue;

  const backup = path.join(appDir, name);
  const original = backup.replace(/\.pre-wallet-v33\.bak$/i, '');

  fs.copyFileSync(backup, original);
  restored += 1;
}

const indexBackup = indexPath + '.pre-wallet-v33.bak';
if (fs.existsSync(indexBackup)) {
  fs.copyFileSync(indexBackup, indexPath);
}

console.log(`V33 ROLLBACK OK. Restored files: ${restored}`);
