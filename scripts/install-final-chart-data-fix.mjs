#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const bundled=path.resolve(here,'../memeflow-app/market-chart-final.js');
const target=path.resolve('memeflow-app/market-chart-final.js');
if(!fs.existsSync(bundled)) throw new Error(`Bundled file missing: ${bundled}`);

const backup=`${target}.before-final-data-fix`;
if(fs.existsSync(target)&&!fs.existsSync(backup)) fs.copyFileSync(target,backup);

const staged=`${target}.new`;
fs.copyFileSync(bundled,staged);
fs.renameSync(staged,target);

console.log('SUCCESS: Final token image, scale and candle-density fixes installed.');
console.log(`Updated: ${target}`);
console.log(`Backup: ${backup}`);
