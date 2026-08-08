#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const target=path.join(process.cwd(),'memeflow-app','src','event-holder-ledger.mjs');
const dir=path.dirname(target);
const base=path.basename(target)+'.before-v12-19-';
const backups=fs.readdirSync(dir).filter(x=>x.startsWith(base)).sort();
if(!backups.length){console.error('ABORT: no V12.19 backup found');process.exit(1)}
const b=path.join(dir,backups.at(-1));
fs.copyFileSync(b,target);
console.log('PASS: restored',b);
console.log('Restart MEMEFLOW.');
