import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  candidateRelevanceScore,
  rankCandidateViews,
  candidateStatePriority
} from '../src/feed-ranking.mjs';

const high={mint:'High',state:'WAITING',score:82,transactions5m:2,volume5mUsd:50,marketCapUsd:4000,holderCount:10,quoteAgeMs:1000};
const lowButMoving={mint:'LowMoving',state:'WATCH',score:61,transactions5m:200,volume5mUsd:50000,marketCapUsd:50000,holderCount:300,quoteAgeMs:100};

const rankedSameLane=rankCandidateViews([lowButMoving,high]);
assert.equal(rankedSameLane[0].mint,'High');
assert.equal(rankedSameLane[0].score,82);
assert.equal(rankedSameLane[0].decisionScore,82);
assert.equal(candidateRelevanceScore(high),82);
assert.equal('feedScore' in rankedSameLane[0],false);
assert.equal('relevanceScore' in rankedSameLane[0],false);

const unknown=rankCandidateViews([{mint:'Unknown',state:'WAITING',score:null}])[0];
assert.equal(unknown.score,null);
assert.equal(unknown.decisionScore,null);

const ready={...lowButMoving,mint:'Ready',state:'BUY READY',score:55};
const blocked={...high,mint:'Blocked',state:'BLOCKED',score:99};
const order=rankCandidateViews([blocked,high,ready]);
assert.equal(order[0].mint,'Ready');
assert.equal(order.at(-1).mint,'Blocked');

assert.ok(candidateStatePriority('OPEN POSITION')>candidateStatePriority('BUY READY'));
assert.ok(candidateStatePriority('BUY READY')>candidateStatePriority('WATCH'));
assert.equal(candidateStatePriority('WATCH'),candidateStatePriority('WAITING'));
assert.ok(candidateStatePriority('WAITING')>candidateStatePriority('BLOCKED'));

const src=fs.readFileSync(new URL('../src/feed-ranking.mjs',import.meta.url),'utf8');
assert.match(src,/MEMEFLOW_UNIFIED_SCORE_RANKING_V21/);
assert.doesNotMatch(src,/feedScore:/);
assert.doesNotMatch(src,/relevanceScore:/);
assert.doesNotMatch(src,/opportunityScore/);
assert.doesNotMatch(src,/qualityScore/);

console.log('unified canonical score ranking v21 ok');
