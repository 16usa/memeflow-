import fs from 'node:fs';
import path from 'node:path';

const target=path.resolve('memeflow-app/src/enrich.mjs');
const dir=path.dirname(target);
const prefix=path.basename(target)+'.before-v12-16-1-';
const files=fs.readdirSync(dir).filter(x=>x.startsWith(prefix)).sort().reverse();
if(!files.length){
  console.error('ABORT: no V12.16.1 backup found');
  process.exit(1);
}
const src=path.join(dir,files[0]);
fs.copyFileSync(src,target);
console.log('PASS: V12.16.1 rolled back');
console.log('Restored:',src);
