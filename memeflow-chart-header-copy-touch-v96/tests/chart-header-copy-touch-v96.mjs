import assert from 'node:assert/strict';
import fs from 'node:fs';

const header = fs.readFileSync(new URL('../chart-header-geometry-v95-1.css', import.meta.url), 'utf8');
const accessibility = fs.readFileSync(new URL('../memeflow-accessibility-usability-v64a.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../trading.html', import.meta.url), 'utf8');

assert.match(
  accessibility,
  /@media\s*\(pointer:\s*coarse\)[\s\S]*?button[\s\S]*?min-block-size:\s*44px;/
);

assert.match(
  header,
  /#copyMintBtn\s*\{[\s\S]*?min-block-size:\s*0\s*!important;[\s\S]*?min-height:\s*0\s*!important;[\s\S]*?height:\s*auto\s*!important;[\s\S]*?position:\s*relative\s*!important;/
);

assert.match(
  header,
  /#copyMintBtn::before\s*\{[\s\S]*?position:\s*absolute\s*!important;[\s\S]*?width:\s*44px\s*!important;[\s\S]*?height:\s*44px\s*!important;/
);

assert.match(header, /height:\s*64px\s*!important;/);
assert.match(header, /padding:\s*8px 9px\s*!important;/);
assert.match(header, /width:\s*36px\s*!important;/);
assert.match(header, /grid-template-columns:\s*46px minmax\(0,\s*1fr\)\s*!important;/);
assert.match(header, /column-gap:\s*7px\s*!important;/);

assert.match(
  html,
  /chart-header-geometry-v95-1\.css\?v=chart-header-copy-touch-v96-20260909/
);

for (const forbidden of [
  '.chart-wrap',
  '#chartCanvas',
  '.timeframes',
  '.chart-legend',
  '.indicator-bar',
  '.selected-metrics'
]) {
  assert.ok(!header.includes(forbidden), `forbidden chart selector found: ${forbidden}`);
}

console.log('chart-header-copy-touch-v96: ok');
