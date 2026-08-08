import fs from 'node:fs';
import path from 'node:path';

const target=path.resolve('memeflow-app/src/enrich.mjs');
const dir=path.dirname(target);
const base=path.basename(target)+'.before-v12-16-holder-throughput-';
const backups=fs.readdirSync(dir)
  .filter(n=>n.startsWith(base))
  .sort()
  .reverse();

if(!backups.length){
  console.error('ABORT: no V12.16 backup found');
  process.exit(1);
}
const src=path.join(dir,backups[0]);
fs.copyFileSync(src,target);
console.log('PASS: rolled back V12.16');
console.log('Restored:',src);
