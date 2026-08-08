#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const APP=path.join(ROOT,'memeflow-app','app-server.mjs');
const HOLDER=path.join(ROOT,'memeflow-app','src','event-holder-ledger.mjs');
const FEED=path.join(ROOT,'memeflow-app','src','pump-live-trade-feed.mjs');

function latest(target,prefix){
  const d=path.dirname(target),b=path.basename(target)+prefix;
  const a=fs.readdirSync(d).filter(x=>x.startsWith(b)).sort();
  return a.length?path.join(d,a.at(-1)):null;
}
const ab=latest(APP,'.before-v12-22-');
const hb=latest(HOLDER,'.before-v12-22-');
const fb=latest(FEED,'.before-v12-22-');
if(!ab||!hb||!fb){console.error('ABORT: V12.22 backups not found');process.exit(1)}
fs.copyFileSync(ab,APP);fs.copyFileSync(hb,HOLDER);fs.copyFileSync(fb,FEED);
console.log('PASS: rolled back to V12.21. Restart MEMEFLOW.');
