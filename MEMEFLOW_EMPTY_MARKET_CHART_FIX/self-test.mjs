import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appDir = path.join(root, 'memeflow-app');
const js = fs.readFileSync(path.join(appDir, 'paper-automation-ui.js'), 'utf8');
const html = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');

const checks = [
  ['empty chart JS installed', js.includes('window.__MEMEFLOW_EMPTY_MARKET_CHART_FIX__')],
  ['candidate change listener', js.includes("memeflow:candidatechange")],
  ['empty-state text', js.includes('No active token')],
  ['stale chart hidden', js.includes('mf-market-chart-is-empty')],
  ['empty chart CSS installed', html.includes('MEMEFLOW_EMPTY_MARKET_CHART_FIX')]
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}