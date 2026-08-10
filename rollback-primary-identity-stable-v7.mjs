import fs from 'node:fs';
import path from 'node:path';

const explicit = process.argv[2];
const candidates = explicit
  ? [path.resolve(explicit)]
  : [path.resolve('memeflow-app/index.html'), path.resolve('index.html')];
const target = candidates.find(fs.existsSync);
if (!target) {
  console.error('ERROR: index.html not found');
  process.exit(1);
}
const backup = target + '.before-primary-identity-stable-v7.bak';
if (!fs.existsSync(backup)) {
  console.error('ERROR: V7 backup not found:', backup);
  process.exit(1);
}
fs.copyFileSync(backup, target);
console.log('RESTORED:', target);
console.log('FROM:', backup);
