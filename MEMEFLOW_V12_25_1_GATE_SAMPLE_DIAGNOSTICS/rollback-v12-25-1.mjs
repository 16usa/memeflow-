import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.env.HOME || '/home/runner', 'workspace/memeflow-app');
const files = fs.readdirSync(dir)
  .filter(x=>x.startsWith('app-server.mjs.before-v12-25-1-'))
  .sort();
if(!files.length){ console.error('No V12.25.1 backup found'); process.exit(1); }
const latest = path.join(dir, files.at(-1));
fs.copyFileSync(latest, path.join(dir,'app-server.mjs'));
console.log('PASS: restored ' + latest);
