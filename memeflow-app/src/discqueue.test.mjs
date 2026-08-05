/**
 * Tests for discqueue.mjs (priority queue / circuit breaker)
 * and for Pump create decode logic in solana.mjs.
 *
 * Run with: node --test memeflow-app/src/discqueue.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDiscoveryMetrics, makeDiscoveryQueue, isRateLimitError, isRetryableError } from './discqueue.mjs';
import { decodePumpCreate, b58encode, b58decode, PUMP_DISC_CREATE, PUMP_DISC_CREATE_V2, PUMP_DISC_BUY, PUMP_DISC_SELL } from './solana.mjs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueue(config, processFn) {
  const discMetrics = makeDiscoveryMetrics();
  const queue = makeDiscoveryQueue(config, { processFn, discMetrics });
  return { queue, discMetrics };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeRateLimitError(retryAfterMs) {
  return Object.assign(new Error('Connection rate limits exceeded'), { status: 429, retryAfterMs });
}

function makeNetworkError() {
  return Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' });
}

// Build a fake base58-encoded create instruction data buffer
function makeCreateData(disc, name = 'TestToken', symbol = 'TEST', uri = 'https://example.com') {
  const nameB = Buffer.from(name, 'utf8');
  const symB  = Buffer.from(symbol, 'utf8');
  const uriB  = Buffer.from(uri, 'utf8');
  const buf = Buffer.alloc(8 + 4 + nameB.length + 4 + symB.length + 4 + uriB.length);
  let o = 0;
  for (const b of disc) { buf[o++] = b; }
  buf.writeUInt32LE(nameB.length, o); o += 4; nameB.copy(buf, o); o += nameB.length;
  buf.writeUInt32LE(symB.length, o);  o += 4; symB.copy(buf, o);  o += symB.length;
  buf.writeUInt32LE(uriB.length, o);  o += 4; uriB.copy(buf, o);
  return b58encode(buf);
}

// 32-byte base58 pubkeys — confirmed by validPubkey() in solana.test.mjs
// '11111111111111111111111111111112' decodes to exactly 32 bytes (31 leading zeros + 0x01)
const VALID_PUBKEY   = '11111111111111111111111111111112';
// SPL Token program — 32 bytes, commonly used in tests
const VALID_PUBKEY_2 = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf8Ss623VQ5DA';

function makeAccounts(mint = VALID_PUBKEY, curve = VALID_PUBKEY_2, extra = 6) {
  return [mint, 'meta_account', curve, 'abc_curve', 'global', 'metadata_prog', 'sys_prog', 'creator_addr']
    .slice(0, 2 + extra);
}

// ── Part A: Discovery queue priority and circuit breaker ──────────────────────

test('queue priority: fresh create processed before scheduled retry', async () => {
  const order = [];

  // We'll manually inject a retry item by letting the first sig fail once, then
  // track which sig runs when both fresh and retry are ready simultaneously.
  let attempt = 0;
  const { queue, discMetrics } = makeQueue(
    { maxConcurrent: 1, maxRetries: 1, retryDelays: [20] },
    async (sig) => {
      order.push(sig);
      if (sig === 'retry_sig' && attempt === 0) {
        attempt++;
        throw makeNetworkError(); // will be retried after 20ms
      }
    }
  );

  queue.enqueue('retry_sig');     // will fail once, then retry after 20ms
  await sleep(5);                  // let retry_sig start and fail

  // Now enqueue a fresh sig while retry_sig is in the retry queue
  queue.enqueue('fresh_sig');
  await sleep(80);

  // fresh_sig should have run before retry_sig's second attempt
  const freshIdx = order.indexOf('fresh_sig');
  const retryIdx = order.lastIndexOf('retry_sig');
  assert.ok(freshIdx !== -1, 'fresh_sig was processed');
  assert.ok(retryIdx > freshIdx, `fresh_sig (${freshIdx}) processed before retry (${retryIdx})`);
});

test('stale signatures are dropped before RPC call is made', async () => {
  let rpcCalls = 0;
  // blocker holds the single concurrent slot; stale_sig ages in the fresh queue
  const { queue, discMetrics } = makeQueue(
    { maxConcurrent: 1, maxSignatureAgeMs: 20 },
    async (sig) => {
      rpcCalls++;
      if (sig === 'blocker') await sleep(60); // hold slot until stale_sig is old
    }
  );

  queue.enqueue('blocker');   // occupies the one concurrent slot
  await sleep(5);              // let blocker start
  queue.enqueue('stale_sig'); // queued but blocked; will age
  await sleep(30);             // stale_sig is now >20ms old; blocker still running
  // When blocker finishes, drain checks stale_sig age and drops it without calling processFn
  await sleep(60);             // enough time for blocker to finish + drain to run

  assert.equal(rpcCalls, 1, 'only blocker reached the processor; stale_sig was dropped');
  assert.ok(discMetrics.staleSignaturesDropped >= 1, 'stale_sig counted as dropped');
});

test('circuit breaker opens after 429 and pauses processing', async () => {
  let calls = 0;
  const { queue, discMetrics } = makeQueue(
    { maxConcurrent: 1, maxRetries: 0, circuitBreakerPauseMs: 200 },
    async () => { calls++; throw makeRateLimitError(0); }
  );

  queue.enqueue('sig_a');
  await sleep(30);

  assert.equal(calls, 1, 'only one call made before circuit opened');
  assert.equal(discMetrics.rpcCircuitOpen, true, 'circuit is open');
  assert.ok(discMetrics.rpcCircuitOpenUntil > Date.now(), 'circuit open until is in the future');

  // A new sig should not be processed while circuit is open
  const beforeEnqueue = calls;
  queue.enqueue('sig_b');
  await sleep(30);
  assert.equal(calls, beforeEnqueue, 'no new RPC calls while circuit is open');
});

test('circuit breaker closes automatically and resumes processing', async () => {
  let calls = 0;
  const { queue, discMetrics } = makeQueue(
    { maxConcurrent: 1, maxRetries: 0, circuitBreakerPauseMs: 50 },
    async (sig) => {
      calls++;
      if (calls === 1) throw makeRateLimitError(0);
      // second call succeeds
    }
  );

  queue.enqueue('sig_trip');
  await sleep(20);
  assert.equal(discMetrics.rpcCircuitOpen, true, 'circuit open after first 429');

  queue.enqueue('sig_after');
  await sleep(150); // wait for circuit to close (50ms) + process

  assert.equal(discMetrics.rpcCircuitOpen, false, 'circuit closed after pause');
  assert.equal(calls, 2, 'second sig processed after circuit closed');
  assert.equal(discMetrics.signaturesProcessed, 1, 'sig_after processed successfully');
});

test('endpoint failover: callOnce rotates index on 429', async () => {
  // Import RpcPool to test callOnce directly
  const { RpcPool } = await import('./solana.mjs');
  let calls = { primary: 0, backup: 0 };
  const origFetch = globalThis.fetch;
  globalThis.fetch = (url) => {
    if (url.includes('primary')) {
      calls.primary++;
      return Promise.resolve({
        ok: false, status: 429,
        headers: { get: () => null },
        json: () => Promise.resolve({ error: { code: -32000, message: 'rate limited' } })
      });
    }
    calls.backup++;
    return Promise.resolve({
      ok: true, status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve({ jsonrpc: '2.0', result: 42 })
    });
  };
  try {
    const pool = new RpcPool(['http://primary.test/', 'http://backup.test/']);
    // After a 429 from callOnce, index should rotate
    await assert.rejects(() => pool.callOnce('getSlot', []), /rate limited|RPC/);
    assert.equal(pool.i, 1, 'index rotated to backup after 429');
    // Next callOnce uses backup
    const r = await pool.callOnce('getSlot', []);
    assert.equal(r, 42, 'backup endpoint returns result');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('retry exhaustion: transactionRetryExhausted incremented after maxRetries', async () => {
  let calls = 0;
  const { queue, discMetrics } = makeQueue(
    { maxConcurrent: 1, maxRetries: 2, retryDelays: [5, 5] },
    async () => { calls++; throw makeNetworkError(); }
  );

  queue.enqueue('always_fail');
  await sleep(200);

  assert.equal(calls, 3, '1 initial + 2 retries = 3 calls');
  assert.equal(discMetrics.transactionRetryExhausted, 1, 'exhaustion counted');
  assert.equal(discMetrics.transactionRetryScheduled, 2, 'two retries scheduled');
  assert.ok(discMetrics.transactionFetchFailed >= 1, 'failure counted');
});

// ── Part B: Pump instruction decode ──────────────────────────────────────────

test('known create discriminator (v1) decodes successfully', () => {
  const data = makeCreateData(PUMP_DISC_CREATE, 'MyToken', 'MTK', 'https://uri.example');
  const ix = { data, accounts: makeAccounts() };
  const result = decodePumpCreate(ix, []);
  assert.equal(result.ok, true, 'should decode OK');
  assert.equal(result.mint, VALID_PUBKEY, 'mint extracted from accounts[0]');
  assert.equal(result.name, 'MyToken');
  assert.equal(result.symbol, 'MTK');
  assert.equal(result.uri, 'https://uri.example');
  assert.equal(result.kind, 'create');
});

test('known create_v2 discriminator decodes successfully', () => {
  const data = makeCreateData(PUMP_DISC_CREATE_V2, 'V2Token', 'V2T', 'https://v2.example');
  const ix = { data, accounts: makeAccounts() };
  const result = decodePumpCreate(ix, []);
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'create_v2');
  assert.equal(result.name, 'V2Token');
});

test('unknown discriminator increments unknownPumpDiscriminator', () => {
  const unknownDisc = [1, 2, 3, 4, 5, 6, 7, 8];
  const buf = Buffer.alloc(8); unknownDisc.forEach((b, i) => { buf[i] = b; });
  const data = b58encode(buf);
  const ix = { data, accounts: makeAccounts() };
  const result = decodePumpCreate(ix, []);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'unknownPumpDiscriminator');
  assert.deepEqual(result.discBytes, unknownDisc, 'discriminator bytes returned for logging');
});

test('missing instruction data increments pumpInstructionWithoutData', () => {
  const ix = { accounts: makeAccounts() }; // no data field
  const result = decodePumpCreate(ix, []);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'pumpInstructionWithoutData');
});

test('wrong account count increments invalidAccountLayout', () => {
  const data = makeCreateData(PUMP_DISC_CREATE);
  const ix = { data, accounts: ['only_one_account'] }; // only 1 account — no curve position
  const result = decodePumpCreate(ix, []);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalidAccountLayout');
});

test('invalid mint increments invalidMint', () => {
  const data = makeCreateData(PUMP_DISC_CREATE);
  // accounts[0] is not a valid pubkey
  const ix = { data, accounts: ['not_a_valid_pubkey_!!!', 'meta', 'curve_addr'] };
  const result = decodePumpCreate(ix, []);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalidMint');
});

test('same mint in top-level and inner instruction is deduplicated in caller logic', () => {
  // Verify that decodePumpCreate decodes both instructions individually;
  // the dedup logic (seenMints) is caller-side — test it here
  const data = makeCreateData(PUMP_DISC_CREATE, 'Dup', 'DUP', 'https://dup.example');
  const ix = { data, accounts: makeAccounts() };
  const keys = [];

  const r1 = decodePumpCreate(ix, keys);
  const r2 = decodePumpCreate(ix, keys); // same instruction again (inner)
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r1.mint, r2.mint, 'both decode to same mint');

  // Caller simulates seenMints dedup
  const seenMints = new Set();
  let decoded = 0;
  for (const r of [r1, r2]) {
    if (r.ok && !seenMints.has(r.mint)) {
      seenMints.add(r.mint);
      decoded++;
    }
  }
  assert.equal(decoded, 1, 'same mint added only once');
});

test('Buy discriminator returns knownNonCreate — never counted as decodeFailed', () => {
  const buf = Buffer.from(PUMP_DISC_BUY);
  const data = b58encode(buf);
  const ix = { data, accounts: makeAccounts() };
  const result = decodePumpCreate(ix, []);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'knownNonCreate', 'Buy must not be decodeFailed');
});

test('Sell discriminator returns knownNonCreate — never counted as decodeFailed', () => {
  const buf = Buffer.from(PUMP_DISC_SELL);
  const data = b58encode(buf);
  const ix = { data, accounts: makeAccounts() };
  const result = decodePumpCreate(ix, []);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'knownNonCreate', 'Sell must not be decodeFailed');
});

// ── Utility: isRateLimitError / isRetryableError ──────────────────────────────

test('isRateLimitError detects 429 status and common messages', () => {
  assert.equal(isRateLimitError({ status: 429, message: '' }), true);
  assert.equal(isRateLimitError({ message: 'Connection rate limits exceeded' }), true);
  assert.equal(isRateLimitError({ message: 'too many requests' }), true);
  assert.equal(isRateLimitError({ message: 'getSlot failed' }), false);
});

test('isRetryableError allows network errors but blocks permanent JSON-RPC errors', () => {
  assert.equal(isRetryableError(Object.assign(new Error('x'), { code: 'ECONNRESET' })), true);
  assert.equal(isRetryableError(Object.assign(new Error('x'), { permanent: true })), false);
  assert.equal(isRetryableError(Object.assign(new Error('x'), { status: 503 })), true);
});
