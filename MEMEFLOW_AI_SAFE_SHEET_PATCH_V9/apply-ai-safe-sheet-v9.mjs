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
  console.error('MEMEFLOW v9: index.html not found.');
  process.exit(1);
}

const dir = path.dirname(target);
let html = fs.readFileSync(target, 'utf8');

// Safety: v9 expects the stable v7 button state.
if (!/id=["']mfManualAiButton["']/i.test(html)) {
  console.error('MEMEFLOW v9: stable v7 Manual AI button not found. Patch aborted without changing index.html.');
  process.exit(1);
}

const backup = target + '.pre-ai-v9.bak';
fs.copyFileSync(target, backup);

// Remove only v8/v9 sheet script tags. Keep stable v7 intact.
html = html.replace(
  /\s*<script\s+src=["']\.\/ai-sheet-v8\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);
html = html.replace(
  /\s*<script\s+src=["']\.\/ai-safe-sheet-v9\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);

const tag = '<script src="./ai-safe-sheet-v9.js?v=9.0.0" defer></script>';

if (!/<\/body>/i.test(html)) {
  console.error('MEMEFLOW v9: </body> not found. Restoring backup.');
  fs.copyFileSync(backup, target);
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tag}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

fs.copyFileSync(
  path.join(__dirname, 'ai-safe-sheet-v9.js'),
  path.join(dir, 'ai-safe-sheet-v9.js')
);

// Remove the broken v8 runtime file if it still exists.
const v8 = path.join(dir, 'ai-sheet-v8.js');
if (fs.existsSync(v8)) fs.unlinkSync(v8);

console.log(`MEMEFLOW AI safe sheet v9 installed in: ${path.relative(root, target)}`);
console.log(`Backup created: ${path.relative(root, backup)}`);
console.log('Stable v7 button/navigation preserved.');
console.log('v9 does not move/reparent the OpenAI DOM.');
console.log('Script tag: ai-safe-sheet-v9.js?v=9.0.0');
