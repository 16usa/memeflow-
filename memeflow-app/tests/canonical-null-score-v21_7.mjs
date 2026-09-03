import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluate} from '../src/evaluate.mjs';
import {rankCandidateViews} from '../src/feed-ranking.mjs';

// MEMEFLOW_CANONICAL_NULL_SCORE_REGRESSION_V21_7

const settings={
  minScore:82,
  minConfidence:0,
  minBuyPressure:0,
  minHolders:0,
  maxTop10Pct:100,
  maxDeveloperPct:100
};

const base={
  mint:'NullScore1111111111111111111111111111111',
  launchPlatform:'pump',
  priceSol:0.00001,
  holderCount:100,
  top10Pct:15,
  developerPct:3,
  buyPressure:2,
  holderFresh:true
};

// 1. No event-driven opportunity evidence = unknown Score, never synthetic 0.
const unknown=evaluate(
  {
    ...base,
    qualityScore:90,
    opportunityScore:null,
    opportunityEvidenceReady:false,
    opportunityTrendHealthy:false,
    opportunityEventCount:0
  },
  settings
);

assert.equal(unknown.state,'WAITING');
assert.equal(unknown.score,null);
assert.equal(unknown.scoreAvailable,false);
assert.equal(unknown.scoreFresh,false);
assert.equal(unknown.scoreSource,'unavailable');
assert.equal(unknown.scoreBeforeWalletRisk,null);
assert.equal(unknown.aiQuality.score,null);
assert.equal(
  unknown.settingsEvaluation.gates
    .find(g=>g.key==='minScore')?.status,
  'WAITING'
);

// 2. Real evidence produces the one real numerical Score.
const live=evaluate(
  {
    ...base,
    qualityScore:90,
    opportunityScore:85,
    opportunityEvidenceReady:true,
    opportunityTrendHealthy:true,
    opportunityEventCount:12
  },
  settings
);

assert.equal(live.score,88);
assert.equal(live.scoreAvailable,true);
assert.equal(live.scoreFresh,true);
assert.equal(live.scoreSource,'evaluate-live');
assert.equal(live.state,'BUY READY');

// 3. Ranking treats null as unknown, not zero.
const ranked=rankCandidateViews([
  {mint:'UNKNOWN',state:'WAITING',score:null,transactions5m:9999},
  {mint:'KNOWN',state:'WAITING',score:1,transactions5m:0}
]);
assert.equal(ranked[0].mint,'KNOWN');
assert.equal(ranked[0].score,1);
assert.equal(ranked[1].score,null);

// 4. Card/Details/Terminal must all consume the same canonical score property.
const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const terminal=fs.readFileSync(new URL('../trading.js',import.meta.url),'utf8');

assert.match(app,/MEMEFLOW_LAST_CONFIRMED_SCORE_V21_7/);
assert.match(app,/scoreSource:'persisted-last-confirmed'/);

const liveViewStart=app.indexOf('function __mfLiveCardViewV14(');
assert.ok(liveViewStart>=0);
const liveView=app.slice(liveViewStart,liveViewStart+9000);
assert.match(liveView,/score:finite\(decision\?\.score\)/);
assert.match(liveView,/scoreFresh:decision\?\.scoreFresh===true/);

assert.match(ui,/function tokenScore\(row\)/);
assert.doesNotMatch(ui,/a\?\.feedScore\?\?a\?\.relevanceScore/);

const loadStart=terminal.indexOf(
  'async function loadCandidates({ redrawChart = true } = {}) {'
);
const loadEnd=terminal.indexOf('function selectCandidate(mint) {',loadStart);
const load=terminal.slice(loadStart,loadEnd);
assert.match(load,/\/api\/system\/live-token-states\?limit=200/);
assert.doesNotMatch(load,/\/api\/ai\/decisions/);

console.log('CANONICAL_NULL_SCORE_V21_7_OK');
