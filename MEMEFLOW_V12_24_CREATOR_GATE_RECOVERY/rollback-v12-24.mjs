#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const A=path.join(ROOT,'memeflow-app','app-server.mjs');
const H=path.join(ROOT,'memeflow-app','src','event-holder-ledger.mjs');
function latest(target,prefix){
  const d=path.dirname(target),b=path.basename(target)+prefix;
  const x=fs.readdirSync(d).filter(n=>n.startsWith(b)).sort();
  return x.length?path.join(d,x.at(-1)):null;
}
const ab=latest(A,'.before-v12-24-');
const hb=latest(H,'.before-v12-24-');
if(!ab||!hb){console.error('ABORT: V12.24 backups not found');process.exit(1)}
fs.copyFileSync(ab,A);fs.copyFileSync(hb,H);
console.log('PASS: V12.24 rolled back. Restart MEMEFLOW.');
