#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const target = [
  path.join(root,'memeflow-app','index.html'),
  path.join(root,'index.html'),
  path.join(root,'artifacts','memeflow','index.html')
].find(p => fs.existsSync(p));

if (!target) {
  console.error('V41: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const runtimeSrc = path.resolve('MEMEFLOW_HEADER_WALLET_RESTORE_V41','header-wallet-restore-v41.js');
const runtimeDst = path.join(appDir,'header-wallet-restore-v41.js');
const backup = `${target}.pre-v41.bak`;

if (!fs.existsSync(runtimeSrc)) {
  console.error('V41: runtime source missing.');
  process.exit(1);
}

const TAG = '<script src="./header-wallet-restore-v41.js?v=41.0.0"></script>';
const oldPatterns = [
  /\n?\s*<script[^>]+(?:responsive-wallet-restore-v35|current-replit-wallet-fix-v34|github-native-wallet-v33|github-wallet-fix-v32|remove-duplicate-wallet-v31|wallet-layout-fix-v27)\.js\?v=[^"']+["'][^>]*><\/script>\s*/gi,
  /\n?\s*<script[^>]+header-wallet-restore-v41\.js\?v=41\.0\.0["'][^>]*><\/script>\s*/gi
];

let html = fs.readFileSync(target,'utf8');
if (!fs.existsSync(backup)) fs.writeFileSync(backup, html);
oldPatterns.forEach(rx => { html = html.replace(rx,'\n'); });

if (html.includes('</body>')) html = html.replace('</body>', `  ${TAG}\n</body>`);
else html += `\n${TAG}\n`;

fs.copyFileSync(runtimeSrc, runtimeDst);
fs.writeFileSync(target, html);

console.log(`V41 installed in: ${target}`);
console.log(`Backup: ${backup}`);
console.log('Phone: one header wallet only.');
console.log('Tablet: wallet in bottom nav.');
console.log('Desktop: wallet in original sidebar/header layout.');
