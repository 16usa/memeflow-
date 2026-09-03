const finite = value => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const firstFinite = (...values) => {
  for (const value of values) {
    const parsed = finite(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const roundSol = value => Math.round(Math.max(0, Number(value) || 0) * 1e9) / 1e9;
const round = (value, digits = 6) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

function riskAgainstMaximum(value, maximum, label, reasons) {
  const v = finite(value);
  const max = finite(maximum);
  if (v === null || max === null || !(max > 0)) return 1;

  const ratio = v / max;
  if (ratio >= 0.90) {
    reasons.push(`${label} is close to the configured maximum`);
    return 0.70;
  }
  if (ratio >= 0.75) {
    reasons.push(`${label} is elevated versus the configured maximum`);
    return 0.85;
  }
  return 1;
}

function riskAgainstMinimum(value, minimum, label, reasons, severe = 0.75, mild = 0.90) {
  const v = finite(value);
  const min = finite(minimum);
  if (v === null || min === null || !(min > 0)) return 1;

  const ratio = v / min;
  if (ratio < 1.15) {
    reasons.push(`${label} only narrowly clears the configured minimum`);
    return severe;
  }
  if (ratio < 1.35) {
    reasons.push(`${label} has limited margin above the configured minimum`);
    return mild;
  }
  return 1;
}

export function calculateAdaptivePositionSize({ token = {}, decision = {}, settings = {} } = {}) {
  const configured = finite(settings.positionSize);
  const hardMaximum = finite(settings.maxPositionSize);

  // positionSize is treated as the user's per-trade budget.
  // Adaptive sizing may reduce it, but never exceed it.
  const maxBudgetSol = roundSol(Math.max(0, Math.min(
    configured === null ? 0 : configured,
    hardMaximum === null ? (configured === null ? 0 : configured) : hardMaximum
  )));

  if (!(maxBudgetSol > 0)) {
    return {
      ok: false,
      mode: 'adaptive',
      code: 'POSITION_BUDGET_ZERO',
      amountSol: 0,
      maxBudgetSol,
      multiplier: 0,
      qualityScore: 0,
      qualityTier: 'unavailable',
      qualityMultiplier: 0,
      riskMultiplier: 0,
      reasons: ['Configured position budget is zero or invalid'],
      components: {}
    };
  }

  const score = clamp(finite(decision.score) ?? 0, 0, 100);
  const dataCompleteness = clamp(
    finite(decision.dataCompleteness) ??
    finite(decision.confidence) ??
    finite(decision.dataConfidence) ??
    0,
    0,
    100
  );

  // MEMEFLOW_ADAPTIVE_CANONICAL_SCORE_V21
  // Canonical Score selects the tier. Evidence can only reduce exposure.
  const quality = score / 100;

  let qualityMultiplier;
  let qualityTier;
  if (quality >= 0.90) {
    qualityMultiplier = 1.00;
    qualityTier = 'exceptional';
  } else if (quality >= 0.82) {
    qualityMultiplier = 0.75;
    qualityTier = 'strong';
  } else if (quality >= 0.74) {
    qualityMultiplier = 0.50;
    qualityTier = 'good';
  } else {
    qualityMultiplier = 0.25;
    qualityTier = 'qualified';
  }

  const top10Pct = firstFinite(token.top10Pct, token.top10, token.holder?.top10Pct);
  const developerPct = firstFinite(
    token.developerPct,
    token.developerSharePct,
    token.creatorPct,
    token.holder?.developerPct
  );
  const buyPressure = firstFinite(token.buyPressure, token.momentum, token.market?.buyPressure);
  const liquidityUsd = firstFinite(
    token.liquidityUsd,
    token.liquidityUSD,
    token.market?.liquidityUsd,
    token.liquidity?.usd
  );
  const holders = firstFinite(token.holderCount, token.holders, token.holder?.count);

  const reasons = [
    `${qualityTier} canonical Score (${Math.round(score)}/100)`
  ];

  const evidenceMultiplier=
    dataCompleteness>=90 ? 1 :
    dataCompleteness>=80 ? 0.90 :
    dataCompleteness>=70 ? 0.75 : 0.60;

  if(evidenceMultiplier<1){
    reasons.push(`Data completeness ${Math.round(dataCompleteness)}% reduces position size`);
  }

  let riskMultiplier = evidenceMultiplier;
  riskMultiplier *= riskAgainstMaximum(
    top10Pct,
    settings.maxTop10Pct,
    'Top-10 concentration',
    reasons
  );
  riskMultiplier *= riskAgainstMaximum(
    developerPct,
    settings.maxDeveloperPct,
    'Developer concentration',
    reasons
  );
  riskMultiplier *= riskAgainstMinimum(
    buyPressure,
    settings.minBuyPressure,
    'Buy pressure',
    reasons,
    0.75,
    0.90
  );
  riskMultiplier *= riskAgainstMinimum(
    liquidityUsd,
    settings.minLiquidityUsd,
    'Liquidity',
    reasons,
    0.80,
    0.90
  );
  riskMultiplier *= riskAgainstMinimum(
    holders,
    settings.minHolders,
    'Holder count',
    reasons,
    0.85,
    0.93
  );

  riskMultiplier = clamp(riskMultiplier, 0.15, 1);
  const multiplier = clamp(qualityMultiplier * riskMultiplier, 0.15, 1);
  const amountSol = roundSol(Math.min(maxBudgetSol, maxBudgetSol * multiplier));

  return {
    ok: amountSol > 0,
    mode: 'adaptive',
    code: amountSol > 0 ? null : 'ADAPTIVE_SIZE_ZERO',
    amountSol,
    maxBudgetSol,
    multiplier: round(multiplier),
    // Compatibility alias: exactly canonical Score.
    qualityScore: Math.round(score),
    canonicalScore: Math.round(score),
    qualityTier,
    qualityMultiplier: round(qualityMultiplier),
    riskMultiplier: round(riskMultiplier),
    reasons,
    components: {
      score,
      dataCompleteness,
      top10Pct,
      developerPct,
      buyPressure,
      liquidityUsd,
      holders
    }
  };
}
