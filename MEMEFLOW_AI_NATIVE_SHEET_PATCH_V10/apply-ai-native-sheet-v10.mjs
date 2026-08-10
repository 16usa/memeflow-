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
  console.error('MEMEFLOW v10: index.html not found.');
  process.exit(1);
}

let html = fs.readFileSync(target, 'utf8');

if (!/id=["']mfManualAiButton["']/i.test(html)) {
  console.error('MEMEFLOW v10: stable Manual AI button was not found. No changes made.');
  process.exit(1);
}

if (!/ai-manual-scan-v7\.js/i.test(html)) {
  console.error('MEMEFLOW v10: stable v7 AI launcher bridge was not found. No changes made.');
  process.exit(1);
}

const dir = path.dirname(target);
const backup = target + '.pre-ai-v10.bak';

fs.copyFileSync(target, backup);

// Remove v8/v9/v10 sheet script tags only. Preserve stable v7.
html = html.replace(
  /\s*<script\s+src=["']\.\/ai-sheet-v8\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);

html = html.replace(
  /\s*<script\s+src=["']\.\/ai-safe-sheet-v9\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);

html = html.replace(
  /\s*<script\s+src=["']\.\/ai-native-sheet-v10\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);

const tag = '<script src="./ai-native-sheet-v10.js?v=10.0.0" defer></script>';

if (!/<\/body>/i.test(html)) {
  console.error('MEMEFLOW v10: </body> not found. Restoring backup.');
  fs.copyFileSync(backup, target);
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tag}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

fs.copyFileSync(
  path.join(__dirname, 'ai-native-sheet-v10.js'),
  path.join(dir, 'ai-native-sheet-v10.js')
);

// Remove broken/obsolete runtime sheet files if present.
// Stable v7 files are intentionally untouched.
for (const name of ['ai-sheet-v8.js', 'ai-safe-sheet-v9.js']) {
  const file = path.join(dir, name);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

console.log(`MEMEFLOW AI native sheet v10 installed in: ${path.relative(root, target)}`);
console.log(`Backup created: ${path.relative(root, backup)}`);
console.log('Stable v7 Manual AI button preserved.');
console.log('Bottom nav preserved: Home / Candidates / Positions / Wallet / More');
console.log('Native AI .mobile-sheet added without reparenting the original OpenAI DOM.');
console.log('Script tag: ai-native-sheet-v10.js?v=10.0.0');
