#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const dirs = [
  path.join(process.cwd(), 'memeflow-app'),
  process.cwd(),
  '/workspace/memeflow-app'
];
const dir = dirs.find(d => fs.existsSync(path.join(d,'app-server.mjs')));
if (!dir) { console.error('ABORT: app-server.mjs not found'); process.exit(1); }

const backups = fs.readdirSync(dir)
  .filter(n => n.startsWith('app-server.mjs.before-v12-12-holder-admission-'))
  .sort()
  .reverse();

if (!backups.length) { console.error('ABORT: no V12.12 backup found'); process.exit(2); }

fs.copyFileSync(path.join(dir, backups[0]), path.join(dir,'app-server.mjs'));
console.log('PASS: rollback complete');
console.log('Restored:', backups[0]);
