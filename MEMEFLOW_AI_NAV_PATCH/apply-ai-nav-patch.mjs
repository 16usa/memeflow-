import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const candidates = [
  path.join(cwd, 'index.html'),
  path.join(cwd, 'memeflow-app', 'index.html'),
  path.join(cwd, 'artifacts', 'memeflow', 'index.html')
];

const sourceScript = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'ai-bottom-nav-patch.js');
const targetHtml = candidates.find(fs.existsSync);

if (!targetHtml) {
  console.error('MEMEFLOW patch: index.html was not found in the expected project locations.');
  process.exit(1);
}

const targetDir = path.dirname(targetHtml);
const targetScript = path.join(targetDir, 'ai-bottom-nav-patch.js');
fs.copyFileSync(sourceScript, targetScript);

let html = fs.readFileSync(targetHtml, 'utf8');
const tag = '<script src="./ai-bottom-nav-patch.js" defer></script>';

if (!html.includes('ai-bottom-nav-patch.js')) {
  if (!/<\/body>/i.test(html)) {
    console.error('MEMEFLOW patch: </body> not found; no changes made to index.html.');
    process.exit(1);
  }
  html = html.replace(/<\/body>/i, `${tag}\n</body>`);
  fs.writeFileSync(targetHtml, html, 'utf8');
  console.log(`MEMEFLOW patch installed in: ${path.relative(cwd, targetHtml)}`);
} else {
  console.log('MEMEFLOW patch already installed; no duplicate script tag added.');
}
