import assert from 'node:assert/strict';
import test from 'node:test';
import {
  shouldDeleteToken,
  tokenPriceDropPercent
} from '../src/token-cleanup.mjs';
import {
  makeHolderMetrics,
  makeHolderQueue
} from '../src/enrich.mjs';

const MINUTE=60*1000;
const NOW=2_000_000_000_000;
const token=({
  ageMinutes=0,
  score=50,
  peakPriceSol=100,
  priceSol=100
}={})=>({
  discoveredAt:NOW-ageMinutes*MINUTE,
  score,
  peakPriceSol,
  priceSol
});

test('39 score and 31 minutes deletes',()=>{
  assert.equal(
    shouldDeleteToken(token({ageMinutes:31,score:39}),{now:NOW}),
    true
  );
});

test('40 score and 31 minutes keeps',()=>{
  assert.equal(
    shouldDeleteToken(token({ageMinutes:31,score:40}),{now:NOW}),
    false
  );
});

test('39 score and 29 minutes keeps',()=>{
  assert.equal(
    shouldDeleteToken(token({ageMinutes:29,score:39}),{now:NOW}),
    false
  );
});

test('exactly 30 minutes keeps',()=>{
  assert.equal(
    shouldDeleteToken(token({ageMinutes:30,score:39}),{now:NOW}),
    false
  );
});

test('80 percent price drop deletes',()=>{
  const row=token({peakPriceSol:100,priceSol:20});
  assert.equal(tokenPriceDropPercent(row),80);
  assert.equal(shouldDeleteToken(row,{now:NOW}),true);
});

test('79.99 percent price drop keeps',()=>{
  const row=token({peakPriceSol:100,priceSol:20.01});
  assert.ok(tokenPriceDropPercent(row)<80);
  assert.equal(shouldDeleteToken(row,{now:NOW}),false);
});

test('both conditions true deletes',()=>{
  assert.equal(
    shouldDeleteToken(
      token({
        ageMinutes:31,
        score:39,
        peakPriceSol:100,
        priceSol:20
      }),
      {now:NOW}
    ),
    true
  );
});

test('new low-score token waits until 30 minutes passes',()=>{
  assert.equal(
    shouldDeleteToken(token({ageMinutes:1,score:10}),{now:NOW}),
    false
  );
});

test('old token with missing score stays operational',()=>{
  const row=token({ageMinutes:31});
  delete row.score;
  assert.equal(shouldDeleteToken(row,{now:NOW}),false);
});

test('missing current price is not interpreted as a 100 percent drop',()=>{
  const row=token({peakPriceSol:100});
  delete row.priceSol;
  assert.equal(tokenPriceDropPercent(row),null);
  assert.equal(shouldDeleteToken(row,{now:NOW}),false);
});

test('cleanup cancellation removes pending holder work and blocks requeue',()=>{
  const queue=makeHolderQueue(
    {initialDelayMs:10_000},
    {
      holderMetrics:makeHolderMetrics(),
      enrichHoldersFn:async()=>({rateLimited:false})
    }
  );

  try{
    assert.equal(queue.enqueue('MintToDelete'),true);
    assert.equal(queue.pendingCount,1);
    assert.equal(queue.cancel('MintToDelete'),true);
    assert.equal(queue.pendingCount,0);
    assert.equal(queue.enqueue('MintToDelete'),false);
  }finally{
    queue.close();
  }
});