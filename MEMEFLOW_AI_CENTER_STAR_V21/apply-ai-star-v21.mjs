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
  console.error('MEMEFLOW v21: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-ai-star-v21.bak';
fs.copyFileSync(target, backup);

const v20Config = path.join(appDir, 'ai-direct-evaluator-v20-config.js');
const v21Config = path.join(appDir, 'ai-direct-evaluator-v21-config.js');

if (!fs.existsSync(v20Config)) {
  console.error('MEMEFLOW v21: V20 evaluator config was not found.');
  console.error('No changes made.');
  fs.copyFileSync(backup, target);
  process.exit(1);
}

const cfg = fs.readFileSync(v20Config, 'utf8')
  .replace(/__MEMEFLOW_AI_DIRECT_V20_CONFIG__/g, '__MEMEFLOW_AI_DIRECT_V21_CONFIG__');

fs.writeFileSync(v21Config, cfg, 'utf8');

fs.copyFileSync(
  path.join(__dirname, 'ai-direct-evaluator-v21.js'),
  path.join(appDir, 'ai-direct-evaluator-v21.js')
);

let html = fs.readFileSync(target, 'utf8');

html = html.replace(
  /\s*<script\s+src=["']\.\/(?:ai-direct-evaluator-v20|ai-direct-evaluator-v20-config|ai-direct-evaluator-v21|ai-direct-evaluator-v21-config)\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);

const tags = [
  '<script src="./ai-direct-evaluator-v21-config.js?v=21.0.0" defer></script>',
  '<script src="./ai-direct-evaluator-v21.js?v=21.0.0" defer></script>'
].join('\n');

if (!/<\/body>/i.test(html)) {
  fs.copyFileSync(backup, target);
  console.error('MEMEFLOW v21: </body> not found. Backup restored.');
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tags}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

for (const name of [
  'ai-direct-evaluator-v20.js',
  'ai-direct-evaluator-v20-config.js'
]) {
  const p = path.join(appDir, name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

console.log(`MEMEFLOW AI center-star v21 installed in: ${path.relative(root,target)}`);
console.log(`Backup created: ${path.relative(root,backup)}`);
console.log('V20 evaluator config preserved unchanged.');
console.log('Bottom nav: Home | Candidates | ✦ | Positions | More');
console.log('AI center control: visual wrapper removed; only the star is visible.');
console.log('Star is absolutely centered in the nav row.');
console.log('Wallet remains in the top-right header icon.');
