import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../system-tokens.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');

assert.match(ui,/MEMEFLOW_GMGN_SORT_STYLE_V25_1/);
assert.match(ui,/__mfSortTriggerMarkupV251/);
assert.match(ui,/__mfSortIconV251/);
assert.match(ui,/mf-sort-row-chevron-v251/);

// Logic from V25 must still be present.
assert.match(ui,/MEMEFLOW_GMGN_SORT_V25/);
assert.match(ui,/function\s+__mfSmartSortRowsV25/);
assert.match(ui,/const laneDiff=priority\(a\)-priority\(b\)/);
assert.match(ui,/MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23/);

// The old V25 CSS block is replaced, not layered.
assert.match(css,/MEMEFLOW_GMGN_SORT_V25_1/);
assert.equal(
  (css.match(/\/\* MEMEFLOW_GMGN_SORT_V25 \*\//g)||[]).length,
  0
);

// Native page variables are reused.
assert.match(css,/var\(--line/);
assert.match(css,/var\(--line-strong/);
assert.match(css,/var\(--muted/);
assert.match(css,/var\(--green/);

// Fixes visible in the user's screenshot.
assert.match(css,/width:100% !important/);
assert.match(css,/max-height:64dvh/);
assert.match(css,/background:rgba\(0,5,9,.46\)/);
assert.match(css,/min-height:44px/);

assert.match(html,/system-tokens\.js\?v=gmgn-sort-v25-1-20260827/);
assert.match(html,/system-tokens\.css\?v=gmgn-sort-v25-1-20260827/);

console.log('token sort style v25.1 ok');
