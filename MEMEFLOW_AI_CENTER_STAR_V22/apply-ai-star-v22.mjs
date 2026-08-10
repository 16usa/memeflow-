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
  console.error('MEMEFLOW v22: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-ai-star-v22.bak';
fs.copyFileSync(target, backup);

const v21Config = path.join(appDir, 'ai-direct-evaluator-v21-config.js');
const v22Config = path.join(appDir, 'ai-direct-evaluator-v22-config.js');

if (!fs.existsSync(v21Config)) {
  console.error('MEMEFLOW v22: V21 evaluator config was not found.');
  console.error('No changes made.');
  fs.copyFileSync(backup, target);
  process.exit(1);
}

const cfg = fs.readFileSync(v21Config, 'utf8')
  .replace(/__MEMEFLOW_AI_DIRECT_V21_CONFIG__/g, '__MEMEFLOW_AI_DIRECT_V22_CONFIG__');

fs.writeFileSync(v22Config, cfg, 'utf8');

fs.copyFileSync(
  path.join(__dirname, 'ai-direct-evaluator-v22.js'),
  path.join(appDir, 'ai-direct-evaluator-v22.js')
);

let html = fs.readFileSync(target, 'utf8');

html = html.replace(
  /\s*<script\s+src=["']\.\/(?:ai-direct-evaluator-v21|ai-direct-evaluator-v21-config|ai-direct-evaluator-v22|ai-direct-evaluator-v22-config)\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);

const tags = [
  '<script src="./ai-direct-evaluator-v22-config.js?v=22.0.0" defer></script>',
  '<script src="./ai-direct-evaluator-v22.js?v=22.0.0" defer></script>'
].join('\n');

if (!/<\/body>/i.test(html)) {
  fs.copyFileSync(backup, target);
  console.error('MEMEFLOW v22: </body> not found. Backup restored.');
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tags}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

for (const name of [
  'ai-direct-evaluator-v21.js',
  'ai-direct-evaluator-v21-config.js'
]) {
  const p = path.join(appDir, name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

console.log(`MEMEFLOW AI center-star v22 installed in: ${path.relative(root,target)}`);
console.log(`Backup created: ${path.relative(root,backup)}`);
console.log('V21 evaluator config preserved unchanged.');
console.log('Fixed root cause: inherited grid-column placement removed from the AI star.');
console.log('Star position: absolute center of the full bottom nav (50% / 50%).');
console.log('Visual: star only — no border, box, background, or wrapper chrome.');
console.log('Wallet remains in the top-right header.');
