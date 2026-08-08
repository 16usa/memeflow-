#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const target=path.join(process.cwd(),'memeflow-app','src','enrich.mjs');
const dir=path.dirname(target),base=path.basename(target);
const list=fs.readdirSync(dir).filter(n=>n.startsWith(base+'.before-v12-15-3-watchdog-')).sort().reverse();
if(!list.length){console.error('ABORT: no V12.15.3 backup found');process.exit(1)}
const b=path.join(dir,list[0]);fs.copyFileSync(b,target);
console.log('RESTORED:',target);console.log('FROM:',b);console.log('Restart MEMEFLOW.');
