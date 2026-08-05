/**
 * Tests for memeflow-app/src/enrich.mjs — partial enrichment success.
 * Run with: node --test memeflow-app/src/enrich.test.mjs
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enrichToken, makeEnrichDiag, recordEnrichError} from './enrich.mjs';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const MINT = '11111111111111111111111111111112';
const CURVE = '22222222222222222222222222222223';

function makeStore() {
  const tokens = {};
  return {
    state: {tokens, users: {}, metrics: {errors: 0}},
    setToken(mint, update) {
      tokens[mint] = {...(tokens[mint] || {}), ...update, mint, updatedAt: Date.now()};
      return tokens[mint];
    },
    save() {},
  };
}

function makeDiscMetrics() {
  return {enrichSucceeded: 0, enrichFailed: 0};
}

/** Build a mock RPC where each method returns a value or throws an Error. */
function makeRpc(responses = {}) {
  return {
    call: async (method) => {
      if (method in responses) {
        const v = responses[method];
        if (v instanceof Error) throw v;
        return v;
      }
      throw new Error(`Unexpected RPC call: ${method}`);
    },
  };
}

const SUPPLY_RESP = {
  value: {decimals: 6, uiAmountString: '1000000000'},
};
const LARGEST_RESP = {
  value: [
    {uiAmountString: '100000000'}, // 10 %
    {uiAmountString: '50000000'},  // 5 %
    {uiAmountString: '0'},
  ],
};
// A minimal valid bonding-curve account (49+ bytes, all zeros except structure)
// We pass null curveInfo to skip decodeCurve in most tests.
const NO_CURVE_INFO = {value: null};

function noop() {}
function alwaysPublish(mint) {}

// ─────────────────────────────────────────────────────────────────────────────
// 1. All steps succeed → enrichSucceeded incremented, lastEnrichError cleared
// ─────────────────────────────────────────────────────────────────────────────
await test('Full success: all steps succeed, enrichSucceeded incremented', async () => {
  const store = makeStore();
  const discMetrics = makeDiscMetrics();
  const enrichDiag = makeEnrichDiag();
  enrichDiag.lastEnrichError = 'stale error from before';

  const rpc = makeRpc({
    getTokenSupply: SUPPLY_RESP,
    getTokenLargestAccounts: LARGEST_RESP,
  });

  let published = false;
  await enrichToken(MINT, null, {
    rpc, store, tradeWindows: new Map(),
    evaluateAll: noop,
    publish: () => { published = true; },
    ensurePriceTimer: noop,
    discMetrics, enrichDiag,
  });

  assert.equal(discMetrics.enrichSucceeded, 1, 'enrichSucceeded incremented');
  assert.equal(discMetrics.enrichFailed, 0);
  assert.equal(published, true, 'publish called');
  assert.equal(enrichDiag.lastEnrichError, null, 'stale error cleared after full success');
  assert.ok(store.state.tokens[MINT], 'token stored');
  assert.equal(store.state.tokens[MINT].holderFresh, true);
  assert.equal(store.state.tokens[MINT].scanError, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. supply succeeds, getTokenLargestAccounts fails
//    → token stored with supply data, holderFresh=false
// ─────────────────────────────────────────────────────────────────────────────
await test('Partial: supply OK, largest accounts fails → holderFresh false, supply stored', async () => {
  const store = makeStore();
  const discMetrics = makeDiscMetrics();
  const enrichDiag = makeEnrichDiag();

  const rpc = makeRpc({
    getTokenSupply: SUPPLY_RESP,
    getTokenLargestAccounts: new Error('Too many requests'),
  });

  await enrichToken(MINT, null, {
    rpc, store, tradeWindows: new Map(),
    evaluateAll: noop, publish: noop, ensurePriceTimer: noop,
    discMetrics, enrichDiag,
  });

  assert.equal(discMetrics.enrichSucceeded, 1, 'still counts as success (token stored + published)');
  assert.equal(discMetrics.enrichFailed, 0);
  const t = store.state.tokens[MINT];
  assert.ok(t, 'token stored despite partial failure');
  assert.equal(t.holderFresh, false, 'holderFresh false because holder step failed');
  assert.equal(t.totalSupply, 1000000000, 'supply data preserved');
  assert.equal(enrichDiag.enrichStepFailures.getTokenLargestAccounts, 1);
  assert.ok(enrichDiag.lastEnrichError?.includes('getTokenLargestAccounts'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Curve account unavailable (getAccountInfo returns null value)
//    → holder/supply data still stored, holderFresh true
// ─────────────────────────────────────────────────────────────────────────────
await test('Partial: curve account unavailable → supply+holder data preserved, holderFresh true', async () => {
  const store = makeStore();
  const discMetrics = makeDiscMetrics();
  const enrichDiag = makeEnrichDiag();

  const rpc = makeRpc({
    getTokenSupply: SUPPLY_RESP,
    getTokenLargestAccounts: LARGEST_RESP,
    getAccountInfo: {value: null},   // account not found — no data to decode
  });

  await enrichToken(MINT, CURVE, {
    rpc, store, tradeWindows: new Map(),
    evaluateAll: noop, publish: noop, ensurePriceTimer: noop,
    discMetrics, enrichDiag,
  });

  assert.equal(discMetrics.enrichSucceeded, 1);
  const t = store.state.tokens[MINT];
  assert.ok(t);
  assert.equal(t.holderFresh, true, 'holder data succeeded, so holderFresh must be true');
  assert.equal(t.totalSupply, 1000000000, 'supply stored');
  // No curve data — priceSol should not be set (or undefined)
  assert.ok(t.priceSol == null, 'priceSol absent when curve unavailable');
  assert.equal(enrichDiag.enrichStepFailures.getAccountInfo, 0, 'null result is not a failure');
  assert.equal(enrichDiag.enrichStepFailures.decodeCurve, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. getAccountInfo throws → curve step fails, holder+supply data still stored
// ─────────────────────────────────────────────────────────────────────────────
await test('Partial: getAccountInfo throws → holder/supply data preserved, holderFresh unaffected', async () => {
  const store = makeStore();
  const discMetrics = makeDiscMetrics();
  const enrichDiag = makeEnrichDiag();

  const rpc = makeRpc({
    getTokenSupply: SUPPLY_RESP,
    getTokenLargestAccounts: LARGEST_RESP,
    getAccountInfo: new Error('RPC HTTP 503'),
  });

  await enrichToken(MINT, CURVE, {
    rpc, store, tradeWindows: new Map(),
    evaluateAll: noop, publish: noop, ensurePriceTimer: noop,
    discMetrics, enrichDiag,
  });

  assert.equal(discMetrics.enrichSucceeded, 1);
  const t = store.state.tokens[MINT];
  assert.equal(t.holderFresh, true, 'getAccountInfo failure must NOT affect holderFresh');
  assert.equal(t.totalSupply, 1000000000);
  assert.equal(enrichDiag.enrichStepFailures.getAccountInfo, 1);
  // holderFresh is independent of curve step
  assert.ok(enrichDiag.lastEnrichError?.includes('getAccountInfo'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. decodeCurve throws (malformed data)
//    → supply+holder stored, curve fields absent, enrichSucceeded still increments
// ─────────────────────────────────────────────────────────────────────────────
await test('Partial: decodeCurve fails → supply+holder stored, curve fields absent', async () => {
  const store = makeStore();
  const discMetrics = makeDiscMetrics();
  const enrichDiag = makeEnrichDiag();

  // Provide a short base64 blob that will fail decodeCurve (< 49 bytes)
  const shortData = Buffer.alloc(10).toString('base64');
  const rpc = makeRpc({
    getTokenSupply: SUPPLY_RESP,
    getTokenLargestAccounts: LARGEST_RESP,
    getAccountInfo: {value: {data: [shortData, 'base64']}},
  });

  await enrichToken(MINT, CURVE, {
    rpc, store, tradeWindows: new Map(),
    evaluateAll: noop, publish: noop, ensurePriceTimer: noop,
    discMetrics, enrichDiag,
  });

  assert.equal(discMetrics.enrichSucceeded, 1);
  const t = store.state.tokens[MINT];
  assert.equal(t.holderFresh, true);
  assert.equal(t.totalSupply, 1000000000);
  assert.ok(t.priceSol == null, 'priceSol absent when decodeCurve failed');
  assert.equal(enrichDiag.enrichStepFailures.decodeCurve, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. evaluate throws → token still published, enrichSucceeded still increments
// ─────────────────────────────────────────────────────────────────────────────
await test('Partial: evaluate throws → publish still called, enrichSucceeded incremented', async () => {
  const store = makeStore();
  const discMetrics = makeDiscMetrics();
  const enrichDiag = makeEnrichDiag();

  const rpc = makeRpc({
    getTokenSupply: SUPPLY_RESP,
    getTokenLargestAccounts: LARGEST_RESP,
  });

  let published = false;
  await enrichToken(MINT, null, {
    rpc, store, tradeWindows: new Map(),
    evaluateAll: () => { throw new Error('scoring bug'); },
    publish: () => { published = true; },
    ensurePriceTimer: noop,
    discMetrics, enrichDiag,
  });

  assert.equal(discMetrics.enrichSucceeded, 1, 'evaluate failure must not prevent enrichSucceeded');
  assert.equal(published, true, 'publish called despite evaluate error');
  assert.equal(enrichDiag.enrichStepFailures.evaluate, 1);
  assert.ok(enrichDiag.lastEnrichError?.includes('evaluate'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Partial token appears in store and is retrievable
// ─────────────────────────────────────────────────────────────────────────────
await test('Partial token stored and retrievable even with multiple step failures', async () => {
  const store = makeStore();
  const discMetrics = makeDiscMetrics();
  const enrichDiag = makeEnrichDiag();

  // Only supply succeeds
  const rpc = makeRpc({
    getTokenSupply: SUPPLY_RESP,
    getTokenLargestAccounts: new Error('rate limited'),
    getAccountInfo: new Error('RPC HTTP 429'),
  });

  await enrichToken(MINT, CURVE, {
    rpc, store, tradeWindows: new Map(),
    evaluateAll: noop, publish: noop, ensurePriceTimer: noop,
    discMetrics, enrichDiag,
  });

  const t = store.state.tokens[MINT];
  assert.ok(t, 'token must be in store');
  assert.equal(t.totalSupply, 1000000000, 'supply data in store');
  assert.equal(t.holderFresh, false, 'holder failed');
  assert.equal(t.scanError, null, 'scanError cleared on partial success');
  assert.ok(t.lastScannedAt, 'lastScannedAt set');
  assert.equal(discMetrics.enrichSucceeded, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. lastEnrichError cleared after fully successful enrichment
// ─────────────────────────────────────────────────────────────────────────────
await test('lastEnrichError cleared after a fully clean enrichment', async () => {
  const store = makeStore();
  const discMetrics = makeDiscMetrics();
  const enrichDiag = makeEnrichDiag();
  enrichDiag.lastEnrichError = 'getTokenLargestAccounts: rate limited';
  enrichDiag.lastEnrichErrorAt = 1;
  enrichDiag.lastEnrichMint = MINT;

  const rpc = makeRpc({
    getTokenSupply: SUPPLY_RESP,
    getTokenLargestAccounts: LARGEST_RESP,
  });

  await enrichToken(MINT, null, {
    rpc, store, tradeWindows: new Map(),
    evaluateAll: noop, publish: noop, ensurePriceTimer: noop,
    discMetrics, enrichDiag,
  });

  assert.equal(enrichDiag.lastEnrichError, null, 'cleared after full success');
  assert.equal(enrichDiag.lastEnrichErrorAt, null);
  assert.equal(enrichDiag.lastEnrichMint, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. lastEnrichError persists when a step still fails (partial enrichment)
// ─────────────────────────────────────────────────────────────────────────────
await test('lastEnrichError persists after partial enrichment', async () => {
  const store = makeStore();
  const discMetrics = makeDiscMetrics();
  const enrichDiag = makeEnrichDiag();

  const rpc = makeRpc({
    getTokenSupply: SUPPLY_RESP,
    getTokenLargestAccounts: new Error('rate limited'),
  });

  await enrichToken(MINT, null, {
    rpc, store, tradeWindows: new Map(),
    evaluateAll: noop, publish: noop, ensurePriceTimer: noop,
    discMetrics, enrichDiag,
  });

  assert.ok(enrichDiag.lastEnrichError !== null, 'lastEnrichError must persist on partial');
  assert.ok(enrichDiag.lastEnrichErrorAt !== null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. enrichFailureReasons groups by sanitized message
// ─────────────────────────────────────────────────────────────────────────────
await test('enrichFailureReasons accumulates counts by sanitized error message', async () => {
  const store = makeStore();
  const discMetrics = makeDiscMetrics();
  const enrichDiag = makeEnrichDiag();

  // Call enrichToken twice, both failing on largest accounts with the same message
  for (let i = 0; i < 2; i++) {
    const rpc = makeRpc({
      getTokenSupply: SUPPLY_RESP,
      getTokenLargestAccounts: new Error('Too many requests'),
    });
    await enrichToken(MINT, null, {
      rpc, store, tradeWindows: new Map(),
      evaluateAll: noop, publish: noop, ensurePriceTimer: noop,
      discMetrics, enrichDiag,
    });
  }

  const reasons = enrichDiag.enrichFailureReasons;
  const key = Object.keys(reasons)[0];
  assert.ok(key, 'at least one reason recorded');
  assert.equal(reasons[key], 2, 'same error counted twice');
  assert.ok(!key.includes('http'), 'no raw URL in sanitized key');
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. supply fails → nothing enriched, but enrichFailed NOT incremented
//     (store is still called with whatever we have; enrichSucceeded counts it)
// ─────────────────────────────────────────────────────────────────────────────
await test('supply fails → enrichSucceeded still counts (token stored with minimal fields)', async () => {
  const store = makeStore();
  const discMetrics = makeDiscMetrics();
  const enrichDiag = makeEnrichDiag();

  const rpc = makeRpc({
    getTokenSupply: new Error('RPC HTTP 429'),
    // getTokenLargestAccounts should NOT be called (we skip when supply failed)
  });

  await enrichToken(MINT, null, {
    rpc, store, tradeWindows: new Map(),
    evaluateAll: noop, publish: noop, ensurePriceTimer: noop,
    discMetrics, enrichDiag,
  });

  // Token stored with scanError:null and lastScannedAt even without supply
  const t = store.state.tokens[MINT];
  assert.ok(t, 'token stored even when supply fails');
  assert.equal(t.scanError, null);
  assert.equal(t.holderFresh, false, 'holderFresh false — largest accounts not attempted');
  // No totalSupply set
  assert.ok(t.totalSupply == null);
  assert.equal(discMetrics.enrichSucceeded, 1, 'still a success — store+publish completed');
  assert.equal(enrichDiag.enrichStepFailures.getTokenSupply, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. recordEnrichError sanitizes RPC URLs and base58 addresses
// ─────────────────────────────────────────────────────────────────────────────
test('recordEnrichError sanitizes URLs and long addresses', () => {
  const diag = makeEnrichDiag();
  const e = new Error('fetch failed: https://api.mainnet-beta.solana.com/rpc https://backup.rpc.com 11111111111111111111111111111112');
  recordEnrichError(diag, MINT, 'getTokenSupply', e);
  assert.ok(!diag.lastEnrichError.includes('http'), 'URL stripped');
  assert.ok(!diag.lastEnrichError.includes('11111111111111111111111111111112'), 'address stripped');
  assert.ok(diag.lastEnrichError.includes('[rpc-url]'), 'URL replaced');
});
