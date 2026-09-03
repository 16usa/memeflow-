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

const start=ui.indexOf(
  '// MEMEFLOW_CARD_DETAILS_LIVE_AUTHORITY_V20_5'
);
const end=ui.indexOf(
  '// MEMEFLOW_KEYED_CARD_RECONCILE_V18_3',
  start
);

assert.ok(start>=0,'V20.5 marker missing');
assert.ok(end>start,'V20.5 function boundary missing');

const details=ui.slice(start,end);

assert.match(details,/__mfTrackedLiveRowV27\(mint\)/);
assert.match(details,/const liveDecision=tracked/);
assert.match(details,/liveRow\?\.decision\?\.state/);
assert.match(details,/liveRow\?\.decision\?\.score/);
assert.match(details,/const holdersValue=tracked/);
assert.match(details,/liveHolderCount \?\?[\s\S]*liveObservedHolder/);
assert.match(details,/const marketCapUsd=tracked/);
assert.match(details,/liveRow\?\.marketCapUsd/);
assert.match(details,/const volume5mUsd=tracked/);
assert.match(details,/liveRow\?\.volume5mUsd/);
assert.match(details,/const transactions5m=tracked/);
assert.match(details,/liveRow\?\.transactions5m/);
assert.match(details,/scanOnchain\?\.mintAuthorityPresent/);
assert.match(details,/scanOnchain\?\.freezeAuthorityPresent/);
assert.doesNotMatch(details,/const decision=scan\?\.displayEvaluation/);

assert.match(
  html,
  /system-tokens\.js\?v=card-live-authority-v20-5-20260902/
);

console.log('CARD_DETAILS_LIVE_AUTHORITY_V20_5_OK');
