#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const APP=path.join(process.cwd(),'memeflow-app','app-server.mjs');
const d=path.dirname(APP),prefix=path.basename(APP)+'.before-v12-25-';
const a=fs.readdirSync(d).filter(x=>x.startsWith(prefix)).sort();
if(!a.length){console.error('ABORT: V12.25 backup not found');process.exit(1)}
const b=path.join(d,a.at(-1));
fs.copyFileSync(b,APP);
console.log('PASS: V12.25 rolled back. Restart MEMEFLOW.');
