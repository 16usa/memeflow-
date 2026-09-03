import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  candidateRelevanceScore,
  rankCandidateViews,
  candidateStatePriority
} from '../src/feed-ranking.mjs';

const activeWatch={
  mint:'ActiveWatch',
  state:'WATCH',
  score:71,
  qualityScore:78,
  opportunityScore:76,
  holderCount:21,
  volume5mUsd:1600,
  transactions5m:35,
  marketCapUsd:5000,
  priceChange5mPct:35.5,
  ageMinutes:1.4,
  quoteAgeMs:1000,
  drawdownFromPeakPct:3,
  whaleDominancePct:22,
  opportunityTrendHealthy:true
};

const weakWatch={
  mint:'WeakWatch',
  state:'WATCH',
  score:70,
  qualityScore:63,
  opportunityScore:42,
  holderCount:5,
  volume5mUsd:198,
  transactions5m:9,
  marketCapUsd:2400,
  priceChange5mPct:1.1,
  ageMinutes:0.7,
  quoteAgeMs:1000,
  drawdownFromPeakPct:4,
  whaleDominancePct:45,
  opportunityTrendHealthy:true
};

assert.ok(
  candidateRelevanceScore(activeWatch) >
  candidateRelevanceScore(weakWatch),
  'stronger current card metrics must rank higher'
);

const hugeButWeakPump={
  ...weakWatch,
  mint:'HugeButWeakPump',
  priceChange5mPct:620
};

assert.ok(
  candidateRelevanceScore(activeWatch) >
  candidateRelevanceScore(hugeButWeakPump),
  'raw vertical price change alone must not dominate relevance'
);

// Regression from the 2026-08-27 screenshots:
// Milo was WATCH/74 but had zero 5m activity and a stale card.
// rizztek was WAITING/0 but had fresh trades, volume and +5m movement.
// The active token must rank above the stale one regardless of WAITING/WATCH.
const milo={
  mint:'Milo',
  state:'WATCH',
  score:74,
  holderCount:73,
  holderCountIsLowerBound:true,
  volume5mUsd:0,
  volume5mSol:0,
  transactions5m:0,
  marketCapUsd:null,
  priceChange5mPct:null,
  ageMinutes:11,
  quoteAgeMs:90_000,
  opportunityScore:0,
  qualityScore:40
};

const rizztek={
  mint:'rizztek',
  state:'WAITING',
  score:0,
  holderCount:4,
  holderCountIsLowerBound:true,
  volume5mUsd:179.7,
  transactions5m:4,
  marketCapUsd:5600,
  priceChange5mPct:10.6,
  ageMinutes:6.4,
  quoteAgeMs:1000,
  opportunityScore:52,
  qualityScore:45,
  opportunityTrendHealthy:true
};

const screenshotRegression=rankCandidateViews([milo,rizztek]);
assert.equal(screenshotRegression[0].mint,'rizztek');
assert.ok(
  screenshotRegression[0].feedScore > screenshotRegression[1].feedScore,
  'hidden feed score must agree with live ordering'
);
assert.equal(screenshotRegression[0].score,0);
assert.equal(screenshotRegression[1].score,74);
assert.equal(screenshotRegression[0].decisionScore,0);
assert.equal(screenshotRegression[1].decisionScore,74);

const lowBuyReady={
  ...weakWatch,
  mint:'LowBuyReady',
  state:'BUY READY',
  score:72
};

const spectacularWaiting={
  ...activeWatch,
  mint:'SpectacularWaiting',
  state:'WAITING',
  score:0,
  opportunityScore:99,
  qualityScore:99,
  holderCount:200,
  volume5mUsd:25000,
  transactions5m:180,
  priceChange5mPct:90
};

const blockedStrong={
  ...spectacularWaiting,
  mint:'BlockedStrong',
  state:'BLOCKED'
};

const ranked=rankCandidateViews([
  blockedStrong,
  activeWatch,
  spectacularWaiting,
  lowBuyReady
]);

assert.equal(ranked[0].mint,'LowBuyReady');
assert.equal(ranked.at(-1).mint,'BlockedStrong');
assert.ok(
  ranked.findIndex(x=>x.mint==='SpectacularWaiting') <
  ranked.findIndex(x=>x.mint==='ActiveWatch'),
  'WAITING and WATCH must compete by live quality'
);

assert.ok(ranked.every(row=>Number.isFinite(row.relevanceScore)));
assert.ok(candidateStatePriority('OPEN POSITION')>candidateStatePriority('BUY READY'));
assert.ok(candidateStatePriority('BUY READY')>candidateStatePriority('WATCH'));
assert.equal(candidateStatePriority('WATCH'),candidateStatePriority('WAITING'));
assert.ok(candidateStatePriority('WAITING')>candidateStatePriority('BLOCKED'));

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const liveStart=app.indexOf("if(url.pathname==='/api/system/live-token-states'");
const aiStart=app.indexOf("if(url.pathname==='/api/ai/decisions')");
const debugStart=app.indexOf("if(url.pathname==='/api/debug/filter-pipeline')");
const liveSlice=app.slice(liveStart,aiStart);
const aiSlice=app.slice(aiStart,debugStart);

assert.match(liveSlice,/rankCandidateViews\(_unrankedViews\)/);
assert.match(aiSlice,/rankCandidateViews\(_selected\.map\(candidateView\)\)/);
assert.match(app,/MEMEFLOW_CANONICAL_LIVE_DECISION_V20_8_8/);
assert.match(app,/MEMEFLOW_LIVE_CARD_STALE_MC_FIX_V21/);

console.log('feed relevance ranking v2 ok');
