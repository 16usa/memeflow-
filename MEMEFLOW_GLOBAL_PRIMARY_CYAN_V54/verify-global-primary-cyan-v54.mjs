#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {spawnSync} from 'child_process';

const root = process.cwd();
const appDir = [
  path.join(root,'memeflow-app'),
  root,
  path.join(root,'artifacts','memeflow')
].find(p => fs.existsSync(path.join(p,'index.html')));

if (!appDir) {
  console.error('V54 VERIFY: project not found.');
  process.exit(1);
}

const indexPath = path.join(appDir,'index.html');
const runtimePath = path.join(appDir,'global-primary-cyan-v54.js');
const html = fs.readFileSync(indexPath,'utf8');
const js = fs.existsSync(runtimePath) ? fs.readFileSync(runtimePath,'utf8') : '';

const checks = [
  ['runtime file exists', fs.existsSync(runtimePath)],
  ['V54 tag once', (html.match(/global-primary-cyan-v54\.js\?v=54\.0\.0/g)||[]).length === 1],
  ['exact OpenAI cyan', js.includes("#61DFFF")],
  ['visual only: no fetch/API', !js.includes('fetch(') && !js.includes('/api/')],
  ['no click handler replacement', !js.includes("addEventListener('click'")],
  ['no DOM replacement', !js.includes('.innerHTML=') && !js.includes('cloneNode')],
  ['no geometry overrides', !/width\s*:|height\s*:|padding\s*:|margin\s*:|border-radius\s*:/.test(js.match(/style\.textContent\s*=\s*`([\s\S]*?)`;/)?.[1] || '')],
  ['disabled controls excluded', js.includes("el.disabled === true") && js.includes("aria-disabled")],
  ['destructive controls excluded', /disconnect\|delete\|remove\|danger\|destructive/.test(js)],
  ['navigation excluded', js.includes('.mobile-nav') && js.includes('[role="navigation"]')],
  ['light-fill detection present', js.includes('isLightFilled') && js.includes('luminance(bg)')],
  ['runtime syntax', fs.existsSync(runtimePath) && spawnSync(process.execPath,['--check',runtimePath]).status === 0],
  ['rollback backup exists', fs.existsSync(path.join(appDir,'.memeflow-v54-backup','index.html'))]
];

console.log('=== V54 VERIFY ===');
for (const [name, ok] of checks) console.log(`${ok?'PASS':'FAIL'}  ${name}`);

const failed = checks.filter(([,ok]) => !ok);
if (failed.length) {
  console.error(`V54 VERIFY FAILED: ${failed.length}`);
  process.exit(1);
}

console.log('V54 VERIFY OK: 13/13');
