import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(
  new URL('../system-tokens.js',import.meta.url),
  'utf8'
);

assert.match(
  ui,
  /MEMEFLOW_WATCH_WAITING_SCORE_ORDER_V22/,
  'WATCH and WAITING must remain one score-ranked visual pool'
);

assert.match(
  ui,
  /watch:\s*2,\s*waiting:\s*2,/s,
  'WATCH and WAITING must have identical visual priority'
);

const loadStart=ui.indexOf('async function loadTokens(){');
const loadEnd=ui.indexOf(
  "\ndocument\n  .querySelectorAll(",
  loadStart
);
assert.ok(loadStart>=0&&loadEnd>loadStart,'loadTokens block missing');

const loadBlock=ui.slice(loadStart,loadEnd);
assert.match(
  loadBlock,
  /MEMEFLOW_INSTANT_SCORE_RANK_REORDER_V23/,
  'same-tick Score reorder marker missing'
);

const stateMerge=loadBlock.indexOf('state.rows=');
const instantReorder=loadBlock.indexOf(
  '__mfReconcileVisibleCardsV183();',
  stateMerge
);
const mutablePatchLoop=loadBlock.indexOf(
  "const card of document.querySelectorAll(",
  stateMerge
);

assert.ok(stateMerge>=0,'state.rows mutable merge missing');
assert.ok(
  instantReorder>stateMerge,
  'ranking reconcile must happen after new mutable Score is merged'
);
assert.ok(
  mutablePatchLoop>instantReorder,
  'ranking reconcile must happen before the mutable DOM patch loop finishes'
);

const openStart=ui.indexOf(
  'async function __mfRefreshOpenPositionsV16({'
);
const openEnd=ui.indexOf(
  '// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18',
  openStart
);
assert.ok(openStart>=0&&openEnd>openStart,'open-position refresh block missing');

const openBlock=ui.slice(openStart,openEnd);
assert.match(
  openBlock,
  /MEMEFLOW_INSTANT_OPEN_RANK_REORDER_V23/,
  'same-tick OPEN POSITION ranking marker missing'
);

const positionsAssign=openBlock.indexOf('state.positions=');
const openReorder=openBlock.indexOf(
  '__mfReconcileVisibleCardsV183();',
  positionsAssign
);
assert.ok(
  openReorder>positionsAssign,
  'OPEN POSITION ranking must reconcile after fresh P&L snapshot'
);

assert.doesNotMatch(
  openBlock,
  /if\s*\(\s*membershipChanged\s*\)\s*\{\s*__mfReconcileVisibleCardsV183\(\)/s,
  'OPEN POSITION reorder must not wait for membership changes'
);

const reconcileStart=ui.indexOf(
  'function __mfReconcileVisibleCardsV183(){'
);
const reconcileEnd=ui.indexOf(
  '\n\nasync function loadDiscoveryStatus',
  reconcileStart
);
assert.ok(
  reconcileStart>=0&&reconcileEnd>reconcileStart,
  'keyed reconcile function missing'
);

const reconcileBlock=ui.slice(reconcileStart,reconcileEnd);
assert.match(
  reconcileBlock,
  /list\.append\(card\)/,
  'ranking refresh must MOVE existing keyed DOM nodes'
);

console.log('live ranking reorder v23 ok');
