import fs from 'node:fs';
import path from 'node:path';

const target=process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html'))
      ? path.resolve('memeflow-app/index.html')
      : path.resolve('index.html'));

const backup=target+'.before-premium-mobile-v1-7-header-like-bottom-nav.bak';
if(!fs.existsSync(backup)){
  console.error('Backup not found:',backup);
  process.exit(1);
}
fs.copyFileSync(backup,target);
console.log('RESTORED:',target);
