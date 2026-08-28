import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  candidateRelevanceScore,
  rankCandidateViews,
  candidateStatePriority
} from '../src/feed-ranking.mjs';

const strongWatch={
  mint:'StrongWatch',
  state:'WATCH',
  score:71,
  qualityScore:78,
  opportunityScore:76,
  holderCount:21,
  volume5mUsd:1600,
  transactions5m:35,
  marketCapUsd:5000,
  priceChange5mPct:105.5,
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
  candidateRelevanceScore(strongWatch) >
  candidateRelevanceScore(weakWatch),
  'stronger card metrics must rank higher inside WATCH'
);

const hugeButWeakPump={
  ...weakWatch,
  mint:'HugeButWeakPump',
  priceChange5mPct:620
};

assert.ok(
  candidateRelevanceScore(strongWatch) >
  candidateRelevanceScore(hugeButWeakPump),
  'raw vertical price change alone must not dominate relevance'
);

const lowBuyReady={
  ...weakWatch,
  mint:'LowBuyReady',
  state:'BUY READY',
  score:72
};

const spectacularWatch={
  ...strongWatch,
  mint:'SpectacularWatch',
  score:99,
  opportunityScore:99,
  qualityScore:99,
  holderCount:200,
  volume5mUsd:25000,
  transactions5m:180,
  priceChange5mPct:90
};

const waitingStrong={...strongWatch,mint:'WaitingStrong',state:'WAITING'};
const blockedStrong={...spectacularWatch,mint:'BlockedStrong',state:'BLOCKED'};

const ranked=rankCandidateViews([
  blockedStrong,
  weakWatch,
  waitingStrong,
  spectacularWatch,
  lowBuyReady,
  strongWatch
]);

assert.equal(ranked[0].mint,'LowBuyReady');
assert.equal(ranked[1].mint,'SpectacularWatch');
assert.equal(ranked[2].mint,'StrongWatch');
assert.equal(ranked[3].mint,'WeakWatch');
assert.equal(ranked[4].mint,'WaitingStrong');
assert.equal(ranked[5].mint,'BlockedStrong');

assert.ok(ranked.every(row=>Number.isFinite(row.relevanceScore)));
assert.ok(candidateStatePriority('BUY READY')>candidateStatePriority('WATCH'));
assert.ok(candidateStatePriority('WATCH')>candidateStatePriority('WAITING'));
assert.ok(candidateStatePriority('WAITING')>candidateStatePriority('BLOCKED'));

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
assert.match(app,/MEMEFLOW_FEED_RELEVANCE_RANKING_V1/);

const liveStart=app.indexOf("if(url.pathname==='/api/system/live-token-states'");
const aiStart=app.indexOf("if(url.pathname==='/api/ai/decisions')");
const debugStart=app.indexOf("if(url.pathname==='/api/debug/filter-pipeline')");
const liveSlice=app.slice(liveStart,aiStart);
const aiSlice=app.slice(aiStart,debugStart);

assert.match(liveSlice,/rankCandidateViews\(_unrankedViews\)/);
assert.match(aiSlice,/rankCandidateViews\(_selected\.map\(candidateView\)\)/);

console.log('feed relevance ranking v1 ok');
