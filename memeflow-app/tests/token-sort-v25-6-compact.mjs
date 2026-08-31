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
  /MEMEFLOW_GMGN_SORT_STYLE_V25_6_COMPACT_FROM_V25_4/
);

assert.doesNotMatch(
  css,
  /MEMEFLOW_GMGN_SORT_STYLE_V25_4_EXACT/
);

assert.match(
  css,
  /\.mf-sort-sheet-v25\s*\{[\s\S]*max-height:300px;[\s\S]*overflow:hidden;/
);

assert.match(
  css,
  /\.mf-sort-row-v25\s*\{[\s\S]*min-height:29px;/
);

assert.match(
  css,
  /\.mf-sort-direction-v25 button\s*\{[\s\S]*min-height:20px;/
);

assert.match(
  css,
  /\.mf-sort-sheet-head-v25 h2\s*\{[\s\S]*font-size:10.5px;/
);

assert.match(
  css,
  /\.mf-sort-radio-v25\s*\{[\s\S]*width:12.5px;[\s\S]*height:12.5px;/
);

// MEMEFLOW_TEST_ARCHITECTURE_CLEANUP_V35_7
assert.match(html,/href="\/system-tokens\.css\?v=[^"]+"/);
assert.match(html,/src="\/system-tokens\.js\?v=[^"]+"/);
assert.equal((html.match(/\/system-tokens\.css\?v=/g)||[]).length,1);
assert.equal((html.match(/\/system-tokens\.js\?v=/g)||[]).length,1);

console.log('token sort v25.6 compact from v25.4 ok');
