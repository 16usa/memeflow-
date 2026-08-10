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
  console.error('ROLLBACK v10: index.html not found.');
  process.exit(1);
}

const backup = target + '.pre-ai-v10.bak';

if (fs.existsSync(backup)) {
  fs.copyFileSync(backup, target);
  console.log(`ROLLBACK v10 OK: restored ${path.relative(root, backup)}`);
} else {
  let html = fs.readFileSync(target, 'utf8');

  html = html.replace(
    /\s*<script\s+src=["']\.\/ai-native-sheet-v10\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
    '\n'
  );

  fs.writeFileSync(target, html, 'utf8');

  console.log('ROLLBACK v10: backup not found; removed v10 script tag only.');
}

const runtime = path.join(path.dirname(target), 'ai-native-sheet-v10.js');
if (fs.existsSync(runtime)) fs.unlinkSync(runtime);
