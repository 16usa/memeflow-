const VERSION = 'PUMP_DEX_VERIFICATION_GATE_V1';
const WSOL = 'So11111111111111111111111111111111111111112';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

function pairActivity(pair) {
  for (const window of ['m5', 'h1', 'h6', 'h24']) {
    const row = pair?.txns?.[window];
    const buys = Number(row?.buys || 0);
    const sells = Number(row?.sells || 0);
    if (buys + sells > 0) return { window, buys, sells };
  }
  return { window: null, buys: 0, sells: 0 };
}

function choosePair(rows, mint) {
  const candidates = (Array.isArray(rows) ? rows : []).filter(pair => {
    if (String(pair?.chainId || '').toLowerCase() !== 'solana') return false;
    const base = String(pair?.baseToken?.address || '');
    const quote = String(pair?.quoteToken?.address || '');
    const solPaired = (base === mint && quote === WSOL) || (quote === mint && base === WSOL);
    if (!solPaired) return false;
    const activity = pairActivity(pair);
    if (activity.buys + activity.sells <= 0) return false;
    const liquidityUsd = Number(pair?.liquidity?.usd);
    if (!Number.isFinite(liquidityUsd) || liquidityUsd <= 0) return false;
    return Boolean(pair?.pairAddress && pair?.url);
  });
  candidates.sort((a, b) => Number(b?.liquidity?.usd || 0) - Number(a?.liquidity?.usd || 0));
  return candidates[0] || null;
}

function marketPatch(pair, mint) {
  const activity = pairActivity(pair);
  const pressure = activity.sells > 0 ? activity.buys / activity.sells : activity.buys > 0 ? Math.max(1, activity.buys) : null;
  const base = String(pair?.baseToken?.address || '');
  const quote = String(pair?.quoteToken?.address || '');
  let priceSol = null;

  if (base === mint && quote === WSOL && finite(pair?.priceNative) && Number(pair.priceNative) > 0) {
    priceSol = Number(pair.priceNative);
  } else if (quote === mint && base === WSOL && finite(pair?.priceNative) && Number(pair.priceNative) > 0) {
    priceSol = 1 / Number(pair.priceNative);
  }

  const patch = {
    dexConfirmed: true,
    dexPairAddress: pair?.pairAddress || null,
    dexId: pair?.dexId || null,
    dexUrl: pair?.url || null,
    dexPairCreatedAt: Number(pair?.pairCreatedAt) || null,
    dexMarketUpdatedAt: Date.now(),
    marketSource: 'dexscreener',
    priceSource: 'dexscreener',
    buyPressureSource: 'dexscreener-' + (activity.window || 'available') + '-tx-count',
    buyPressure: finite(pressure) ? Number(pressure) : null,
    buyTransactions: activity.buys,
    sellTransactions: activity.sells,
    totalTransactions: activity.buys + activity.sells,
    priceSol,
    priceUsd: finite(pair?.priceUsd) ? Number(pair.priceUsd) : null,
    liquidityUsd: finite(pair?.liquidity?.usd) ? Number(pair.liquidity.usd) : null,
    marketCapUsd: finite(pair?.marketCap) ? Number(pair.marketCap) : null,
    fdvUsd: finite(pair?.fdv) ? Number(pair.fdv) : null,
    volume24hUsd: finite(pair?.volume?.h24) ? Number(pair.volume.h24) : null,
    volume6hUsd: finite(pair?.volume?.h6) ? Number(pair.volume.h6) : null,
    volume1hUsd: finite(pair?.volume?.h1) ? Number(pair.volume.h1) : null,
    volume5mUsd: finite(pair?.volume?.m5) ? Number(pair.volume.m5) : null,
    lastPriceAt: Date.now()
  };
  for (const key of Object.keys(patch)) if (patch[key] === null) delete patch[key];
  return patch;
}

function retryDelay(attempt) {
  const schedule = [1000, 2000, 4000, 8000, 15000, 30000, 60000, 120000, 240000, 300000, 600000];
  return schedule[Math.min(attempt, schedule.length - 1)];
}

function marketDelay(verifiedAt) {
  const age = Date.now() - Number(verifiedAt || Date.now());
  if (age < 2 * 60_000) return 3000;
  if (age < 15 * 60_000) return 10_000;
  if (age < 60 * 60_000) return 30_000;
  return 60_000;
}

export function createDexVerificationGate(options = {}) {
  const { onVerified = null, onMarket = null } = options;
  const pendingMax = Math.max(300, Math.min(10_000, Number(process.env.DEX_VERIFY_PENDING_MAX || 3000)));
  const ttlMs = Math.max(5 * 60_000, Math.min(3 * 60 * 60_000, Number(process.env.DEX_VERIFY_TTL_MS || 2 * 60 * 60_000)));
  const trackedMax = Math.max(50, Math.min(1000, Number(process.env.DEX_VERIFY_TRACK_MAX || 250)));
  const requestGapMs = Math.max(205, Number(process.env.DEX_VERIFY_REQUEST_GAP_MS || 225));

  const metrics = {
    version: VERSION,
    strategy: 'pump-origin+dex-verification',
    active: true,
    connected: true,
    startedAt: Date.now(),
    submitted: 0,
    seeded: 0,
    duplicateSubmits: 0,
    queueDropped: 0,
    pendingExpired: 0,
    dexChecks: 0,
    confirmBatches: 0,
    confirmAddresses: 0,
    noPairChecks: 0,
    dexRateLimited: 0,
    dexCheckErrors: 0,
    pairsConfirmed: 0,
    pairsRejected: 0,
    discovered: 0,
    marketUpdates: 0,
    marketMisses: 0,
    pendingConfirms: 0,
    tracked: 0,
    lastMint: null,
    lastPair: null,
    lastVerifiedAt: null,
    lastRequestAt: null,
    lastSuccessAt: null,
    lastError: null
  };

  const pending = new Map();
  const tracked = new Map();
  let stopped = false;
  let busy = false;
  let lastRequestAt = 0;
  let laneCounter = 0;

  async function fetchRows(mints) {
    const wait = Math.max(0, requestGapMs - (Date.now() - lastRequestAt));
    if (wait) await sleep(wait);
    lastRequestAt = Date.now();
    metrics.lastRequestAt = lastRequestAt;
    metrics.dexChecks++;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const url = 'https://api.dexscreener.com/tokens/v1/solana/' + mints.map(encodeURIComponent).join(',');
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: 'application/json', 'user-agent': 'MEMEFLOW/Pump-Dex-Gate-V1' }
      });
      if (response.status === 429) {
        metrics.dexRateLimited++;
        throw new Error('DEX Screener rate limited');
      }
      if (!response.ok) throw new Error('DEX Screener HTTP ' + response.status);
      const rows = await response.json();
      metrics.lastSuccessAt = Date.now();
      metrics.lastError = null;
      return Array.isArray(rows) ? rows : [];
    } finally {
      clearTimeout(timeout);
    }
  }

  function prunePendingIfNeeded() {
    while (pending.size >= pendingMax) {
      const oldest = [...pending.values()].sort((a, b) => Number(a.firstSeenAt || 0) - Number(b.firstSeenAt || 0))[0];
      if (!oldest) break;
      pending.delete(oldest.mint);
      metrics.queueDropped++;
      metrics.pairsRejected++;
    }
  }

  function pruneTrackedIfNeeded() {
    while (tracked.size > trackedMax) {
      const oldest = [...tracked.values()].sort((a, b) => Number(a.lastMarketAt || a.verifiedAt || 0) - Number(b.lastMarketAt || b.verifiedAt || 0))[0];
      if (!oldest) break;
      tracked.delete(oldest.mint);
    }
  }

  function submit(candidate, { seeded = false } = {}) {
    const mint = String(candidate?.mint || candidate?.tokenMint || candidate?.tokenAddress || '').trim();
    if (!mint || stopped) return false;
    if (tracked.has(mint)) {
      metrics.duplicateSubmits++;
      return false;
    }
    const existing = pending.get(mint);
    if (existing) {
      existing.candidate = { ...existing.candidate, ...candidate, mint };
      metrics.duplicateSubmits++;
      return false;
    }
    prunePendingIfNeeded();
    const now = Date.now();
    pending.set(mint, {
      mint,
      candidate: { ...candidate, mint },
      firstSeenAt: Number(candidate?.discoveredAt) || now,
      addedAt: now,
      nextAt: now + 300,
      attempts: 0
    });
    metrics.submitted++;
    if (seeded) metrics.seeded++;
    metrics.pendingConfirms = pending.size;
    return true;
  }

  function trackVerified(token) {
    const mint = String(token?.mint || token?.tokenMint || token?.tokenAddress || '').trim();
    if (!mint || token?.dexConfirmed !== true) return false;
    pending.delete(mint);
    tracked.set(mint, {
      mint,
      verifiedAt: Number(token?.dexConfirmedAt) || Number(token?.dexListedAt) || Date.now(),
      lastMarketAt: Number(token?.dexMarketUpdatedAt) || Number(token?.lastPriceAt) || 0,
      nextAt: Date.now() + 1000
    });
    pruneTrackedIfNeeded();
    metrics.pendingConfirms = pending.size;
    metrics.tracked = tracked.size;
    return true;
  }

  function clearPending() {
    pending.clear();
    metrics.pendingConfirms = 0;
  }

  async function processPending(rows) {
    const now = Date.now();
    for (const item of rows) {
      if (!pending.has(item.mint)) continue;
      if (now - Number(item.firstSeenAt || item.addedAt || now) > ttlMs) {
        pending.delete(item.mint);
        metrics.pendingExpired++;
        metrics.pairsRejected++;
      }
    }
    const live = rows.filter(item => pending.has(item.mint));
    if (!live.length) {
      metrics.pendingConfirms = pending.size;
      return;
    }

    metrics.confirmBatches++;
    metrics.confirmAddresses += live.length;
    let apiRows;
    try {
      apiRows = await fetchRows(live.map(item => item.mint));
    } catch (error) {
      metrics.dexCheckErrors++;
      metrics.lastError = String(error?.message || error);
      for (const item of live) {
        item.attempts++;
        item.nextAt = Date.now() + retryDelay(item.attempts);
      }
      return;
    }

    for (const item of live) {
      const pair = choosePair(apiRows, item.mint);
      if (!pair) {
        metrics.noPairChecks++;
        item.attempts++;
        item.nextAt = Date.now() + retryDelay(item.attempts);
        continue;
      }

      pending.delete(item.mint);
      const patch = marketPatch(pair, item.mint);
      const verifiedAt = Date.now();
      tracked.set(item.mint, {
        mint: item.mint,
        verifiedAt,
        lastMarketAt: verifiedAt,
        nextAt: verifiedAt + marketDelay(verifiedAt)
      });
      pruneTrackedIfNeeded();
      metrics.pairsConfirmed++;
      metrics.discovered++;
      metrics.lastMint = item.mint;
      metrics.lastPair = pair?.pairAddress || null;
      metrics.lastVerifiedAt = verifiedAt;

      try {
        await Promise.resolve(onVerified?.({ mint: item.mint, candidate: item.candidate, market: patch, pair }));
      } catch (error) {
        metrics.lastError = 'onVerified: ' + String(error?.message || error);
      }
    }

    metrics.pendingConfirms = pending.size;
    metrics.tracked = tracked.size;
  }

  async function processTracked(rows) {
    metrics.confirmBatches++;
    metrics.confirmAddresses += rows.length;
    let apiRows;
    try {
      apiRows = await fetchRows(rows.map(item => item.mint));
    } catch (error) {
      metrics.dexCheckErrors++;
      metrics.lastError = String(error?.message || error);
      for (const item of rows) item.nextAt = Date.now() + 5000;
      return;
    }

    for (const item of rows) {
      if (!tracked.has(item.mint)) continue;
      const pair = choosePair(apiRows, item.mint);
      if (!pair) {
        metrics.marketMisses++;
        item.nextAt = Date.now() + 5000;
        continue;
      }
      const patch = marketPatch(pair, item.mint);
      item.lastMarketAt = Date.now();
      item.nextAt = Date.now() + marketDelay(item.verifiedAt);
      metrics.marketUpdates++;
      try {
        await Promise.resolve(onMarket?.(item.mint, patch, pair));
      } catch (error) {
        metrics.lastError = 'onMarket: ' + String(error?.message || error);
      }
    }
    metrics.tracked = tracked.size;
  }

  async function tick() {
    if (stopped || busy) return;
    const now = Date.now();
    const expired = [...pending.values()].filter(item => now - Number(item.firstSeenAt || item.addedAt || now) > ttlMs);
    for (const item of expired) {
      pending.delete(item.mint);
      metrics.pendingExpired++;
      metrics.pairsRejected++;
    }

    const duePending = [...pending.values()].filter(item => item.nextAt <= now).sort((a, b) => a.nextAt - b.nextAt).slice(0, 30);
    const dueTracked = [...tracked.values()].filter(item => item.nextAt <= now).sort((a, b) => a.nextAt - b.nextAt).slice(0, 30);
    metrics.pendingConfirms = pending.size;
    metrics.tracked = tracked.size;
    if (!duePending.length && !dueTracked.length) return;

    // Do not let a permanently busy candidate queue starve market updates
    // for already-verified tokens/open paper positions.
    laneCounter++;
    const runTracked =
      dueTracked.length > 0 &&
      (duePending.length === 0 || laneCounter % 5 === 0);

    busy = true;
    try {
      if (runTracked) await processTracked(dueTracked);
      else await processPending(duePending);
    } finally {
      busy = false;
    }
  }

  const timer = setInterval(() => void tick(), 250);
  timer.unref?.();

  return {
    submit,
    trackVerified,
    clearPending,
    metrics: () => ({ ...metrics, active: !stopped, connected: !stopped, pendingConfirms: pending.size, tracked: tracked.size }),
    stop: () => {
      stopped = true;
      clearInterval(timer);
      pending.clear();
      tracked.clear();
      metrics.active = false;
      metrics.connected = false;
      metrics.pendingConfirms = 0;
      metrics.tracked = 0;
    }
  };
}
