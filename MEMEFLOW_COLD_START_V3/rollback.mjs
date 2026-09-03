#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const project=process.cwd();
const base=path.join(project,'.memeflow-backups');
if(!fs.existsSync(base)){
  console.error('No backup directory found.');
  process.exit(1);
}

const dirs=fs.readdirSync(base)
  .filter(x=>x.startsWith('cold-start-v3-'))
  .sort()
  .reverse();

if(!dirs.length){
  console.error('No COLD START V3 backup found.');
  process.exit(2);
}

const backup=path.join(base,dirs[0]);
fs.copyFileSync(
  path.join(backup,'app-server.mjs'),
  path.join(project,'memeflow-app','app-server.mjs')
);
fs.copyFileSync(
  path.join(backup,'store.mjs'),
  path.join(project,'memeflow-app','src','store.mjs')
);
console.log(`Rolled back MEMEFLOW COLD START V3 from ${backup}`);
