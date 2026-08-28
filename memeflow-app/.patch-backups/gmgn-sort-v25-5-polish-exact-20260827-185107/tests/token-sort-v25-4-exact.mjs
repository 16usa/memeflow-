import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(
  new URL('../system-tokens.css',import.meta.url),
  'utf8'
);

const html=fs.readFileSync(
  new URL('../system-tokens.html',import.meta.url),
  'utf8'
);

assert.match(
  css,
  /MEMEFLOW_GMGN_SORT_STYLE_V25_4_EXACT/
);

assert.doesNotMatch(
  css,
  /MEMEFLOW_GMGN_SORT_STYLE_V25_3_EXACT/
);

assert.match(
  css,
  /\.mf-sort-trigger-chevron-v251\s*\{[^}]*position:absolute;[^}]*right:13px;/s
);

assert.match(
  css,
  /\.mf-sort-trigger-v25\.is-active\s*\{[^}]*rgba\(77,230,161,.42\)/s
);

assert.match(
  css,
  /max-height:min\(54dvh,430px\)/
);

assert.match(
  css,
  /backdrop-filter:none/
);

assert.match(
  css,
  /\.mf-sort-row-v25 \+ \.mf-sort-row-v25::before\s*\{[^}]*left:0;/s
);

assert.match(
  html,
  /system-tokens\.js\?v=gmgn-sort-v25-4-exact-20260827/
);

assert.match(
  html,
  /system-tokens\.css\?v=gmgn-sort-v25-4-exact-20260827/
);

console.log('token sort v25.4 exact ok');
