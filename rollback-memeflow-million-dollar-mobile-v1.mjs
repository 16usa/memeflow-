import fs from 'node:fs';
import path from 'node:path';

const target=process.argv[2]
  ? path.resolve(process.argv[2])
  : (fs.existsSync(path.resolve('memeflow-app/index.html'))
      ? path.resolve('memeflow-app/index.html')
      : path.resolve('index.html'));

const backup=target+'.before-million-dollar-mobile-v1.bak';
if(!fs.existsSync(backup)){
  console.error('ERROR: backup not found:',backup);
  process.exit(1);
}

fs.copyFileSync(backup,target);
console.log('RESTORED:',path.relative(process.cwd(),target)||target);
console.log('Exact pre-install index.html restored.');
