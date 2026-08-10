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
  console.error('MEMEFLOW v11: index.html not found.');
  process.exit(1);
}

let html = fs.readFileSync(target, 'utf8');

if (!/id=["']mfManualAiButton["']/i.test(html)) {
  console.error('MEMEFLOW v11: Manual AI button not found. No changes made.');
  process.exit(1);
}

if (!/ai-manual-scan-v7\.js/i.test(html)) {
  console.error('MEMEFLOW v11: stable v7 AI bridge not found. No changes made.');
  process.exit(1);
}

const dir = path.dirname(target);
const backup = target + '.pre-ai-v11.bak';
fs.copyFileSync(target, backup);

// Remove obsolete sheet layers. Keep stable v7.
for (const pattern of [
  /\s*<script\s+src=["']\.\/ai-sheet-v8\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  /\s*<script\s+src=["']\.\/ai-safe-sheet-v9\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  /\s*<script\s+src=["']\.\/ai-native-sheet-v10\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  /\s*<script\s+src=["']\.\/ai-native-sheet-v11\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig
]) {
  html = html.replace(pattern, '\n');
}

const tag = '<script src="./ai-native-sheet-v11.js?v=11.0.0" defer></script>';

if (!/<\/body>/i.test(html)) {
  console.error('MEMEFLOW v11: </body> not found. Restoring backup.');
  fs.copyFileSync(backup, target);
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tag}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

fs.copyFileSync(
  path.join(__dirname, 'ai-native-sheet-v11.js'),
  path.join(dir, 'ai-native-sheet-v11.js')
);

// Remove only obsolete runtime files.
for (const name of ['ai-sheet-v8.js', 'ai-safe-sheet-v9.js', 'ai-native-sheet-v10.js']) {
  const file = path.join(dir, name);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

console.log(`MEMEFLOW AI native sheet v11 installed in: ${path.relative(root, target)}`);
console.log(`Backup created: ${path.relative(root, backup)}`);
console.log('v10 removed.');
console.log('Stable v7 bridge preserved.');
console.log('v11 click interceptor installed before v7 onclick.');
console.log('Native sheet uses the same .mobile-sheet mechanism as Positions.');
console.log('Script tag: ai-native-sheet-v11.js?v=11.0.0');
