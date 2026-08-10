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
  console.error('MEMEFLOW v20: index.html not found.');
  process.exit(1);
}

const appDir = path.dirname(target);
const backup = target + '.pre-ai-ui-v20.bak';
fs.copyFileSync(target, backup);

const v19Config = path.join(appDir, 'ai-direct-evaluator-v19-config.js');
const v20Config = path.join(appDir, 'ai-direct-evaluator-v20-config.js');

if (fs.existsSync(v19Config)) {
  const oldConfig = fs.readFileSync(v19Config, 'utf8')
    .replace(/__MEMEFLOW_AI_DIRECT_V19_CONFIG__/g, '__MEMEFLOW_AI_DIRECT_V20_CONFIG__');
  fs.writeFileSync(v20Config, oldConfig, 'utf8');
  console.log('Evaluator config preserved from V19 (no endpoint change).');
} else {
  console.error('MEMEFLOW v20: V19 evaluator config was not found.');
  console.error('Install V19 first or restore the V19 config; no changes were made.');
  fs.copyFileSync(backup, target);
  process.exit(1);
}

fs.copyFileSync(
  path.join(__dirname, 'ai-direct-evaluator-v20.js'),
  path.join(appDir, 'ai-direct-evaluator-v20.js')
);

let html = fs.readFileSync(target, 'utf8');

html = html.replace(
  /\s*<script\s+src=["']\.\/(?:ai-direct-evaluator-v19|ai-direct-evaluator-v19-config|ai-direct-evaluator-v20|ai-direct-evaluator-v20-config)\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);

/* Remove obsolete navigation patch layers if any survived older installs. */
html = html.replace(
  /\s*<script\s+src=["']\.\/(?:ai-bottom-nav-patch|ai-manual-scan-v7)\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);

const tags = [
  '<script src="./ai-direct-evaluator-v20-config.js?v=20.0.0" defer></script>',
  '<script src="./ai-direct-evaluator-v20.js?v=20.0.0" defer></script>'
].join('\n');

if (!/<\/body>/i.test(html)) {
  fs.copyFileSync(backup, target);
  console.error('MEMEFLOW v20: </body> not found. Backup restored.');
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tags}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

/* Remove only obsolete patch runtime files. */
for (const name of [
  'ai-direct-evaluator-v19.js',
  'ai-direct-evaluator-v19-config.js',
  'ai-bottom-nav-patch.js',
  'ai-manual-scan-v7.js'
]) {
  const p = path.join(appDir, name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

console.log(`MEMEFLOW AI UI v20 installed in: ${path.relative(root,target)}`);
console.log(`Backup created: ${path.relative(root,backup)}`);
console.log('Direct evaluator logic/config preserved from V19.');
console.log('Mobile layout: Home | Candidates | ✦ | Positions | More');
console.log('Wallet moved to the top-right control row as an icon.');
console.log('Large Open AI assistant CTA hidden on mobile only.');
console.log('No new AI modal layer was added.');
console.log('Script tags: ai-direct-evaluator-v20-config.js + ai-direct-evaluator-v20.js');
