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
  console.error('MEMEFLOW FINAL v16: index.html not found.');
  process.exit(1);
}

let html = fs.readFileSync(target, 'utf8');
const dir = path.dirname(target);
const backup = target + '.pre-ai-final-v16.bak';

fs.copyFileSync(target, backup);

if (!/id=["']mfManualAiButton["']/i.test(html)) {
  console.error('MEMEFLOW FINAL v16: Open AI assistant button not found. No changes made.');
  process.exit(1);
}

// Remove previous final v15/v16 runtime tag.
html = html.replace(
  /\s*<script\s+src=["']\.\/ai-final-native-v15\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);
html = html.replace(
  /\s*<script\s+src=["']\.\/ai-final-native-v16\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig,
  '\n'
);

const tag = '<script src="./ai-final-native-v16.js?v=16.0.0" defer></script>';

if (!/<\/body>/i.test(html)) {
  console.error('MEMEFLOW FINAL v16: </body> not found. Restoring backup.');
  fs.copyFileSync(backup, target);
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tag}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

fs.copyFileSync(
  path.join(__dirname, 'ai-final-native-v16.js'),
  path.join(dir, 'ai-final-native-v16.js')
);

const oldRuntime = path.join(dir, 'ai-final-native-v15.js');
if (fs.existsSync(oldRuntime)) fs.unlinkSync(oldRuntime);

console.log(`MEMEFLOW FINAL AI v16 installed in: ${path.relative(root, target)}`);
console.log(`Backup created: ${path.relative(root, backup)}`);
console.log('v15 replaced by v16.');
console.log('Analyze token now delegates to the real MANUAL AI SCAN evaluator.');
console.log('Analyze token no longer requires the OpenAI chat-credit path.');
console.log('Ask AI / Strategy / AUTO AI remain connected to the existing OpenAI backend.');
console.log('Script tag: ai-final-native-v16.js?v=16.0.0');
