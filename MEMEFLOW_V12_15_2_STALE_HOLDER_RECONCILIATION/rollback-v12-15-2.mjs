#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
for(const target of ['memeflow-app/src/enrich.mjs','memeflow-app/app-server.mjs']){
  const full=path.join(process.cwd(),target),dir=path.dirname(full),base=path.basename(full);
  const list=fs.readdirSync(dir).filter(n=>n.startsWith(base+'.before-v12-15-2-stale-holder-')).sort().reverse();
  if(!list.length){console.log('SKIP: no backup for',target);continue}
  const b=path.join(dir,list[0]);fs.copyFileSync(b,full);console.log('RESTORED:',target,'FROM:',b);
}
console.log('Rollback complete. Restart MEMEFLOW.');
