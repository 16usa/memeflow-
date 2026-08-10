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
  const txt = fs.readFileSync(file, 'utf8');
  if (!txt.includes('id="primary-candidate"')) continue;
  const v6 = txt.includes('mf-primary-identity-align-v6-script');
  console.log((v6 ? 'OK ' : 'NO '), file, 'V6=' + (v6 ? 'YES' : 'NO'));
}
