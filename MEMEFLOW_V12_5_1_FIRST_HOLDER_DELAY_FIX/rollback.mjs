import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const appDir = fs.existsSync(path.join(cwd,'memeflow-app'))
  ? path.join(cwd,'memeflow-app')
  : cwd;

const serverPath = path.join(appDir,'app-server.mjs');
const backup = serverPath + '.before-v12-5-1-first-holder-delay';

if (!fs.existsSync(backup)) {
  console.error('ABORT: backup missing ' + backup);
  process.exit(1);
}

fs.copyFileSync(backup,serverPath);
console.log('V12.5.1 rollback complete.');
