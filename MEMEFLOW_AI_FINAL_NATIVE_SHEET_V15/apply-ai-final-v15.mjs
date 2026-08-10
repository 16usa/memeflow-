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
  console.error('MEMEFLOW FINAL v15: index.html not found.');
  process.exit(1);
}

let html = fs.readFileSync(target, 'utf8');
const dir = path.dirname(target);
const backup = target + '.pre-ai-final-v15.bak';

fs.copyFileSync(target, backup);

/* Ensure Manual AI button exists. */
if (!/id=["']mfManualAiButton["']/i.test(html)) {
  const analyze = /(<button\b[^>]*>\s*Analyze token\s*<\/button>)/i;

  if (!analyze.test(html)) {
    console.error('MEMEFLOW FINAL v15: Analyze token button not found. Restoring backup.');
    fs.copyFileSync(backup, target);
    process.exit(1);
  }

  html = html.replace(
    analyze,
    `$1
<button id="mfManualAiButton" type="button" class="btn"><span class="mf-ai-mark">✦</span><span>Open AI assistant</span></button>`
  );
}

/* Remove every previous AI patch runtime layer. */
const oldScripts = [
  'ai-bottom-nav-patch',
  'ai-manual-scan-sheet-patch',
  'ai-manual-scan-v7',
  'ai-sheet-v8',
  'ai-safe-sheet-v9',
  'ai-native-sheet-v10',
  'ai-native-sheet-v11',
  'ai-native-sheet-v12',
  'ai-native-sheet-v13',
  'ai-final-native-v14',
  'ai-final-native-v15'
];

for (const name of oldScripts) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  html = html.replace(
    new RegExp(
      `\\s*<script\\s+src=["']\\.\\/${escaped}\\.js(?:\\?v=[^"']*)?["']\\s+defer><\\/script>\\s*`,
      'ig'
    ),
    '\n'
  );
}

/* Remove old v7 injected style layer. */
html = html.replace(
  /\s*<style id=["']mf-ai-manual-scan-style-v7["'][\s\S]*?<\/style>\s*/ig,
  '\n'
);

const tag = '<script src="./ai-final-native-v15.js?v=15.0.0" defer></script>';

if (!/<\/body>/i.test(html)) {
  console.error('MEMEFLOW FINAL v15: </body> not found. Restoring backup.');
  fs.copyFileSync(backup, target);
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tag}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

fs.copyFileSync(
  path.join(__dirname, 'ai-final-native-v15.js'),
  path.join(dir, 'ai-final-native-v15.js')
);

/* Remove obsolete patch files from app folder. */
for (const name of oldScripts) {
  if (name === 'ai-final-native-v15') continue;

  const file = path.join(dir, `${name}.js`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

console.log(`MEMEFLOW FINAL AI v15 installed in: ${path.relative(root, target)}`);
console.log(`Backup created: ${path.relative(root, backup)}`);
console.log('Removed v7-v14 AI patch runtime layers.');
console.log('One AI runtime remains: ai-final-native-v15.js');
console.log('Legacy MEMEFLOW OpenAI modal will be captured exactly and force-hidden.');
console.log('Native .mobile-sheet is the only visible AI window.');
console.log('No MutationObserver loops or continuous full-DOM scans.');
console.log('Script tag: ai-final-native-v15.js?v=15.0.0');
