import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../system-tokens.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');

assert.match(ui,/MEMEFLOW_GMGN_SORT_V25/);
assert.match(ui,/MEMEFLOW_GMGN_SORT_UI_V25/);
assert.match(ui,/function\s+__mfSmartSortRowsV25\s*\(\s*rows\s*\)/);
assert.match(ui,/function\s+sortRows\s*\(\s*rows\s*\)/);
assert.match(ui,/MEMEFLOW_WATCH_WAITING_SCORE_ORDER_V22/);
assert.match(ui,/watch:\s*2,\s*waiting:\s*2,/s);
assert.match(ui,/open:\s*0,\s*ready:\s*1,/s);
assert.match(ui,/const laneDiff=priority\(a\)-priority\(b\)/);
assert.match(ui,/if\(valueA===null\)return 1;/);
assert.match(ui,/if\(valueB===null\)return -1;/);
assert.match(ui,/MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23/);
assert.match(ui,/__mfReconcileVisibleCardsV183\(\)/);

for(const text of [
  'Smart / Default',
  'Market Cap',
  'Holders',
  'Transactions',
  'Volume',
  'Age',
  'HIGH → LOW',
  'LOW → HIGH',
  '1m',
  '5m',
  '1h',
  '6h',
  '24h'
]){
  assert.ok(ui.includes(text),`missing UI label: ${text}`);
}

assert.match(css,/MEMEFLOW_GMGN_SORT_V25/);
assert.match(css,/\.mf-sort-sheet-v25/);
assert.match(css,/\.mf-sort-trigger-v25/);
assert.match(html,/system-tokens\.js\?v=gmgn-sort-v25-1-20260827/);
assert.match(html,/system-tokens\.css\?v=gmgn-sort-v25-1-20260827/);

console.log('token sort ui v25 ok');
