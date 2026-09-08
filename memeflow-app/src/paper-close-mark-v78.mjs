// MEMEFLOW_PAPER_CLOSE_MARK_V78
// Pure exit-mark resolver used by the manual PAPER close safety patch.

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

function newestTokenMarkTime(token = {}) {
  const candidates = [
    token.lastPriceAt,
    token.marketScannedAt,
    token.updatedAt,
    token.lastScannedAt
  ]
    .map(finiteTime)
    .filter(value => value !== null);

  return candidates.length ? Math.max(...candidates) : null;
}

function usableTimestamp(atMs, openedAtMs, nowMs, maxAgeMs) {
  if (atMs === null) return false;
  if (openedAtMs !== null && atMs < openedAtMs) return false;
  if (atMs > nowMs + 30_000) return false;
  return nowMs - atMs <= maxAgeMs;
}

export function resolveManualPaperExitMarkV78({
  position,
  token,
  nowMs = Date.now(),
  maxAgeMs = 120_000
} = {}) {
  const safeMaxAgeMs = Math.max(5_000, Number(maxAgeMs) || 120_000);
  const openedAtMs = finiteTime(position?.openedAtMs);
  const entryPriceSol = finitePositive(position?.entryPriceSol);

  const tokenPriceSol = finitePositive(token?.priceSol);
  const tokenAtMs = newestTokenMarkTime(token || {});

  if (
    tokenPriceSol !== null &&
    usableTimestamp(tokenAtMs, openedAtMs, nowMs, safeMaxAgeMs)
  ) {
    return {
      ok: true,
      priceSol: tokenPriceSol,
      atMs: tokenAtMs,
      source: 'token-market',
      version: 'MEMEFLOW_PAPER_CLOSE_SAFETY_V78'
    };
  }

  const enginePriceSol = finitePositive(position?.currentPriceSol);
  const engineAtMs = finiteTime(position?.lifecycleDecision?.atMs);

  if (
    enginePriceSol !== null &&
    usableTimestamp(engineAtMs, openedAtMs, nowMs, safeMaxAgeMs)
  ) {
    return {
      ok: true,
      priceSol: enginePriceSol,
      atMs: engineAtMs,
      source: 'paper-engine-mark',
      version: 'MEMEFLOW_PAPER_CLOSE_SAFETY_V78'
    };
  }

  return {
    ok: false,
    code: 'EXIT_PRICE_UNAVAILABLE',
    message:
      'A fresh post-entry market price is required before a PAPER position can be closed. The position remains OPEN.',
    entryPriceSol,
    tokenPriceSol,
    tokenAtMs,
    enginePriceSol,
    engineAtMs,
    maxAgeMs: safeMaxAgeMs,
    version: 'MEMEFLOW_PAPER_CLOSE_SAFETY_V78'
  };
}
