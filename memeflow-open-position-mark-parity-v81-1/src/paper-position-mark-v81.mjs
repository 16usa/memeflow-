// MEMEFLOW_OPEN_POSITION_MARK_PARITY_V81
//
// One conservative mark resolver for:
//   1) Open Positions live P&L
//   2) manual PAPER close settlement
//
// A UI value and a close decision must not disagree about whether a current
// market mark exists.

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
  // Price/activity-specific clocks are authoritative for freshness.
  // Generic scanner/update clocks are fallback-only and are never allowed to
  // make an already-known stale price-specific timestamp look fresh.
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

function usableTimestamp(atMs, openedAtMs, nowMs, maxAgeMs) {
  if (atMs === null) return false;
  if (openedAtMs !== null && atMs < openedAtMs) return false;
  if (atMs > nowMs + 30_000) return false;
  return nowMs - atMs <= maxAgeMs;
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
    usableTimestamp(
      tradeAtMs,
      openedAtMs,
      nowMs,
      safeMaxAgeMs
    )
  ) {
    return {
      ok: true,
      priceSol: tradePriceSol,
      atMs: tradeAtMs,
      source: tradeSource || 'pump-trade-event',
      ageMs: Math.max(0, nowMs - tradeAtMs),
      version: 'MEMEFLOW_OPEN_POSITION_MARK_PARITY_V81'
    };
  }

  const tokenPriceSol = finitePositive(
    token?.priceSol ?? token?.price
  );
  const tokenAtMs = tokenPriceMarkTimeV81(token || {});

  if (
    tokenPriceSol !== null &&
    usableTimestamp(
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
      version: 'MEMEFLOW_OPEN_POSITION_MARK_PARITY_V81'
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
    usableTimestamp(
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
      version: 'MEMEFLOW_OPEN_POSITION_MARK_PARITY_V81'
    };
  }

  return {
    ok: false,
    code: 'LIVE_MARK_UNAVAILABLE',
    message:
      'No fresh post-entry market mark is currently available.',
    entryPriceSol,
    tradePriceSol,
    tradeAtMs,
    tokenPriceSol,
    tokenAtMs,
    enginePriceSol,
    engineAtMs,
    maxAgeMs: safeMaxAgeMs,
    version: 'MEMEFLOW_OPEN_POSITION_MARK_PARITY_V81'
  };
}
