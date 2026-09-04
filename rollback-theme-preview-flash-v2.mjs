#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const app = fs.existsSync(path.join(root, 'memeflow-app')) ? path.join(root, 'memeflow-app') : root;
const backup = ".patch-backups/theme-preview-flash-v2-2026-09-04T01-57-31-227Z";

for (const name of ['system.html', 'system.js']) {
  const src = path.join(root, backup, name);
  const dst = path.join(app, name);
  if (!fs.existsSync(src)) throw new Error('Missing backup: ' + src);
  fs.copyFileSync(src, dst);
}

const css = path.join(app, 'theme-preview-flash-v2.css');
if (fs.existsSync(css)) fs.unlinkSync(css);

console.log('Rolled back MEMEFLOW_THEME_PREVIEW_FLASH_FIX_V2');
