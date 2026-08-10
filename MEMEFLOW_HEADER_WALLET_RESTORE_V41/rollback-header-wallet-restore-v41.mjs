#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
const root = process.cwd();
const target = [
  path.join(root,'memeflow-app','index.html'),
  path.join(root,'index.html'),
  path.join(root,'artifacts','memeflow','index.html')
].find(p => fs.existsSync(p));
if (!target) { console.error('V41 rollback: index.html not found.'); process.exit(1); }
const appDir = path.dirname(target);
const backup = `${target}.pre-v41.bak`;
if (fs.existsSync(backup)) {
  fs.copyFileSync(backup, target);
  console.log(`Restored backup: ${backup}`);
}
const runtimeDst = path.join(appDir,'header-wallet-restore-v41.js');
if (fs.existsSync(runtimeDst)) fs.unlinkSync(runtimeDst);
console.log('V41 rollback complete.');
