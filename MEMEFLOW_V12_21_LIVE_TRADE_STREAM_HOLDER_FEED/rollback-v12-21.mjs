#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';
const root=process.cwd(),app=path.join(root,'memeflow-app','app-server.mjs'),holder=path.join(root,'memeflow-app','src','event-holder-ledger.mjs');
function last(t,p){const d=path.dirname(t),b=path.basename(t)+p,x=fs.readdirSync(d).filter(n=>n.startsWith(b)).sort();return x.length?path.join(d,x.at(-1)):null}
const a=last(app,'.before-v12-21-'),h=last(holder,'.before-v12-21-');
if(!a||!h){console.error('ABORT: backup not found');process.exit(1)}
fs.copyFileSync(a,app);fs.copyFileSync(h,holder);
try{fs.rmSync(path.join(root,'memeflow-app','src','pump-live-trade-feed.mjs'),{force:true})}catch{}
console.log('PASS: V12.21 rolled back. Restart MEMEFLOW.');
