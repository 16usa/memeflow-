/**
 * Priority-first, age-aware, circuit-broken discovery queue.
 *
 * Fresh create signatures always run before queued retries.
 * Stale signatures are dropped at drain time without an RPC call.
 * A circuit breaker pauses transaction fetching for 10 s on repeated 429s.
 *
 * Exported:
 *   makeDiscoveryMetrics()  — flat metric object consumed by /api/discovery/status
 *   makeDiscoveryQueue()    — returns { enqueue, processing, circuitOpen, freshQueueDepth, retryQueueDepth }
 *
 * Imported by app-server.mjs.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isRateLimitError(e) {
  const msg = (e?.message || '').toLowerCase();
  return e?.status === 429 ||
    msg.includes('429') ||
    msg.includes('too many') ||
    msg.includes('rate limit') ||
    msg.includes('rate-limit') ||
    msg.includes('connection rate limit') ||
    msg.includes('data allowance') ||
    msg.includes('credits') ||
    msg.includes('quota');
}

export function isRetryableError(e) {
  if (e?.permanent) return false;
  return isRateLimitError(e) ||
    e.name === 'AbortError' ||
    /abort|operation was aborted/i.test(e.message || '') ||
    [502, 503, 504].includes(e.status) ||
    ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'].includes(e.code) ||
    /network|connection reset|ECONNRESET/i.test(e.message || '');
}

// ── Metric factory ────────────────────────────────────────────────────────────

export function makeDiscoveryMetrics() {
  return {
    eventsReceived: 0,
    eventsWithoutLogs: 0,
    eventsFiltered: 0,
    nonCreateEventsIgnored: 0,
    createEventsAccepted: 0,
    signaturesQueued: 0,
    signaturesProcessed: 0,
    signaturesDeduplicated: 0,
    queueDropped: 0,
    transactionFetchSucceeded: 0,
    transactionFetchFailed: 0,
    transactionRetryScheduled: 0,
    transactionRetryExhausted: 0,
    staleSignaturesDropped: 0,
    // decode counters
    createsDecoded: 0,
    decodeFailed: 0,
    noPumpInstruction: 0,
    pumpInstructionWithoutData: 0,
    unknownPumpDiscriminator: 0,
    invalidAccountLayout: 0,
    invalidMint: 0,
    createInstructionDecoded: 0,
    knownNonCreateIgnored: 0,
    ignoredPumpEventPayloads: 0,
    unknownPumpDiscriminatorsByValue: {},
    // enrichment
    enrichSucceeded: 0,
    enrichFailed: 0,
    lastSuccessfulScanAt: null,
    lastErrorAt: null,
    // queue shape
    freshQueueDepth: 0,
    retryQueueDepth: 0,
    rpcCircuitOpen: false,
    rpcCircuitOpenUntil: null,
    oldestQueuedSignatureAgeMs: null,
  };
}

// ── Queue ─────────────────────────────────────────────────────────────────────

/**
 * Create a priority-first discovery queue with circuit breaker.
 *
 * @param {object} config
 *   maxConcurrent          — concurrent getTransaction fetches (default 1)
 *   queueMax               — max fresh signatures queued (default 250)
 *   maxSignatureAgeMs      — drop sigs older than this before RPC (default 120000)
 *   maxRetries             — max getTransaction retries per signature (default 2)
 *   circuitBreakerPauseMs  — pause after 429/rate-limit (default 10000)
 *   retryDelays            — [ms] per retry attempt, indexed by attempt (default [2000, 5000])
 * @param {object} deps
 *   processFn(sig)         — async; must call rpc.callOnce; throws on retryable error
 *   discMetrics            — from makeDiscoveryMetrics()
 *   onSignatureProcessed() — called on clean success (optional)
 *   onSignatureFailed(e)   — called on final failure after retries (optional)
 */
export function makeDiscoveryQueue(config, deps) {
  const {
    maxConcurrent = 1,
    queueMax = 250,
    maxSignatureAgeMs = 120000,
    maxRetries = 2,
    circuitBreakerPauseMs = 10000,
    retryDelays = [2000, 5000],
  } = config || {};
  const { processFn, discMetrics, onSignatureProcessed, onSignatureFailed } = deps;

  // fresh queue: [{sig, enqueuedAt}] — new creates, run first
  const freshQueue = [];
  const freshSet   = new Set();

  // retry queue: [{sig, enqueuedAt, attempt}] — already-failed, lower priority
  const retryQueue = [];
  const retrySet   = new Set();

  const processing = new Set();

  let circuitOpenUntil  = 0;
  let circuitDrainTimer = null;

  // ── Internal helpers ────────────────────────────────────────────────────────

  function _sync() {
    discMetrics.freshQueueDepth  = freshQueue.length;
    discMetrics.retryQueueDepth  = retryQueue.length;
    discMetrics.rpcCircuitOpen   = Date.now() < circuitOpenUntil;
    discMetrics.rpcCircuitOpenUntil = discMetrics.rpcCircuitOpen ? circuitOpenUntil : null;
    const all = [...freshQueue, ...retryQueue];
    discMetrics.oldestQueuedSignatureAgeMs = all.length
      ? Date.now() - Math.min(...all.map(x => x.enqueuedAt))
      : null;
  }

  function _openCircuit() {
    circuitOpenUntil = Date.now() + circuitBreakerPauseMs;
    _sync();
    console.log(`[DISCQUEUE] circuit breaker open until ${new Date(circuitOpenUntil).toISOString()}`);
    if (circuitDrainTimer) clearTimeout(circuitDrainTimer);
    circuitDrainTimer = setTimeout(() => { circuitDrainTimer = null; _drain(); }, circuitBreakerPauseMs + 10);
  }

  function _isCircuitOpen() { return Date.now() < circuitOpenUntil; }

  function _dropStaleFrom(queue, set) {
    const now = Date.now();
    while (queue.length > 0 && now - queue[0].enqueuedAt > maxSignatureAgeMs) {
      const item = queue.shift();
      set.delete(item.sig);
      discMetrics.staleSignaturesDropped++;
    }
  }

  // ── Run a single item ───────────────────────────────────────────────────────

  async function _run(item) {
    const { sig, enqueuedAt, attempt = 0 } = item;

    // Stale check (double-checked just before the RPC call)
    if (Date.now() - enqueuedAt > maxSignatureAgeMs) {
      discMetrics.staleSignaturesDropped++;
      _release(sig);
      return;
    }

    try {
      await processFn(sig);
      discMetrics.signaturesProcessed++;
      if (onSignatureProcessed) onSignatureProcessed();
    } catch (e) {
      const rateLimited = isRateLimitError(e);
      if (rateLimited) _openCircuit();

      if (isRetryableError(e) && attempt < maxRetries) {
        const delayMs = e.retryAfterMs ?? retryDelays[Math.min(attempt, retryDelays.length - 1)] ?? 5000;
        discMetrics.transactionRetryScheduled++;
        processing.delete(sig);
        _sync();
        setTimeout(() => {
          if (!retrySet.has(sig) && !processing.has(sig)) {
            retryQueue.push({ sig, enqueuedAt, attempt: attempt + 1 });
            retrySet.add(sig);
            _sync();
            _drain();
          }
        }, delayMs);
        return; // don't call _release — already deleted from processing
      }

      // Final failure
      if (attempt >= maxRetries) discMetrics.transactionRetryExhausted++;
      discMetrics.transactionFetchFailed++;
      discMetrics.lastErrorAt = Date.now();
      if (onSignatureFailed) onSignatureFailed(e);
    }

    _release(sig);
  }

  function _release(sig) {
    processing.delete(sig);
    freshSet.delete(sig);
    retrySet.delete(sig);
    _sync();
    _drain();
  }

  // ── Drain: fresh-first, stale-aware, circuit-checked ───────────────────────

  function _drain() {
    if (_isCircuitOpen()) return;

    _dropStaleFrom(freshQueue, freshSet);
    _dropStaleFrom(retryQueue, retrySet);
    _sync();

    while (processing.size < maxConcurrent) {
      let item = null;

      // Fresh queue takes priority
      if (freshQueue.length > 0) {
        item = freshQueue.shift();
        freshSet.delete(item.sig);
      } else if (retryQueue.length > 0) {
        item = retryQueue.shift();
        retrySet.delete(item.sig);
      } else {
        break;
      }

      processing.add(item.sig);
      _sync();
      _run(item); // fire-and-forget; _release calls _drain again
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  function enqueue(sig) {
    if (freshSet.has(sig) || retrySet.has(sig) || processing.has(sig)) {
      discMetrics.signaturesDeduplicated++;
      return false;
    }
    if (freshQueue.length >= queueMax) {
      const dropped = freshQueue.shift();
      freshSet.delete(dropped.sig);
      discMetrics.queueDropped++;
    }
    freshQueue.push({ sig, enqueuedAt: Date.now() });
    freshSet.add(sig);
    discMetrics.signaturesQueued++;
    _sync();
    _drain();
    return true;
  }

  return {
    enqueue,
    get processing()       { return processing.size; },
    get circuitOpen()      { return _isCircuitOpen(); },
    get freshQueueDepth()  { return freshQueue.length; },
    get retryQueueDepth()  { return retryQueue.length; },
  };
}
