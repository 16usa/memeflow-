import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appDir = fs.existsSync(path.join(root, 'memeflow-app'))
  ? path.join(root, 'memeflow-app')
  : root;

for (const rel of ['paper-automation-ui.js', 'index.html']) {
  const target = path.join(appDir, rel);
  const backup = `${target}.before-empty-market-chart-fix`;

  if (!fs.existsSync(backup)) {
    console.error(`Missing backup: ${backup}`);
    process.exitCode = 1;
    continue;
  }

  fs.copyFileSync(backup, target);
  console.log(`Restored ${rel}`);
}