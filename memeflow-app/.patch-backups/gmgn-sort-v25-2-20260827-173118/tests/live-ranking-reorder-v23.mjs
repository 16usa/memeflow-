import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(
  new URL('../system-tokens.js',import.meta.url),
  'utf8'
);

const html=fs.readFileSync(
  new URL('../system-tokens.html',import.meta.url),
  'utf8'
);

assert.match(
  ui,
  /watch:\s*2,\s*waiting:\s*2,/s,
  'WATCH and WAITING must share one visual ranking lane'
);

const loadStart=ui.indexOf('async function loadTokens(){');
const loadEnd=ui.indexOf(
  "\ndocument\n  .querySelectorAll(",
  loadStart
);

assert.ok(loadStart>=0&&loadEnd>loadStart,'loadTokens() block missing');

const loadBlock=ui.slice(loadStart,loadEnd);

assert.match(
  loadBlock,
  /MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23/,
  'instant score reorder marker missing'
);

const stateMergeAt=loadBlock.indexOf('state.rows=');
const rankReconcileAt=loadBlock.indexOf(
  '__mfReconcileVisibleCardsV183();',
  stateMergeAt
);
const mutablePatchAt=loadBlock.indexOf(
  "const card of document.querySelectorAll(",
  stateMergeAt
);

assert.ok(stateMergeAt>=0,'mutable state merge missing');
assert.ok(
  rankReconcileAt>stateMergeAt,
  'ranking reconcile must happen after mutable state is merged'
);
assert.ok(
  mutablePatchAt>rankReconcileAt,
  'ranking reconcile must happen before the mutable DOM patch loop completes'
);

const openStart=ui.indexOf(
  'async function __mfRefreshOpenPositionsV16({'
);
const openEnd=ui.indexOf(
  '// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18',
  openStart
);

assert.ok(
  openStart>=0&&openEnd>openStart,
  'open position refresh block missing'
);

const openBlock=ui.slice(openStart,openEnd);

assert.match(
  openBlock,
  /MEMEFLOW_INSTANT_OPEN_RANK_REORDER_V23/,
  'instant OPEN POSITION reorder marker missing'
);

assert.doesNotMatch(
  openBlock,
  /if\s*\(\s*membershipChanged\s*\)\s*\{\s*__mfReconcileVisibleCardsV183\(\)/s,
  'OPEN POSITION ranking must not wait for membership changes'
);

assert.match(
  html,
  /system-tokens\.js\?v=gmgn-sort-v25-1-20260827/,
  'browser cache-bust version is stale'
);

console.log('live ranking reorder v23 ok');
