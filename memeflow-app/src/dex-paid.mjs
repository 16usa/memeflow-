// MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1
// One purpose only: verify a paid DEX Screener order for a Solana mint.
// No pair/pool/liquidity/volume logic belongs here.

const CONFIRMED_STATUSES = new Set([
  'processing',
  'on-hold',
  'approved'
]);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function cleanMint(value) {
  return String(value || '').trim();
}

function cleanStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function paymentTimestamp(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function isConfirmedDexPaidOrder(order = {}) {
  const paidAt = paymentTimestamp(order?.paymentTimestamp);
  const status = cleanStatus(order?.status);

  // The official /orders endpoint is specifically "Check paid orders".
  // We still require a real payment timestamp and reject terminal
  // cancelled/rejected orders. processing/on-hold/approved count as paid.
  return paidAt !== null && CONFIRMED_STATUSES.has(status);
}

export function summarizeDexPaidOrders(orders) {
  const rows = Array.isArray(orders) ? orders : [];
  const confirmed = rows
    .filter(isConfirmedDexPaidOrder)
    .sort(
      (a, b) =>
        (paymentTimestamp(b?.paymentTimestamp) || 0) -
        (paymentTimestamp(a?.paymentTimestamp) || 0)
    );

  const best = confirmed[0] || null;
  const statuses = [
    ...new Set(
      rows
        .map(row => cleanStatus(row?.status))
        .filter(Boolean)
    )
  ];

  return {
    confirmed: confirmed.length > 0,
    confirmedCount: confirmed.length,
    totalOrders: rows.length,
    status: best ? cleanStatus(best.status) : (statuses[0] || 'none'),
    paymentTimestamp: best ? paymentTimestamp(best.paymentTimestamp) : null,
    orderType: best ? String(best.type || '').trim() || null : null,
    statuses
  };
}

export function createDexPaidVerifier({
  fetchImpl = globalThis.fetch,
  endpointBase = 'https://api.dexscreener.com/orders/v1/solana',
  timeoutMs = 6000,
  minIntervalMs = 1100,
  positiveTtlMs = 15 * 60 * 1000,
  negativeTtlMs = 20 * 1000,
  errorTtlMs = 5 * 1000
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('DEX Paid verifier requires fetch');
  }

  const cache = new Map();
  const inflight = new Map();

  let nextSlotAt = 0;
  let rateTail = Promise.resolve();

  const stats = {
    requests: 0,
    cacheHits: 0,
    positives: 0,
    negatives: 0,
    errors: 0,
    lastRequestAt: null,
    lastError: null,
    lastErrorAt: null
  };

  function peek(mint, now = Date.now()) {
    mint = cleanMint(mint);
    if (!mint) return null;

    const row = cache.get(mint);
    if (!row) return null;

    if (Number(row.expiresAt || 0) <= now) {
      cache.delete(mint);
      return null;
    }

    return row;
  }

  async function reserveRateSlot() {
    const previous = rateTail;
    let release;
    rateTail = new Promise(resolve => {
      release = resolve;
    });

    await previous;

    try {
      const waitMs = Math.max(0, nextSlotAt - Date.now());
      if (waitMs > 0) await sleep(waitMs);
      nextSlotAt = Date.now() + Math.max(1000, Number(minIntervalMs) || 1100);
    } finally {
      release();
    }
  }

  async function requestOrders(mint) {
    await reserveRateSlot();

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Math.max(1000, Number(timeoutMs) || 6000)
    );
    timer.unref?.();

    try {
      stats.requests += 1;
      stats.lastRequestAt = Date.now();

      const response = await fetchImpl(
        `${endpointBase}/${encodeURIComponent(mint)}`,
        {
          method: 'GET',
          headers: {accept: 'application/json'},
          signal: controller.signal
        }
      );

      if (!response?.ok) {
        const error = new Error(`DEX Paid HTTP ${response?.status || 0}`);
        error.status = Number(response?.status || 0);
        throw error;
      }

      const body = await response.json();

      if (!Array.isArray(body)) {
        throw new Error('Invalid DEX Paid response');
      }

      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  async function check(mint, {force = false} = {}) {
    mint = cleanMint(mint);
    if (!mint) {
      return {
        confirmed: null,
        degraded: true,
        error: 'mint required',
        checkedAt: Date.now(),
        expiresAt: Date.now() + errorTtlMs
      };
    }

    if (!force) {
      const cached = peek(mint);
      if (cached) {
        stats.cacheHits += 1;
        return cached;
      }
    }

    const active = inflight.get(mint);
    if (active) return active;

    const task = (async () => {
      try {
        const orders = await requestOrders(mint);
        const summary = summarizeDexPaidOrders(orders);
        const now = Date.now();

        const row = {
          ...summary,
          degraded: false,
          error: null,
          checkedAt: now,
          expiresAt:
            now +
            (
              summary.confirmed
                ? positiveTtlMs
                : negativeTtlMs
            )
        };

        cache.set(mint, row);

        if (row.confirmed) stats.positives += 1;
        else stats.negatives += 1;

        return row;
      } catch (error) {
        stats.errors += 1;
        stats.lastError = String(error?.message || error).slice(0, 240);
        stats.lastErrorAt = Date.now();

        const previous = cache.get(mint);
        if (previous?.confirmed === true) {
          const preserved = {
            ...previous,
            degraded: true,
            error: stats.lastError,
            expiresAt: Date.now() + errorTtlMs
          };
          cache.set(mint, preserved);
          return preserved;
        }

        const now = Date.now();
        const row = {
          confirmed: null,
          confirmedCount: 0,
          totalOrders: 0,
          status: 'unavailable',
          paymentTimestamp: null,
          orderType: null,
          statuses: [],
          degraded: true,
          error: stats.lastError,
          checkedAt: now,
          expiresAt: now + errorTtlMs
        };

        cache.set(mint, row);
        return row;
      } finally {
        inflight.delete(mint);
      }
    })();

    inflight.set(mint, task);
    return task;
  }

  function drop(mint) {
    mint = cleanMint(mint);
    if (!mint) return;
    cache.delete(mint);
    inflight.delete(mint);
  }

  return {
    check,
    peek,
    drop,
    stats,
    cache,
    inflight
  };
}
