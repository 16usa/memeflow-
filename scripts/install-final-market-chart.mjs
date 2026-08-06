#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve(process.argv[2] || 'memeflow-app/index.html');
const scriptFile = path.resolve('memeflow-app/market-chart-final.js');
if (!fs.existsSync(target)) throw new Error(`Missing ${target}`);
if (!fs.existsSync(scriptFile)) throw new Error(`Missing ${scriptFile}`);

let html = fs.readFileSync(target, 'utf8');
const backup = `${target}.before-final-shadow-chart`;
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);

const oldScriptIds = [
  'MEMEFLOW_PREMIUM_CANDLESTICK_CHART_V1',
  'MEMEFLOW_SAFE_CANDLESTICK_CHART_V2',
  'MEMEFLOW_CANDLESTICK_FINAL_FIX_V3',
  'MEMEFLOW_NATIVE_OHLC_CHART_V1',
  'MEMEFLOW_OHLC_LAYOUT_CLEANUP_V1'
];
for (const id of oldScriptIds) {
  html = html.replace(new RegExp(`<script[^>]*id=["']${id}["'][\\s\\S]*?<\\/script>\\s*`, 'g'), '');
}
html = html.replace(/<script[^>]*src=["']\.?\/?market-chart-final\.js["'][^>]*><\/script>\s*/g, '');

const tag = '<script src="/market-chart-final.js"></script>';
const bodyEnd = html.lastIndexOf('</body>');
if (bodyEnd < 0) throw new Error('Missing </body>');
html = html.slice(0, bodyEnd) + tag + '\n' + html.slice(bodyEnd);
fs.writeFileSync(target, html, 'utf8');

const count = (html.match(/market-chart-final\.js/g) || []).length;
if (count !== 1) throw new Error(`Validation failed: script references=${count}`);

console.log('SUCCESS: Final isolated Market Chart installed.');
console.log(`Updated: ${target}`);
console.log(`Backup: ${backup}`);
