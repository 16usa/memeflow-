import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = process.cwd();
const candidates = [
  path.join(cwd, 'index.html'),
  path.join(cwd, 'memeflow-app', 'index.html'),
  path.join(cwd, 'artifacts', 'memeflow', 'index.html')
];

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceScript = path.join(here, 'ai-bottom-nav-patch.js');
const targetHtml = candidates.find(fs.existsSync);

if (!targetHtml) {
  console.error('MEMEFLOW patch: index.html was not found in the expected project locations.');
  process.exit(1);
}

const targetDir = path.dirname(targetHtml);
const targetScript = path.join(targetDir, 'ai-bottom-nav-patch.js');
fs.copyFileSync(sourceScript, targetScript);

let html = fs.readFileSync(targetHtml, 'utf8');
const tag = '<script src="./ai-bottom-nav-patch.js?v=3.0.0" defer></script>';

// Replace any older MEMEFLOW AI nav script tag so Safari/Replit cannot reuse v1/v2 from cache.
const oldTagRe = /<script\b[^>]*src=["'][^"']*ai-bottom-nav-patch\.js(?:\?[^"']*)?["'][^>]*><\/script>/ig;
if (oldTagRe.test(html)) {
  html = html.replace(oldTagRe, tag);
} else {
  if (!/<\/body>/i.test(html)) {
    console.error('MEMEFLOW patch: </body> not found; no changes made to index.html.');
    process.exit(1);
  }
  html = html.replace(/<\/body>/i, `${tag}\n</body>`);
}

fs.writeFileSync(targetHtml, html, 'utf8');
console.log(`MEMEFLOW AI nav patch v3 installed in: ${path.relative(cwd, targetHtml)}`);
console.log('Cache-busted script tag: ai-bottom-nav-patch.js?v=3.0.0');
