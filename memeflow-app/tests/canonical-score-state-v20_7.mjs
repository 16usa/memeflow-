import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

assert.match(app,/MEMEFLOW_CANONICAL_LIVE_DECISION_V20_8_8/);

// The live safety gate may force WAITING but must not zero the evaluator score.
const ds=app.indexOf('// MEMEFLOW_CANONICAL_LIVE_DECISION_V20_8_8');
const de=app.indexOf('function __mfLiveCardViewV14(',ds);
assert.ok(ds>=0&&de>ds);

const decisionBlock=app.slice(ds,de);

assert.match(decisionBlock,/state:'WAITING'/);
assert.match(decisionBlock,/liveTruthBlocked:true/);
assert.match(decisionBlock,/liveTruthReason:reason/);
assert.doesNotMatch(decisionBlock,/score:0/);
assert.doesNotMatch(decisionBlock,/confidence:0/);

// V28 must no longer convert canonical WAITING into a display-only WATCH.
const ws=app.indexOf('function __mfLiveDisplayStateV28(view,settings={}){');
const we=app.indexOf('function __mfRankLiveDisplayV28(view,settings={}){',ws);
assert.ok(ws>=0&&we>ws);

const watchBlock=app.slice(ws,we);

assert.match(watchBlock,/return view;/);
// Comments may mention the deleted ranking fields; executable reads may not.
assert.doesNotMatch(watchBlock,/state:'WATCH'/);
assert.doesNotMatch(watchBlock,/watchPendingAdmission:true/);
assert.doesNotMatch(watchBlock,/view\?\.relevanceScore|view\.relevanceScore/);
assert.doesNotMatch(watchBlock,/view\?\.feedScore|view\.feedScore/);

console.log('CANONICAL_SCORE_STATE_V20_7_OK');
