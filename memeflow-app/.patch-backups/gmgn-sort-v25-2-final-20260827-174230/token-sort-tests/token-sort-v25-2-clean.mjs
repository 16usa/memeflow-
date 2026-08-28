import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../system-tokens.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');

assert.match(ui,/MEMEFLOW_GMGN_SORT_STYLE_V25_2_CLEAN/);
assert.doesNotMatch(ui,/MEMEFLOW_GMGN_SORT_STYLE_V25_1/);
assert.match(css,/MEMEFLOW_GMGN_SORT_STYLE_V25_2_CLEAN/);
assert.doesNotMatch(css,/MEMEFLOW_GMGN_SORT_V25_1/);
assert.doesNotMatch(css,/\/\* MEMEFLOW_GMGN_SORT_V25 \*\//);

assert.match(ui,/MEMEFLOW_GMGN_SORT_V25/);
assert.match(ui,/function\s+__mfSmartSortRowsV25/);
assert.match(ui,/const laneDiff=priority\(a\)-priority\(b\)/);
assert.match(ui,/MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23/);
assert.match(ui,/MEMEFLOW_KEYED_CARD_RECONCILE_V18_3/);

for(const name of [
  '__mfSortSheetShellV25',
  '__mfBindSortOverlayV25',
  '__mfRenderSortRootV25',
  '__mfRenderAgeSheetV25',
  '__mfEnsureSortUiV25'
]){
  const matches=ui.match(new RegExp(`function\\s+${name}\\s*\\(`,'g'))||[];
  assert.equal(matches.length,1,`${name} must have exactly one definition`);
}

assert.doesNotMatch(ui,/data-mf-sort-close/);
assert.doesNotMatch(css,/\.mf-sort-close-v25/);
assert.match(ui,/mf-sort-list-shell-v252/);

assert.match(css,/max-height:min\(53dvh,470px\)/);
assert.match(css,/background:rgba\(0,5,9,.33\)/);
assert.match(css,/backdrop-filter:blur\(1\.5px\)/);
assert.match(css,/\.mf-sort-list-shell-v252/);
assert.match(css,/\.mf-sort-row-v25 \+ \.mf-sort-row-v25::before/);
assert.match(css,/left:42px/);
assert.match(css,/width:15px/);
assert.match(css,/border:1\.5px solid #758994/);

assert.match(css,/var\(--line/);
assert.match(css,/var\(--line-strong/);
assert.match(css,/var\(--muted/);
assert.match(css,/var\(--green/);

for(const label of [
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
  assert.ok(ui.includes(label),`missing sort control: ${label}`);
}

assert.match(html,/system-tokens\.js\?v=gmgn-sort-v25-2-clean-20260827/);
assert.match(html,/system-tokens\.css\?v=gmgn-sort-v25-2-clean-20260827/);
assert.doesNotMatch(html,/gmgn-sort-v25-1-20260827/);

console.log('token sort v25.2 clean ok');
