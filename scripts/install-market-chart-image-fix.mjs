#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const source = path.resolve('memeflow-app/market-chart-final.js');
const target = path.resolve('memeflow-app/market-chart-final.js');
const staged = path.resolve('memeflow-app/market-chart-final.js.new');

if (!fs.existsSync(source)) throw new Error('Updated market-chart-final.js is missing from the patch.');

const patchRoot = path.dirname(new URL(import.meta.url).pathname);
const bundled = path.resolve(patchRoot, '../memeflow-app/market-chart-final.js');
if (!fs.existsSync(bundled)) throw new Error(`Bundled file missing: ${bundled}`);

const backup = `${target}.before-image-render-fix`;
if (fs.existsSync(target) && !fs.existsSync(backup)) fs.copyFileSync(target, backup);

fs.copyFileSync(bundled, staged);
fs.renameSync(staged, target);

console.log('SUCCESS: Token image and chart rendering fixes installed.');
console.log(`Updated: ${target}`);
console.log(`Backup: ${backup}`);
