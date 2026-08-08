#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const APP=path.join(ROOT,'memeflow-app','app-server.mjs');
const LEDGER=path.join(ROOT,'memeflow-app','src','event-holder-ledger.mjs');

function latest(target,prefix){
  const dir=path.dirname(target);
  const files=fs.readdirSync(dir).filter(x=>x.startsWith(path.basename(target)+prefix)).sort();
  return files.length?path.join(dir,files.at(-1)):null;
}

const ab=latest(APP,'.before-v12-20-');
const lb=latest(LEDGER,'.before-v12-20-');
if(!ab||!lb){console.error('ABORT: V12.20 backup not found');process.exit(1)}
fs.copyFileSync(ab,APP);
fs.copyFileSync(lb,LEDGER);
console.log('PASS: V12.20 rolled back');
console.log('Restart MEMEFLOW.');
