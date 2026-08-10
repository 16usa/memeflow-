import fs from 'node:fs';
import path from 'node:path';

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.cache') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

for (const file of walk(process.cwd())) {
  let txt = fs.readFileSync(file, 'utf8');
  const next = txt.replace(/<!-- MF_PRIMARY_IDENTITY_ALIGN_PATCH_START -->[\s\S]*?<!-- MF_PRIMARY_IDENTITY_ALIGN_PATCH_END -->/g, '');
  if (next !== txt) {
    fs.writeFileSync(file, next, 'utf8');
    console.log('ROLLED BACK:', file);
  }
}
