#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const ROOT=process.cwd();
for(const rel of ['memeflow-app/app-server.mjs','memeflow-app/src/pump-live-trade-feed.mjs']){
  const p=path.join(ROOT,rel);const dir=path.dirname(p),base=path.basename(p)+'.before-v12-26-';
  const c=fs.readdirSync(dir).filter(x=>x.startsWith(base)).sort().reverse();
  if(!c.length){console.log('SKIP: no backup for '+rel);continue}
  fs.copyFileSync(path.join(dir,c[0]),p);console.log('RESTORED:',rel,'from',c[0]);
}
