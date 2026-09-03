#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const project = process.cwd();
const base = path.join(project,'.memeflow-backups');
if (!fs.existsSync(base)) {
  console.error('No .memeflow-backups directory found.');
  process.exit(1);
}
const dirs = fs.readdirSync(base)
  .filter(x=>x.startsWith('perf-load-v1-'))
  .sort()
  .reverse();

if (!dirs.length) {
  console.error('No MEMEFLOW load-performance backup found.');
  process.exit(2);
}

const backup = path.join(base,dirs[0]);
for (const name of ['system-tokens.html','app-server.mjs']) {
  const src = path.join(backup,name);
  const dst = path.join(project,'memeflow-app',name);
  if (!fs.existsSync(src)) {
    console.error(`Backup file missing: ${src}`);
    process.exit(3);
  }
  fs.copyFileSync(src,dst);
}
console.log(`Rolled back from ${backup}`);
