import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appDir = fs.existsSync(path.join(root, 'memeflow-app'))
  ? path.join(root, 'memeflow-app')
  : root;

const target = path.join(appDir, 'paper-automation-ui.js');
const patchFile = path.join(path.dirname(new URL(import.meta.url).pathname), 'responsibility-pass.js');

if (!fs.existsSync(target)) {
  console.error(`INSTALL ABORTED: ${target} was not found.`);
  process.exit(1);
}

const marker = 'window.__MEMEFLOW_UI_RESPONSIBILITY_PASS__';
const current = fs.readFileSync(target, 'utf8');

if (current.includes(marker)) {
  console.log('Already installed. No files changed.');
  process.exit(0);
}

const backup = `${target}.before-dedup-ui`;
if (!fs.existsSync(backup)) {
  fs.copyFileSync(target, backup);
}

const patch = fs.readFileSync(patchFile, 'utf8');
fs.writeFileSync(target, `${current.trimEnd()}\n\n${patch}\n`, 'utf8');

console.log('Installed MEMEFLOW UI responsibility pass.');
console.log(`Changed: ${target}`);
console.log(`Backup:  ${backup}`);