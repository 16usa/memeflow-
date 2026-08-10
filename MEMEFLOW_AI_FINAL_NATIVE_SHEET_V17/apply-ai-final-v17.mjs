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
  console.error('MEMEFLOW FINAL v17: index.html not found.');
  process.exit(1);
}

let html = fs.readFileSync(target, 'utf8');
const dir = path.dirname(target);
const backup = target + '.pre-ai-final-v17.bak';

fs.copyFileSync(target, backup);

html = html.replace(/\s*<script\s+src=["']\.\/ai-final-native-v16\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig, '\n');
html = html.replace(/\s*<script\s+src=["']\.\/ai-final-native-v17\.js(?:\?v=[^"']*)?["']\s+defer><\/script>\s*/ig, '\n');

const tag = '<script src="./ai-final-native-v17.js?v=17.0.0" defer></script>';

if (!/<\/body>/i.test(html)) {
  console.error('MEMEFLOW FINAL v17: </body> not found.');
  process.exit(1);
}

html = html.replace(/<\/body>/i, `${tag}\n</body>`);
fs.writeFileSync(target, html, 'utf8');

fs.copyFileSync(path.join(__dirname, 'ai-final-native-v17.js'), path.join(dir, 'ai-final-native-v17.js'));

const oldRuntime = path.join(dir, 'ai-final-native-v16.js');
if (fs.existsSync(oldRuntime)) fs.unlinkSync(oldRuntime);

console.log(`MEMEFLOW FINAL AI v17 installed in: ${path.relative(root, target)}`);
console.log(`Backup created: ${path.relative(root, backup)}`);
console.log('v16 replaced by v17.');
console.log('Analyze token uses MANUAL AI SCAN in the background.');
console.log('OpenAI Assistant remains open and displays the manual result on the same page.');
console.log('Script tag: ai-final-native-v17.js?v=17.0.0');
