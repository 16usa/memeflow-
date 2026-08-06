import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const appDir = fs.existsSync(path.join(root, 'memeflow-app'))
  ? path.join(root, 'memeflow-app')
  : root;

const target = path.join(appDir, 'paper-automation-ui.js');
const patchPath = path.join(here, 'evidence-fix-v2.js');
const marker = 'window.__MEMEFLOW_EVIDENCE_FIX_V2__';

if (!fs.existsSync(target)) {
  console.error(`INSTALL ABORTED: ${target} not found.`);
  process.exit(1);
}

let current = fs.readFileSync(target, 'utf8');

if (current.includes(marker)) {
  console.log('Evidence Fix V2 is already installed.');
  process.exit(0);
}

const backup = `${target}.before-evidence-fix-v2`;
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);

function disablePatchBlock(source, startMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) return source;

  const endToken = '\n})();';
  const end = source.indexOf(endToken, start);
  if (end === -1) return source;

  const blockEnd = end + endToken.length;
  const original = source.slice(start, blockEnd);

  if (original.startsWith('/* DISABLED BY EVIDENCE FIX V2')) return source;

  const disabled =
    `/* DISABLED BY EVIDENCE FIX V2\n${original}\nEND DISABLED BLOCK */`;

  return source.slice(0, start) + disabled + source.slice(blockEnd);
}

// Disable only the two earlier evidence writers that conflict with the new one.
// This does not disable the earlier responsibility/dedup patch.
current = disablePatchBlock(
  current,
  '// MEMEFLOW final cleanup: remove residual duplicates and enrich Evidence safely.'
);

current = disablePatchBlock(
  current,
  '// MEMEFLOW Evidence-only enrichment.'
);

const patch = fs.readFileSync(patchPath, 'utf8');
fs.writeFileSync(target, `${current.trimEnd()}\n\n${patch}\n`, 'utf8');

console.log('Installed MEMEFLOW Evidence Fix V2.');
console.log(`Changed: ${target}`);
console.log(`Backup:  ${backup}`);
console.log('Only conflicting Evidence writers were disabled.');
console.log('Price and Market Chart behavior were not changed by this installer.');