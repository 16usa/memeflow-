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
  console.error('V56 VERIFY: project not found.');
  process.exit(1);
}

const html = fs.readFileSync(path.join(appDir,'index.html'),'utf8');
const runtime = path.join(appDir,'primary-cyan-native-states-v56.js');
const js = fs.existsSync(runtime) ? fs.readFileSync(runtime,'utf8') : '';

const checks = [
  ['runtime exists', fs.existsSync(runtime)],
  ['V56 tag once', (html.match(/primary-cyan-native-states-v56\.js\?v=56\.0\.0/g)||[]).length === 1],
  ['V54 active tag absent', !/global-primary-cyan-v54\.js(?:\?[^"']*)?["']/i.test(html)],
  ['V55 active tag absent', !/global-primary-cyan-v55\.js(?:\?[^"']*)?["']/i.test(html)],
  ['OpenAI cyan fallback present', js.includes('97, g: 223, b: 255')],
  ['native state sampled', js.includes('nativeSnapshot') && js.includes('getComputedStyle(el)')],
  ['brightness mapped to cyan', js.includes('mappedCyan') && js.includes('perceived01')],
  ['opacity untouched', !js.includes("setProperty('opacity'")],
  ['filter untouched', !js.includes("setProperty('filter'")],
  ['transform untouched', !js.includes("setProperty('transform'")],
  ['transition untouched', !js.includes("setProperty('transition'")],
  ['disabled attribute untouched', !js.includes("setAttribute('disabled'") && !js.includes('el.disabled =')],
  ['loading state untouched', !js.includes("setAttribute('aria-busy'")],
  ['pseudo-state resampling present', js.includes("pointerdown") && js.includes("pointerup") && js.includes("mouseover")],
  ['destructive controls excluded', /disconnect\|delete\|remove\|danger\|destructive/.test(js)],
  ['navigation excluded', js.includes('.mobile-nav') && js.includes('[role="navigation"]')],
  ['no fetch/API logic', !js.includes('fetch(') && !js.includes('/api/')],
  ['no click interception', !js.includes("addEventListener('click'")],
  ['runtime syntax', spawnSync(process.execPath,['--check',runtime]).status === 0],
  ['rollback backup exists', fs.existsSync(path.join(appDir,'.memeflow-v56-backup','index.html'))]
];

console.log('=== V56 VERIFY ===');
for (const [name, ok] of checks) console.log(`${ok?'PASS':'FAIL'}  ${name}`);

const failed = checks.filter(([,ok]) => !ok);
if (failed.length) {
  console.error(`V56 VERIFY FAILED: ${failed.length}`);
  process.exit(1);
}

console.log('V56 VERIFY OK: 20/20');
