import fs from 'node:fs';
import path from 'node:path';
const target = path.resolve(process.argv[2] || (fs.existsSync('memeflow-app/index.html') ? 'memeflow-app/index.html' : 'index.html'));
const backup = target + '.before-primary-identity-stable-v8.bak';
if (!fs.existsSync(backup)) { console.error('Backup not found:', backup); process.exit(1); }
fs.copyFileSync(backup, target);
console.log('RESTORED:', target);
