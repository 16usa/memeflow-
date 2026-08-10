#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = process.cwd();
const candidates = [
  path.join(root,'memeflow-app','index.html'),
  path.join(root,'index.html'),
  path.join(root,'artifacts','memeflow','index.html')
];
const target = candidates.find(fs.existsSync);
if(!target){console.error('MEMEFLOW patch: index.html not found.');process.exit(1)}
const dir = path.dirname(target);
fs.copyFileSync(path.join(__dirname,'ai-manual-scan-v7.js'),path.join(dir,'ai-manual-scan-v7.js'));
let html = fs.readFileSync(target,'utf8');

// Remove all older AI patch script tags so they cannot fight v7.
html = html.replace(/\s*<script\s+src=["']\.\/(?:ai-bottom-nav-patch|ai-manual-scan-sheet-patch|ai-manual-scan-v7)\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,'\n');
html = html.replace(/\s*<style id=["']mf-ai-manual-scan-style-v7["'][\s\S]*?<\/style>\s*/ig,'\n');

// Remove any old source-inserted v7 button before re-adding one.
html = html.replace(/\s*<button[^>]*id=["']mfManualAiButton["'][\s\S]*?<\/button>\s*/ig,'\n');

// Insert the button directly after the real Analyze token button.
const analyzeRe = /(<button\b[^>]*>\s*Analyze token\s*<\/button>)/i;
if(!analyzeRe.test(html)){
  console.error('MEMEFLOW patch v7: Analyze token button not found in index.html.');
  process.exit(1);
}
const aiBtn = `$1\n<button id="mfManualAiButton" type="button" class="btn"><span class="mf-ai-mark">✦</span><span>Open AI assistant</span></button>`;
html = html.replace(analyzeRe, aiBtn);

const style = fs.readFileSync(path.join(__dirname,'style-v7.html'),'utf8');
html = html.replace(/<\/head>/i, `${style}\n</head>`);
const tag = '<script src="./ai-manual-scan-v7.js?v=7.0.0" defer></script>';
html = html.replace(/<\/body>/i, `${tag}\n</body>`);
fs.writeFileSync(target,html,'utf8');
console.log(`MEMEFLOW AI manual-scan patch v7 installed in: ${path.relative(root,target)}`);
console.log('Inserted button directly after: Analyze token');
console.log('Restored bottom nav: Home / Candidates / Positions / Wallet / More');
console.log('AI overlay will be forced into a full-screen mobile sheet.');
