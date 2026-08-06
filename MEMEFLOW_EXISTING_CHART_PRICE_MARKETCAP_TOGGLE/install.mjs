import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const appDir = fs.existsSync(path.join(root, 'memeflow-app'))
  ? path.join(root, 'memeflow-app')
  : root;

const target = path.join(appDir, 'index.html');
if (!fs.existsSync(target)) {
  console.error(`INSTALL ABORTED: ${target} not found.`);
  process.exit(1);
}

const backup = `${target}.before-existing-chart-metric-toggle`;
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);

let html = fs.readFileSync(target, 'utf8');
const marker = 'MEMEFLOW_EXISTING_CHART_PRICE_MARKETCAP_TOGGLE';

if (html.includes(marker)) {
  console.log('Toggle is already installed. No duplicate changes made.');
  process.exit(0);
}

if (!html.includes('id="marketChart"') || !html.includes('class="chart-toolbar"')) {
  console.error('INSTALL ABORTED: existing Market Chart toolbar was not found.');
  process.exit(1);
}

const css = fs.readFileSync(path.join(here, 'toggle.css'), 'utf8');
const js = fs.readFileSync(path.join(here, 'toggle.js'), 'utf8');

if (!html.includes('</head>') || !html.includes('</body>')) {
  console.error('INSTALL ABORTED: document closing tags were not found.');
  process.exit(1);
}

html = html.replace('</head>', `<style id="${marker}">\n${css}\n</style>\n</head>`);
html = html.replace('</body>', `<script id="${marker}-JS">\n${js}\n</script>\n</body>`);

fs.writeFileSync(target, html, 'utf8');

console.log('Installed Price / Market Cap toggle inside the existing Market Chart.');
console.log(`Changed: ${target}`);
console.log(`Backup:  ${backup}`);
console.log('No canvas was created, replaced, hidden, or resized.');