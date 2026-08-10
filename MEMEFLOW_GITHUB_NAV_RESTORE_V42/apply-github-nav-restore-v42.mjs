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
if (!target) { console.error('V42: index.html not found.'); process.exit(1); }

const appDir = path.dirname(target);
const backup = target + '.pre-github-nav-v42.bak';
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
let html = fs.readFileSync(target,'utf8');

const nativeWalletBefore = /id=["']walletConnectTop["']/i.test(html);
const bottomWallet = /data-sheet=["']wallet["']/i.test(html);
const aiRuntimeFiles = fs.readdirSync(appDir).filter(n => /^ai-direct-evaluator-v\d+\.js$/i.test(n));

console.log('=== V42 PRE-INSTALL DETECTION ===');
console.log(`GitHub-native #walletConnectTop in current Replit HTML: ${nativeWalletBefore ? 'YES' : 'NO'}`);
console.log(`Existing bottom Wallet route [data-sheet="wallet"]: ${bottomWallet ? 'YES' : 'NO'}`);
console.log(`AI direct runtime(s): ${aiRuntimeFiles.length ? aiRuntimeFiles.join(', ') : 'NONE'}`);

if (!bottomWallet) {
  console.error('V42: bottom Wallet route is missing. Refusing to patch.');
  process.exit(1);
}

const oldRuntimeNames = [
  'responsive-wallet-restore-v35',
  'header-wallet-restore-v41',
  'ai-sparkles-icon-v36',
  'ai-icon-compact-v37',
  'ai-icon-final-v38',
  'ai-icon-center-v39',
  'ai-icon-true-center-v40',
  'github-nav-restore-v42'
];
for (const name of oldRuntimeNames) {
  const rx = new RegExp(`\\s*<script\\b[^>]*src=["']\\./${name}\\.js(?:\\?[^"']*)?["'][^>]*><\\/script>\\s*`, 'ig');
  html = html.replace(rx, '\n');
}

const tag = '<script src="./github-nav-restore-v42.js?v=42.0.0" defer></script>';
if (!/<\/body>/i.test(html)) {
  console.error('V42: </body> not found.');
  process.exit(1);
}
html = html.replace(/<\/body>/i, `${tag}\n</body>`);
fs.writeFileSync(target, html, 'utf8');
fs.copyFileSync(path.join(__dirname,'github-nav-restore-v42.js'), path.join(appDir,'github-nav-restore-v42.js'));

const out = fs.readFileSync(target,'utf8');
const tagPos = out.lastIndexOf('github-nav-restore-v42.js?v=42.0.0');
const lastAiTagPos = Math.max(
  out.lastIndexOf('ai-direct-evaluator-v'),
  out.lastIndexOf('ai-nav-layout-v')
);

const checks = [
  ['bottom Wallet route preserved', /data-sheet=["']wallet["']/i.test(out)],
  ['V42 tag exactly once', (out.match(/github-nav-restore-v42\.js\?v=42\.0\.0/g)||[]).length === 1],
  ['V42 loads after AI/nav runtime tags', lastAiTagPos < 0 || tagPos > lastAiTagPos],
  ['V42 runtime exists', fs.existsSync(path.join(appDir,'github-nav-restore-v42.js'))],
  ['old V35/V36/V37/V38/V39/V40/V41 tags removed', !/(responsive-wallet-restore-v35|header-wallet-restore-v41|ai-sparkles-icon-v36|ai-icon-compact-v37|ai-icon-final-v38|ai-icon-center-v39|ai-icon-true-center-v40)\.js/i.test(out)]
];

console.log('=== MEMEFLOW V42 INSTALL CHECK ===');
for (const [label,ok] of checks) console.log(`${ok?'PASS':'FAIL'}  ${label}`);
const failed = checks.filter(([,ok])=>!ok);
if (failed.length) {
  fs.copyFileSync(backup,target);
  console.error(`V42 FAILED: ${failed.length} check(s). Backup restored.`);
  process.exit(1);
}
console.log('V42 INSTALL OK: 5/5');
console.log('After reload V42 will recreate #walletConnectTop if your local Replit HTML lost it.');
console.log('Phone nav is hard-reset to 76px and AI is centered as a true overlay.');
