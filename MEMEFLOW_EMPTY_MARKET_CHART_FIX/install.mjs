import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const appDir = fs.existsSync(path.join(root, 'memeflow-app'))
  ? path.join(root, 'memeflow-app')
  : root;

const jsTarget = path.join(appDir, 'paper-automation-ui.js');
const htmlTarget = path.join(appDir, 'index.html');

for (const target of [jsTarget, htmlTarget]) {
  if (!fs.existsSync(target)) {
    console.error(`INSTALL ABORTED: ${target} not found.`);
    process.exit(1);
  }
}

const jsBackup = `${jsTarget}.before-empty-market-chart-fix`;
const htmlBackup = `${htmlTarget}.before-empty-market-chart-fix`;

if (!fs.existsSync(jsBackup)) fs.copyFileSync(jsTarget, jsBackup);
if (!fs.existsSync(htmlBackup)) fs.copyFileSync(htmlTarget, htmlBackup);

let js = fs.readFileSync(jsTarget, 'utf8');
const patch = fs.readFileSync(path.join(here, 'empty-market-chart.js'), 'utf8');
const jsMarker = 'window.__MEMEFLOW_EMPTY_MARKET_CHART_FIX__';

if (!js.includes(jsMarker)) {
  js = `${js.trimEnd()}\n\n${patch}\n`;
  fs.writeFileSync(jsTarget, js, 'utf8');
}

let html = fs.readFileSync(htmlTarget, 'utf8');
const css = fs.readFileSync(path.join(here, 'empty-market-chart.css'), 'utf8');
const cssMarker = 'MEMEFLOW_EMPTY_MARKET_CHART_FIX';

if (!html.includes(cssMarker)) {
  const closeHead = '</head>';
  if (!html.includes(closeHead)) {
    console.error('INSTALL ABORTED: </head> not found.');
    fs.copyFileSync(jsBackup, jsTarget);
    process.exit(1);
  }
  html = html.replace(closeHead, `<style>\n${css}\n</style>\n${closeHead}`);
  fs.writeFileSync(htmlTarget, html, 'utf8');
}

console.log('Installed MEMEFLOW empty Market Chart fix.');
console.log(`Changed: ${jsTarget}`);
console.log(`Changed: ${htmlTarget}`);
console.log('When no active candidate exists, stale price, percent, age and candles are hidden.');
console.log('A new active candidate automatically restores the live chart.');