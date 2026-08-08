#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const APP=path.join(process.cwd(),'memeflow-app','app-server.mjs');
const dir=path.dirname(APP),base=path.basename(APP)+'.before-v12-23-';
const a=fs.readdirSync(dir).filter(x=>x.startsWith(base)).sort();
if(!a.length){console.error('ABORT: V12.23 backup not found');process.exit(1)}
const b=path.join(dir,a.at(-1));
fs.copyFileSync(b,APP);
console.log('PASS: V12.23 rolled back.');
console.log('Restart MEMEFLOW.');
