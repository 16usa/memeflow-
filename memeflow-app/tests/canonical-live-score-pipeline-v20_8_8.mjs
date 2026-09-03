import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rankCandidateViews} from '../src/feed-ranking.mjs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const rankSource=fs.readFileSync(new URL('../src/feed-ranking.mjs',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');

const row=rankCandidateViews([{mint:'Canonical71',state:'WAITING',score:71,qualityScore:90,opportunityScore:95,holderCount:200,volume5mUsd:5000,transactions5m:100,marketCapUsd:25000,priceChange5mPct:20,quoteAgeMs:1000}])[0];
assert.equal(row.score,71);
assert.equal(row.decisionScore,71);
assert.ok(Number.isFinite(row.feedScore));
assert.match(rankSource,/MEMEFLOW_CANONICAL_VISIBLE_AI_SCORE_V20_8_8/);
assert.doesNotMatch(rankSource,/score:\s*liveCandidate\s*\?/);

const ds=app.indexOf('// MEMEFLOW_CANONICAL_LIVE_DECISION_V20_8_8');
const de=app.indexOf('function __mfLiveCardViewV14(',ds);
const decision=app.slice(ds,de);
assert.ok(ds>=0&&de>ds);
assert.match(decision,/fresh=evaluate\(token,settings\)/);
assert.doesNotMatch(decision,/previewScore/);
assert.doesNotMatch(decision,/score:0/);
assert.doesNotMatch(decision,/confidence:0/);
assert.match(decision,/liveTruthBlocked:true/);

const fullStart=app.indexOf("if(url.pathname==='/api/system/live-token-states'");
const fullEnd=app.indexOf("if(url.pathname==='/api/ai/decisions')",fullStart);
const full=app.slice(fullStart,fullEnd);
assert.match(full,/__mfLiveDecisionForUserV14\(/);
assert.match(full,/__mfLiveCardViewV14\(/);
assert.match(full,/MEMEFLOW_UNIFIED_FULL_LIVE_VIEW_V20_8_8/);
assert.doesNotMatch(full,/__mfLiveStatesResponseCache\.set\(/);

const is=ui.indexOf('function __mfInvalidateDynamicRowV20_2(');
const ie=ui.indexOf('function __mfMergeMutableRowV18(',is);
const inv=ui.slice(is,ie);
assert.match(inv,/score:null/);
assert.match(inv,/confidence:null/);
assert.doesNotMatch(inv,/score:0/);
assert.doesNotMatch(inv,/confidence:0/);
assert.match(ui,/MEMEFLOW_VISIBLE_INVALIDATION_SCOPE_V20_8_8/);
assert.match(ui,/if\(!requestedMints\.has\(mint\)\)return previous;/);
assert.match(ui,/MEMEFLOW_SMART_HIDDEN_FEED_RANK_V20_8_8/);
assert.match(html,/system-tokens\.js\?v=canonical-live-score-v20-8-8-20260903/);

console.log('CANONICAL_LIVE_SCORE_PIPELINE_V20_8_8_OK');
