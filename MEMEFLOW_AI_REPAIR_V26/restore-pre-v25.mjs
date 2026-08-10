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
  console.error('RESTORE: index.html not found.');
  process.exit(1);
}

const preV25 = target + '.pre-ai-final-ui-v25.bak';
if (!fs.existsSync(preV25)) {
  console.error('RESTORE: pre-V25 backup not found.');
  process.exit(1);
}

const backup = fs.readFileSync(preV25, 'utf8');
if (/ai-final-ui-v25(?:-config)?\.js/i.test(backup)) {
  console.error('RESTORE: backup itself contains V25; refusing unsafe restore.');
  process.exit(1);
}

fs.copyFileSync(preV25, target);
console.log(`RESTORE OK: ${path.relative(root, preV25)} -> ${path.relative(root, target)}`);
