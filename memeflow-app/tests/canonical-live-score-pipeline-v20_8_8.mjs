import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rankCandidateViews} from '../src/feed-ranking.mjs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const rankSource=fs.readFileSync(new URL('../src/feed-ranking.mjs',import.meta.url),'utf8');

const row=rankCandidateViews([{mint:'Canonical71',state:'WAITING',score:71,transactions5m:100}])[0];
assert.equal(row.score,71);
assert.equal(row.decisionScore,71);
assert.equal('feedScore' in row,false);
assert.equal('relevanceScore' in row,false);
assert.match(rankSource,/MEMEFLOW_UNIFIED_SCORE_RANKING_V21/);

const ds=app.indexOf('// MEMEFLOW_CANONICAL_LIVE_DECISION_V20_8_8');
const de=app.indexOf('function __mfLiveCardViewV14(',ds);
const decision=app.slice(ds,de);
assert.ok(ds>=0&&de>ds);
assert.match(decision,/fresh=evaluate\(token,settings\)/);
assert.match(decision,/MEMEFLOW_TRADE_ELIGIBLE_CANONICAL_STATE_V21/);
assert.doesNotMatch(decision,/previewScore/);
assert.doesNotMatch(decision,/score:0/);

const is=ui.indexOf('function __mfInvalidateDynamicRowV20_2(');
const ie=ui.indexOf('function __mfMergeMutableRowV18(',is);
const inv=ui.slice(is,ie);
assert.match(inv,/score:null/);
assert.doesNotMatch(inv,/score:0/);
assert.match(ui,/MEMEFLOW_SMART_CANONICAL_SCORE_RANK_V21/);
assert.doesNotMatch(ui,/a\?\.feedScore\?\?a\?\.relevanceScore/);

console.log('CANONICAL_LIVE_SCORE_PIPELINE_V21_OK');
