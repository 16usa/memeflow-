import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appDir = fs.existsSync(path.join(root, 'memeflow-app'))
  ? path.join(root, 'memeflow-app')
  : root;

const target = path.join(appDir, 'index.html');
const backup = `${target}.before-primary-active-only-fix`;

if (!fs.existsSync(backup)) {
  console.error(`ROLLBACK ABORTED: ${backup} not found.`);
  process.exit(1);
}

fs.copyFileSync(backup, target);
console.log('Primary Active-Only fix rolled back.');