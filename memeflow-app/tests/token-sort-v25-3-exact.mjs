import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(
  new URL('../system-tokens.js',import.meta.url),
  'utf8'
);

const css=fs.readFileSync(
  new URL('../system-tokens.css',import.meta.url),
  'utf8'
);

const html=fs.readFileSync(
  new URL('../system-tokens.html',import.meta.url),
  'utf8'
);

assert.match(
  ui,
  /MEMEFLOW_GMGN_SORT_STYLE_V25_2_FINAL4/
);

assert.match(
  css,
  /MEMEFLOW_GMGN_SORT_STYLE_V25_3_EXACT/
);

assert.doesNotMatch(
  css,
  /MEMEFLOW_GMGN_SORT_STYLE_V25_2_FINAL4/
);

assert.match(
  css,
  /\.mf-sort-toolbar-v25\s*\{[^}]*grid-column:1\s*\/\s*-1;/s
);

assert.match(
  css,
  /\.mf-sort-trigger-v25\s*\{[^}]*min-height:32px;/s
);

assert.match(
  css,
  /backdrop-filter:none/
);

assert.match(
  css,
  /max-height:min\(45dvh,360px\)/
);

assert.match(
  css,
  /width:min\(calc\(100% - 14px\),520px\)/
);

assert.match(
  css,
  /\.mf-sort-direction-v25 button\s*\{[^}]*min-height:25px;/s
);

assert.match(
  css,
  /\.mf-sort-row-v25\s*\{[^}]*min-height:36px;/s
);

assert.match(
  css,
  /\.mf-sort-row-v25 \+ \.mf-sort-row-v25::before\s*\{[^}]*left:0;/s
);

assert.match(
  html,
  /system-tokens\.js\?v=gmgn-sort-v25-3-exact-20260827/
);

assert.match(
  html,
  /system-tokens\.css\?v=gmgn-sort-v25-3-exact-20260827/
);

console.log('token sort v25.3 exact ok');
