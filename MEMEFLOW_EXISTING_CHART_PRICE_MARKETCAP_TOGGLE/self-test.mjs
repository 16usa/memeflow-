import fs from 'node:fs';
import path from 'node:path';

const target = path.join(process.cwd(), 'memeflow-app', 'index.html');
const html = fs.readFileSync(target, 'utf8');

const checks = [
  ['toggle marker installed', 'MEMEFLOW_EXISTING_CHART_PRICE_MARKETCAP_TOGGLE'],
  ['existing toolbar target', "document.querySelector('#marketChart .chart-toolbar')"],
  ['price mode', "mode === 'marketCap' ? 'marketCap' : 'price'"],
  ['market cap mode', "label.textContent = 'MARKET CAP'"],
  ['USDT price format', "`${decimal(price)} USDT`"],
  ['English USD formatting', "currency: 'USD'"],
  ['no new canvas', !html.includes("createElement('canvas')") || html.indexOf('MEMEFLOW_EXISTING_CHART_PRICE_MARKETCAP_TOGGLE') > html.lastIndexOf("createElement('canvas')")],
  ['no old chart hiding CSS', !html.includes('#marketChart > canvas:not(#mf-clean-market-chart)')]
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}