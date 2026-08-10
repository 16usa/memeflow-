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
  console.error('ROLLBACK: index.html not found.');
  process.exit(1);
}

const dir = path.dirname(target);
let html = fs.readFileSync(target, 'utf8');

// Remove v8 and any older AI patch script tags that can conflict.
html = html.replace(/\s*<script\s+src=["']\.\/(?:ai-sheet-v8|ai-bottom-nav-patch|ai-manual-scan-sheet-patch|ai-manual-scan-v7)\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig, '\n');

// Remove old v7 style block so we can restore one clean copy.
html = html.replace(/\s*<style id=["']mf-ai-manual-scan-style-v7["'][\s\S]*?<\/style>\s*/ig, '\n');

// Remove any source-inserted v7 button, then add one clean copy.
html = html.replace(/\s*<button[^>]*id=["']mfManualAiButton["'][\s\S]*?<\/button>\s*/ig, '\n');

const analyzeRe = /(<button\b[^>]*>\s*Analyze token\s*<\/button>)/i;
if (!analyzeRe.test(html)) {
  console.error('ROLLBACK: Analyze token button not found.');
  process.exit(1);
}

const aiBtn = `$1
<button id="mfManualAiButton" type="button" class="btn"><span class="mf-ai-mark">✦</span><span>Open AI assistant</span></button>`;
html = html.replace(analyzeRe, aiBtn);

// Restore v7 style.
const style = fs.readFileSync(path.join(__dirname, 'style-v7.html'), 'utf8');
if (!/<\/head>/i.test(html)) {
  console.error('ROLLBACK: </head> not found.');
  process.exit(1);
}
html = html.replace(/<\/head>/i, `${style}\n</head>`);

// Restore v7 JS.
fs.copyFileSync(
  path.join(__dirname, 'ai-manual-scan-v7.js'),
  path.join(dir, 'ai-manual-scan-v7.js')
);

const tag = '<script src="./ai-manual-scan-v7.js?v=7.0.1" defer></script>';
if (!/<\/body>/i.test(html)) {
  console.error('ROLLBACK: </body> not found.');
  process.exit(1);
}
html = html.replace(/<\/body>/i, `${tag}\n</body>`);

fs.writeFileSync(target, html, 'utf8');

// Delete v8 runtime file if present.
const v8File = path.join(dir, 'ai-sheet-v8.js');
if (fs.existsSync(v8File)) {
  fs.unlinkSync(v8File);
}

console.log(`ROLLBACK OK: restored v7 in ${path.relative(root, target)}`);
console.log('Removed: ai-sheet-v8.js / v8 script tag');
console.log('Restored: Open AI assistant button + v7 behavior');
console.log('Bottom nav: Home / Candidates / Positions / Wallet / More');
