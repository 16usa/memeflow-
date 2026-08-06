import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const appDir = fs.existsSync(path.join(root, 'memeflow-app'))
  ? path.join(root, 'memeflow-app')
  : root;

const target = path.join(appDir, 'paper-automation-ui.js');
const patchPath = path.join(here, 'final-cleanup.js');
const marker = 'window.__MEMEFLOW_FINAL_CLEANUP__';

if (!fs.existsSync(target)) {
  console.error(`INSTALL ABORTED: ${target} not found.`);
  process.exit(1);
}

const current = fs.readFileSync(target, 'utf8');

if (current.includes(marker)) {
  console.log('Already installed. No files changed.');
  process.exit(0);
}

const backup = `${target}.before-final-cleanup`;
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);

const patch = fs.readFileSync(patchPath, 'utf8');
fs.writeFileSync(target, `${current.trimEnd()}\n\n${patch}\n`, 'utf8');

console.log('Installed MEMEFLOW final cleanup.');
console.log(`Changed: ${target}`);
console.log(`Backup:  ${backup}`);