#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const candidates=[
  path.join(cwd,'memeflow-app','src'),
  path.join(cwd,'src')
];
const dir=candidates.find(p=>fs.existsSync(p));
if(!dir){
  console.error('ABORT: src directory not found');
  process.exit(1);
}

const target=path.join(dir,'enrich.mjs');
const backups=fs.readdirSync(dir)
  .filter(n=>n.startsWith('enrich.mjs.before-v12-15-4-'))
  .sort()
  .reverse();

if(!backups.length){
  console.error('ABORT: V12.15.4 backup not found');
  process.exit(1);
}
const backup=path.join(dir,backups[0]);
fs.copyFileSync(backup,target);
console.log('PASS: rollback complete');
console.log('Restored:',backup);
console.log('Target:',target);
