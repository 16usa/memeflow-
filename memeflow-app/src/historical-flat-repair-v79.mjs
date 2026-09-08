// MEMEFLOW_HISTORICAL_FLAT_REPAIR_V79
// Pure audit/planning helpers for conservative repair of pre-V78 false Flat outcomes.

export const REPAIR_VERSION = 'MEMEFLOW_HISTORICAL_FLAT_REPAIR_V79';

export function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function explicitNumericZero(value) {
  const n = finite(value);
  return n !== null && n === 0;
}

function timestampOf(trade) {
  const direct = finite(trade?.executedAtMs);
  if (direct !== null) return direct;
  const parsed = Date.parse(String(trade?.executedAt || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedReason(position) {
  return String(position?.closeReason || '').trim().toUpperCase();
}

export function isLegacyManualFlatCandidate(position) {
  if (String(position?.status || '').toUpperCase() !== 'CLOSED') return false;
  if (!explicitNumericZero(position?.realizedPnlSol)) return false;
  if (!normalizedReason(position).startsWith('MANUAL PAPER CLOSE')) return false;

  const settlement = String(position?.exitSettlementVersion || '').toUpperCase();
  if (settlement.includes('PAPER_CLOSE_SAFETY_V78')) return false;
  if (settlement.includes('HISTORICAL_FLAT_REPAIR_V79')) return false;

  const closedAtMs = finite(position?.closedAtMs);
  const openedAtMs = finite(position?.openedAtMs);
  const entryPriceSol = finite(position?.entryPriceSol);

  return Boolean(
    closedAtMs !== null &&
    closedAtMs > 0 &&
    openedAtMs !== null &&
    openedAtMs > 0 &&
    closedAtMs >= openedAtMs &&
    entryPriceSol !== null &&
    entryPriceSol > 0
  );
}

export function sellsForPosition(trades, position) {
  const id = String(position?.id || '');
  if (!id) return [];

  return (Array.isArray(trades) ? trades : Object.values(trades || {}))
    .filter(trade =>
      String(trade?.positionId || '') === id &&
      String(trade?.side || '').toUpperCase() === 'SELL'
    )
    .sort((a, b) => (timestampOf(a) || 0) - (timestampOf(b) || 0));
}

export function selectFinalSell(trades, position) {
  const sells = sellsForPosition(trades, position);
  if (!sells.length) return null;

  const closedAtMs = finite(position?.closedAtMs);
  if (closedAtMs === null) return sells[sells.length - 1];

  const eligible = sells.filter(trade => {
    const t = timestampOf(trade);
    return t !== null && t <= closedAtMs + 10_000;
  });

  return eligible.length ? eligible[eligible.length - 1] : null;
}

function unknownPlan(position, code, details = {}) {
  return {
    kind: 'UNKNOWN',
    code,
    positionId: String(position?.id || ''),
    mint: String(position?.mint || ''),
    symbol: String(position?.symbol || position?.name || ''),
    closedAtMs: finite(position?.closedAtMs),
    legacyRealizedPnlSol: finite(position?.realizedPnlSol),
    legacyRealizedPnlPct: finite(position?.realizedPnlPct),
    legacyExitPriceSol: finite(position?.exitPriceSol),
    ...details
  };
}

export function buildHistoricalFlatPlan({
  position,
  trades,
  archivePoint,
  maxGapMs = 120_000
} = {}) {
  if (!isLegacyManualFlatCandidate(position)) {
    return {
      kind: 'SKIP',
      code: 'NOT_LEGACY_MANUAL_FLAT',
      positionId: String(position?.id || ''),
      mint: String(position?.mint || '')
    };
  }

  const closedAtMs = finite(position.closedAtMs);
  const openedAtMs = finite(position.openedAtMs);
  const entryPriceSol = finite(position.entryPriceSol);
  const initialSizeSol = finite(position.initialSizeSol);
  const safeMaxGapMs = Math.max(1_000, Number(maxGapMs) || 120_000);

  if (initialSizeSol === null || initialSizeSol <= 0) {
    return unknownPlan(position, 'INVALID_INITIAL_SIZE');
  }

  const markAtMs = finite(archivePoint?.t ?? archivePoint?.tMs ?? archivePoint?.t_ms);
  const markPriceSol = finite(
    archivePoint?.priceSol ?? archivePoint?.price_sol ?? archivePoint?.price
  );

  if (markAtMs === null || markPriceSol === null || markPriceSol <= 0) {
    return unknownPlan(position, 'NO_RELIABLE_ARCHIVE_MARK');
  }

  const gapMs = closedAtMs - markAtMs;

  if (gapMs < 0) {
    return unknownPlan(position, 'ARCHIVE_MARK_AFTER_CLOSE', {
      markAtMs,
      markPriceSol,
      gapMs
    });
  }

  if (markAtMs < openedAtMs) {
    return unknownPlan(position, 'ARCHIVE_MARK_BEFORE_ENTRY', {
      markAtMs,
      markPriceSol,
      gapMs
    });
  }

  if (gapMs > safeMaxGapMs) {
    return unknownPlan(position, 'ARCHIVE_MARK_STALE', {
      markAtMs,
      markPriceSol,
      gapMs,
      maxGapMs: safeMaxGapMs
    });
  }

  const sells = sellsForPosition(trades, position);
  const finalSell = selectFinalSell(trades, position);

  if (!finalSell) {
    return unknownPlan(position, 'FINAL_SELL_NOT_FOUND', {
      markAtMs,
      markPriceSol,
      gapMs
    });
  }

  const finalQty = finite(finalSell.quantity);
  if (finalQty === null || finalQty <= 0) {
    return unknownPlan(position, 'FINAL_SELL_QUANTITY_INVALID', {
      finalTradeId: String(finalSell.id || ''),
      markAtMs,
      markPriceSol,
      gapMs
    });
  }

  let priorPnlSol = 0;
  for (const sell of sells) {
    if (sell === finalSell) continue;
    const pnl = finite(sell.realizedPnlSol);
    if (pnl === null) {
      return unknownPlan(position, 'PRIOR_SELL_PNL_UNKNOWN', {
        finalTradeId: String(finalSell.id || ''),
        markAtMs,
        markPriceSol,
        gapMs
      });
    }
    priorPnlSol += pnl;
  }

  const finalLegPnlSol = finalQty * (markPriceSol - entryPriceSol);
  let newRealizedPnlSol = priorPnlSol + finalLegPnlSol;

  // Normalize only machine-noise-sized zero. Real micro P&L remains win/loss.
  if (Math.abs(newRealizedPnlSol) <= 1e-15) {
    newRealizedPnlSol = 0;
  }

  const newRealizedPnlPct =
    initialSizeSol > 0
      ? (newRealizedPnlSol / initialSizeSol) * 100
      : null;

  const outcome =
    newRealizedPnlSol > 0
      ? 'WIN'
      : newRealizedPnlSol < 0
        ? 'LOSS'
        : 'FLAT';

  return {
    kind: 'RECOVERABLE',
    code: 'ARCHIVE_MARK_RECOVERED',
    outcome,
    positionId: String(position.id || ''),
    mint: String(position.mint || ''),
    symbol: String(position.symbol || position.name || ''),
    closedAtMs,
    openedAtMs,
    markAtMs,
    markPriceSol,
    gapMs,
    maxGapMs: safeMaxGapMs,
    finalTradeId: String(finalSell.id || ''),
    finalTradeQuantity: finalQty,
    priorPnlSol,
    finalLegPnlSol,
    newRealizedPnlSol,
    newRealizedPnlPct,
    legacyRealizedPnlSol: finite(position.realizedPnlSol),
    legacyRealizedPnlPct: finite(position.realizedPnlPct),
    legacyExitPriceSol: finite(position.exitPriceSol),
    legacyFinalTradePriceSol: finite(finalSell.priceSol),
    legacyFinalTradeValueSol: finite(finalSell.valueSol),
    legacyFinalTradePnlSol: finite(finalSell.realizedPnlSol)
  };
}

export function summarizePlans(plans = []) {
  const candidates = plans.filter(p => p.kind === 'RECOVERABLE' || p.kind === 'UNKNOWN');
  const recoverable = candidates.filter(p => p.kind === 'RECOVERABLE');
  const unknown = candidates.filter(p => p.kind === 'UNKNOWN');

  const reasonCounts = {};
  for (const plan of unknown) {
    reasonCounts[plan.code] = (reasonCounts[plan.code] || 0) + 1;
  }

  return {
    candidates: candidates.length,
    recoverable: recoverable.length,
    wouldBecomeWins: recoverable.filter(p => p.outcome === 'WIN').length,
    wouldBecomeLosses: recoverable.filter(p => p.outcome === 'LOSS').length,
    verifiedTrueFlat: recoverable.filter(p => p.outcome === 'FLAT').length,
    wouldBecomeUnknown: unknown.length,
    unknownReasons: reasonCounts
  };
}
