// MEMEFLOW_OPEN_POSITION_MARK_PARITY_V81
// MEMEFLOW_OPEN_POSITION_LIVE_VALUE_V83
//
// Shared conservative mark resolver for:
//   1) Open Positions live valuation/P&L
//   2) manual PAPER close settlement
//
// V83 continuity rule:
// A confirmed post-entry Pump trade price remains the latest known market
// price until a newer confirmed trade supersedes it. Quiet markets therefore
// do not lose live valuation merely because 120 seconds elapsed.
//
// Non-trade telemetry and engine lifecycle marks still require freshness.

const finitePositive = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const finiteTime = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function newest(values = []) {
  const rows = values
    .map(finiteTime)
    .filter(value => value !== null);
  return rows.length ? Math.max(...rows) : null;
}

export function tokenPriceMarkTimeV81(token = {}) {
  const specific = newest([
    token.lastPriceAt,
    token.lastMarketActivityAt,
    token.lastTradeAt,
    token.marketCapUpdatedAt
  ]);

  if (specific !== null) return specific;

  return newest([
    token.marketScannedAt,
    token.updatedAt,
    token.lastScannedAt
  ]);
}

function timestampIsPostEntry(atMs, openedAtMs, nowMs) {
  if (atMs === null) return false;
  if (openedAtMs !== null && atMs < openedAtMs) return false;
  if (atMs > nowMs + 30_000) return false;
  return true;
}

function usableFreshTimestamp(atMs, openedAtMs, nowMs, maxAgeMs) {
  if (!timestampIsPostEntry(atMs, openedAtMs, nowMs)) return false;
  return nowMs - atMs <= maxAgeMs;
}

function tokenTradeEvidence(token = {}) {
  const marketSource =
    String(token?.marketSource || '').toLowerCase();
  const liveMarketCapSource =
    String(token?.liveMarketCapSource || '').toLowerCase();

  return Boolean(
    marketSource.includes('trade') ||
    liveMarketCapSource.includes('trade') ||
    (
      token?.eventSignature &&
      !marketSource.includes('create')
    ) ||
    token?.copyTradingDiscovered === true
  );
}

export function resolvePaperPositionMarkV81({
  position,
  token,
  tradeMarkPriceSol = null,
  tradeMarkAt = null,
  tradeMarkSource = null,
  nowMs = Date.now(),
  maxAgeMs = 120_000
} = {}) {
  const safeMaxAgeMs = Math.max(
    5_000,
    Number(maxAgeMs) || 120_000
  );

  const openedAtMs = finiteTime(position?.openedAtMs);
  const entryPriceSol = finitePositive(position?.entryPriceSol);

  const tradePriceSol = finitePositive(tradeMarkPriceSol);
  const tradeAtMs = finiteTime(tradeMarkAt);
  const tradeSource = String(tradeMarkSource || '').trim();

  if (
    tradePriceSol !== null &&
    tradeSource.toLowerCase().includes('trade') &&
    timestampIsPostEntry(
      tradeAtMs,
      openedAtMs,
      nowMs
    )
  ) {
    return {
      ok: true,
      priceSol: tradePriceSol,
      atMs: tradeAtMs,
      source: tradeSource || 'pump-trade-event',
      ageMs: Math.max(0, nowMs - tradeAtMs),
      continuity: 'last-confirmed-trade',
      version: 'MEMEFLOW_OPEN_POSITION_LIVE_VALUE_V83'
    };
  }

  const tokenPriceSol = finitePositive(
    token?.priceSol ?? token?.price
  );
  const tokenAtMs = tokenPriceMarkTimeV81(token || {});
  const hasTradeEvidence = tokenTradeEvidence(token || {});

  if (
    tokenPriceSol !== null &&
    hasTradeEvidence &&
    timestampIsPostEntry(
      tokenAtMs,
      openedAtMs,
      nowMs
    )
  ) {
    return {
      ok: true,
      priceSol: tokenPriceSol,
      atMs: tokenAtMs,
      source: 'token-live-trade',
      ageMs: Math.max(0, nowMs - tokenAtMs),
      continuity: 'last-confirmed-trade',
      version: 'MEMEFLOW_OPEN_POSITION_LIVE_VALUE_V83'
    };
  }

  if (
    tokenPriceSol !== null &&
    usableFreshTimestamp(
      tokenAtMs,
      openedAtMs,
      nowMs,
      safeMaxAgeMs
    )
  ) {
    return {
      ok: true,
      priceSol: tokenPriceSol,
      atMs: tokenAtMs,
      source: 'token-market',
      ageMs: Math.max(0, nowMs - tokenAtMs),
      continuity: 'fresh-telemetry',
      version: 'MEMEFLOW_OPEN_POSITION_LIVE_VALUE_V83'
    };
  }

  const enginePriceSol = finitePositive(
    position?.currentPriceSol
  );
  const engineAtMs = finiteTime(
    position?.lifecycleDecision?.atMs
  );

  if (
    enginePriceSol !== null &&
    usableFreshTimestamp(
      engineAtMs,
      openedAtMs,
      nowMs,
      safeMaxAgeMs
    )
  ) {
    return {
      ok: true,
      priceSol: enginePriceSol,
      atMs: engineAtMs,
      source: 'paper-engine-mark',
      ageMs: Math.max(0, nowMs - engineAtMs),
      continuity: 'fresh-engine-mark',
      version: 'MEMEFLOW_OPEN_POSITION_LIVE_VALUE_V83'
    };
  }

  return {
    ok: false,
    code: 'LIVE_MARK_UNAVAILABLE',
    message:
      'No trustworthy post-entry market mark is currently available.',
    entryPriceSol,
    tradePriceSol,
    tradeAtMs,
    tokenPriceSol,
    tokenAtMs,
    tokenTradeEvidence: hasTradeEvidence,
    enginePriceSol,
    engineAtMs,
    maxAgeMs: safeMaxAgeMs,
    version: 'MEMEFLOW_OPEN_POSITION_LIVE_VALUE_V83'
  };
}
