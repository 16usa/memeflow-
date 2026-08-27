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
  /MEMEFLOW_GMGN_SORT_STYLE_V25_5_POLISH_EXACT/
);

assert.doesNotMatch(
  css,
  /MEMEFLOW_GMGN_SORT_STYLE_V25_4_EXACT/
);

assert.match(
  css,
  /background:rgba\(0,4,7,.035\)/
);

assert.match(
  css,
  /rgba\(25,39,48,.978\)/
);

assert.match(
  css,
  /font-weight:550/
);

assert.match(
  css,
  /color:#b9c9d0/
);

assert.match(
  css,
  /border:1.5px solid #62dff6/
);

assert.equal(
  (
    html.match(
      /gmgn-sort-v25-5-polish-exact-20260827/g
    )||[]
  ).length,
  2
);

console.log('token sort v25.5 polish exact ok');
