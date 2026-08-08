import fs from 'node:fs';
import path from 'node:path';

const target=path.join(process.cwd(),'memeflow-app','src','enrich.mjs');
const dir=path.dirname(target);
const prefix=path.basename(target)+'.before-v12-15-1-holder-queue-drain-';
const backups=fs.readdirSync(dir).filter(n=>n.startsWith(prefix)).sort().reverse();
if(!backups.length){console.error('ABORT: no V12.15.1 backup found');process.exit(1)}
const from=path.join(dir,backups[0]);
fs.copyFileSync(from,target);
console.log('PASS: rolled back V12.15.1 from '+from);
