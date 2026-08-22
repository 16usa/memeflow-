import test from 'node:test';
import assert from 'node:assert/strict';
import {
  candidateFeed,
  candidateVisibilityCounts,
  classifyDecisionVisibility,
  isDecisionArchived
} from './candidate-visibility.mjs';

const NOW=2_000_000_000_000;
const M=60_000;
const decisions=[
  {mint:'blocked-stale',state:'BLOCKED',updatedAt:NOW-M},
  {mint:'blocked-live',state:'BLOCKED',updatedAt:NOW-M},
  {mint:'waiting-stale',state:'WAITING',updatedAt:NOW-M},
  {mint:'watch-stale',state:'WATCH',updatedAt:NOW-M},
  {mint:'buy-stale',state:'BUY READY',updatedAt:NOW-M}
];
const tokens={
  'blocked-stale':{lastMarketActivityAt:NOW-16*M,discoveredAt:NOW-20*M},
  'blocked-live':{lastMarketActivityAt:NOW-2*M,discoveredAt:NOW-20*M},
  'waiting-stale':{lastMarketActivityAt:NOW-61*M,discoveredAt:NOW-70*M},
  'watch-stale':{lastMarketActivityAt:NOW-61*M,discoveredAt:NOW-70*M},
  'buy-stale':{lastMarketActivityAt:NOW-120*M,discoveredAt:NOW-130*M}
};
const lookup=m=>tokens[m];

test('stale BLOCKED leaves live but remains available to audit/archive',()=>{
  assert.equal(isDecisionArchived(decisions[0],tokens['blocked-stale'],NOW),true);
  assert.equal(candidateFeed(decisions,'all',lookup,NOW).some(x=>x.mint==='blocked-stale'),false);
  assert.equal(candidateFeed(decisions,'audit',lookup,NOW).some(x=>x.mint==='blocked-stale'),true);
  assert.equal(candidateFeed(decisions,'archived',lookup,NOW).some(x=>x.mint==='blocked-stale'),true);
});

test('recent BLOCKED remains visible',()=>{
  assert.equal(classifyDecisionVisibility(decisions[1],tokens['blocked-live'],NOW),'filtered');
});

test('WAITING/WATCH age out after passive TTL',()=>{
  assert.equal(classifyDecisionVisibility(decisions[2],tokens['waiting-stale'],NOW),'archived');
  assert.equal(classifyDecisionVisibility(decisions[3],tokens['watch-stale'],NOW),'archived');
});

test('BUY READY is not hidden only because market is quiet',()=>{
  assert.equal(classifyDecisionVisibility(decisions[4],tokens['buy-stale'],NOW),'candidate');
});

test('visible counts exclude archived rows without destroying audit total',()=>{
  const c=candidateVisibilityCounts(decisions,lookup,NOW);
  assert.equal(c.totalEvaluated,5);
  assert.equal(c.archived,3);
  assert.equal(c.visible,2);
  assert.equal(c.buyReady,1);
  assert.equal(c.blocked,1);
});
