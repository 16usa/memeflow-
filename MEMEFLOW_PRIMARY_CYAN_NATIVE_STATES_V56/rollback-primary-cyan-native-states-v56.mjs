#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const appDir = [
  path.join(root,'memeflow-app'),
  root,
  path.join(root,'artifacts','memeflow')
].find(p => fs.existsSync(path.join(p,'index.html')));

if (!appDir) {
  console.error('V56 rollback: project not found.');
  process.exit(1);
}

const backup = path.join(appDir,'.memeflow-v56-backup','index.html');
if (!fs.existsSync(backup)) {
  console.error('V56 rollback backup missing. Nothing changed.');
  process.exit(1);
}

fs.copyFileSync(backup, path.join(appDir,'index.html'));
try { fs.unlinkSync(path.join(appDir,'primary-cyan-native-states-v56.js')); } catch {}

console.log('V56 ROLLBACK OK: exact pre-V56 index.html restored.');
console.log('Refresh Safari after rollback.');
