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
  console.error('MEMEFLOW v24: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-ai-nav-v24.bak';
fs.copyFileSync(target, backup);

const v23Config = path.join(appDir, 'ai-direct-evaluator-v23-config.js');
const v24Config = path.join(appDir, 'ai-direct-evaluator-v24-config.js');

if (!fs.existsSync(v23Config)) {
  console.error('MEMEFLOW v24: V23 evaluator config was not found.');
  console.error('No changes made.');
  fs.copyFileSync(backup, target);
  process.exit(1);
}

const cfg = fs.readFileSync(v23Config, 'utf8')
  .replace(/__MEMEFLOW_AI_DIRECT_V23_CONFIG__/g, '__MEMEFLOW_AI_DIRECT_V24_CONFIG__');
fs.writeFileSync(v24Config, cfg, 'utf8');

fs.copyFileSync(
  path.join(__dirname, 'ai-direct-evaluator-v24.js'),
  path.join(appDir, 'ai-direct-evaluator-v24.js')
);

let html = fs.readFileSync(target, 'utf8');

/* Physically delete the old Open AI assistant CTA from MANUAL AI SCAN. */
const before = html;
html = html.replace(
  /<button\b(?=[^>]*\bid=["']mfManualAiButton["'])[^>]*>[\s\S]*?<\/button>\s*/ig,
  ''
);
const removedStaticButton = html !== before;

html = html.replace(
  /\s*<script\s+src=["']\.\/(?:ai-direct-evaluator-v23|ai-direct-evaluator-v23-config|ai-direct-evaluator-v24|ai-direct-evaluator-v24-config)\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);

const tags = [
  '<script src="./ai-direct-evaluator-v24-config.js?v=24.0.0" defer></script>',
  '<script src="./ai-direct-evaluator-v24.js?v=24.0.0" defer></script>'
].join('\n');

if (!/<\/body>/i.test(html)) {
  fs.copyFileSync(backup, target);
  console.error('MEMEFLOW v24: </body> not found. Backup restored.');
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tags}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

for (const name of [
  'ai-direct-evaluator-v23.js',
  'ai-direct-evaluator-v23-config.js'
]) {
  const p = path.join(appDir, name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

console.log(`MEMEFLOW AI nav v24 installed in: ${path.relative(root,target)}`);
console.log(`Backup created: ${path.relative(root,backup)}`);
console.log('V23 evaluator config preserved unchanged.');
console.log(`Static Open AI assistant CTA removed: ${removedStaticButton ? 'YES' : 'not present in static HTML; runtime removal enabled'}`);
console.log('MANUAL AI SCAN no longer contains the Open AI assistant CTA.');
console.log('Center AI nav opens MEMEFLOW OpenAI directly; no proxy/hidden Manual button is used.');
console.log('PHONE: Home | Candidates | ✦ | Positions | More');
console.log('TABLET/DESKTOP: Home | Candidates | ✦ AI | Positions | More');
console.log('Wallet remains top-right.');
console.log('AI evaluator logic unchanged.');
