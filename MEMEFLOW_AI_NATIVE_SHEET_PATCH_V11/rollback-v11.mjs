#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();

const candidates = [
  path.join(root, 'memeflow-app', 'index.html'),
  path.join(root, 'index.html'),
  path.join(root, 'artifacts', 'memeflow', 'index.html')
];

const target = candidates.find(p => fs.existsSync(p));

if (!target) {
  console.error('ROLLBACK v11: index.html not found.');
  process.exit(1);
}

let html = fs.readFileSync(target, 'utf8');

// Emergency rollback intentionally returns to stable v7, not the failed v10.
html = html.replace(
  /\s*<script\s+src=["']\.\/ai-native-sheet-v11\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);

html = html.replace(
  /\s*<script\s+src=["']\.\/ai-native-sheet-v10\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);

html = html.replace(
  /\s*<script\s+src=["']\.\/ai-safe-sheet-v9\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);

html = html.replace(
  /\s*<script\s+src=["']\.\/ai-sheet-v8\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);

fs.writeFileSync(target, html, 'utf8');

for (const name of ['ai-native-sheet-v11.js', 'ai-native-sheet-v10.js', 'ai-safe-sheet-v9.js', 'ai-sheet-v8.js']) {
  const file = path.join(path.dirname(target), name);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

console.log('ROLLBACK v11 OK: returned to stable v7 AI behavior.');
