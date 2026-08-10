#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = process.cwd();
const target = [
  path.join(root,'memeflow-app','index.html'),
  path.join(root,'index.html'),
  path.join(root,'artifacts','memeflow','index.html')
].find(p => fs.existsSync(p));
if (!target) { console.error('V39: index.html not found.'); process.exit(1); }
const appDir = path.dirname(target);
const backup = target + '.pre-ai-icon-v39.bak';
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
let html = fs.readFileSync(target,'utf8');
if (!/class=["'][^"']*mobile-nav/i.test(html)) {
  console.error('V39: .mobile-nav not found.'); process.exit(1);
}
html = html.replace(/\s*<script\b[^>]*src=["']\.\/(?:ai-sparkles-icon-v36|ai-icon-compact-v37|ai-icon-final-v38|ai-icon-center-v39)\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/ig, '\n');
const tag = '<script src="./ai-icon-center-v39.js?v=39.0.0" defer></script>';
if (!/<\/body>/i.test(html)) { console.error('V39: </body> not found.'); process.exit(1); }
html = html.replace(/<\/body>/i, `${tag}\n</body>`);
fs.writeFileSync(target, html, 'utf8');
fs.copyFileSync(path.join(__dirname,'ai-icon-center-v39.js'), path.join(appDir,'ai-icon-center-v39.js'));
for (const old of ['ai-sparkles-icon-v36.js','ai-icon-compact-v37.js','ai-icon-final-v38.js']) {
  const p = path.join(appDir, old);
  if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch {}
}
const out = fs.readFileSync(target,'utf8');
const checks = [
  ['mobile nav preserved', /class=["'][^"']*mobile-nav/i.test(out)],
  ['old icon tags removed', !/(ai-sparkles-icon-v36|ai-icon-compact-v37|ai-icon-final-v38)\.js/i.test(out)],
  ['V39 tag exactly once', (out.match(/ai-icon-center-v39\.js\?v=39\.0\.0/g)||[]).length === 1],
  ['V39 runtime exists', fs.existsSync(path.join(appDir,'ai-icon-center-v39.js'))]
];
console.log('=== MEMEFLOW V39 INSTALL CHECK ===');
for (const [label, ok] of checks) console.log(`${ok?'PASS':'FAIL'}  ${label}`);
const failed = checks.filter(([,ok])=>!ok);
if (failed.length) {
  fs.copyFileSync(backup, target);
  console.error(`V39 FAILED: ${failed.length} check(s). Backup restored.`);
  process.exit(1);
}
console.log('V39 INSTALL OK: 4/4');
console.log('Centered AI icon applied.');
console.log('One compact 3-sparkle icon remains.');
