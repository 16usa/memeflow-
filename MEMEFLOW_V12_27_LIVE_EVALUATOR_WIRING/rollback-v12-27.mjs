#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(),'memeflow-app');
const files = fs.readdirSync(dir)
  .filter(x => x.startsWith('app-server.mjs.before-v12-27-'))
  .sort();

if (!files.length) {
  console.error('No V12.27 backup found.');
  process.exit(1);
}
const latest = path.join(dir, files[files.length-1]);
const target = path.join(dir, 'app-server.mjs');
fs.copyFileSync(latest, target);
console.log('PASS: restored', latest);
