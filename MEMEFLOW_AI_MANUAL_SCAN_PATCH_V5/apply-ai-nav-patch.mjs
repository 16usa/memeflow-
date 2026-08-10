#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = process.cwd();

const candidates = [
  path.join(root, 'memeflow-app', 'index.html'),
  path.join(root, 'index.html'),
  path.join(root, 'artifacts', 'memeflow', 'index.html')
];

const target = candidates.find(p => fs.existsSync(p));
if (!target) {
  console.error('MEMEFLOW patch: index.html was not found in the expected project locations.');
  process.exit(1);
}

const targetDir = path.dirname(target);
const jsSrc = path.join(__dirname, 'ai-manual-scan-sheet-patch.js');
const jsDest = path.join(targetDir, 'ai-manual-scan-sheet-patch.js');
fs.copyFileSync(jsSrc, jsDest);

let html = fs.readFileSync(target, 'utf8');
const newTag = '<script src="./ai-manual-scan-sheet-patch.js?v=5.0.0" defer></script>';
const oldAiTags = [
  /<script\s+src=["']\.\/ai-bottom-nav-patch\.js(?:\?v=[^"']*)?["']\s+defer><\/script>/ig,
  /<script\s+src=["']\.\/ai-manual-scan-sheet-patch\.js(?:\?v=[^"']*)?["']\s+defer><\/script>/ig
];
oldAiTags.forEach(re => {
  html = html.replace(re, '');
});

const bodyClose = /<\/body>/i;
if (!bodyClose.test(html)) {
  console.error('MEMEFLOW patch: </body> tag not found in target index.html');
  process.exit(1);
}
html = html.replace(bodyClose, `${newTag}\n</body>`);

fs.writeFileSync(target, html, 'utf8');
console.log(`MEMEFLOW manual-AI patch v5 installed in: ${path.relative(root, target)}`);
console.log('Script tag: ai-manual-scan-sheet-patch.js?v=5.0.0');
