#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const project=process.cwd();
const base=path.join(project,'.memeflow-backups');

if(!fs.existsSync(base)){
  console.error('No .memeflow-backups directory found.');
  process.exit(1);
}

const dirs=fs.readdirSync(base)
  .filter(x=>x.startsWith('cold-start-v2-'))
  .sort()
  .reverse();

if(!dirs.length){
  console.error('No MEMEFLOW COLD START V2 backup found.');
  process.exit(2);
}

const backup=path.join(base,dirs[0]);
const pairs=[
  [path.join(backup,'app-server.mjs'),path.join(project,'memeflow-app','app-server.mjs')],
  [path.join(backup,'store.mjs'),path.join(project,'memeflow-app','src','store.mjs')]
];

for(const [src,dst] of pairs){
  if(!fs.existsSync(src)){
    console.error(`Backup file missing: ${src}`);
    process.exit(3);
  }
  fs.copyFileSync(src,dst);
}

console.log(`Rolled back MEMEFLOW COLD START V2 from ${backup}`);
