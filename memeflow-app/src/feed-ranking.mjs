// MEMEFLOW_FEED_RELEVANCE_RANKING_V2
//
// Feed order policy:
// 1) OPEN POSITION stays first, BUY READY stays next, BLOCKED stays last.
// 2) WATCH and WAITING are one live-candidate pool and are ordered by CURRENT
//    market quality, not by the label alone.
// 3) The card score for WATCH/WAITING is a live feed score. The original
//    decision score is preserved as decisionScore and trading eligibility is
//    not changed here.

const STATE_PRIORITY = Object.freeze({
  'OPEN POSITION': 500,
  'OPEN_POSITION': 500,
  'OPEN': 500,
  'POSITION': 500,
  'BUY READY': 400,
  'BUY_READY': 400,
  'WATCH': 300,
  'WAITING': 300,
  'BLOCKED': 100,
  'REJECTED': 50,
  'EXPIRED': 25
});

const number = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const clamp100 = value => Math.max(0, Math.min(100, Number(value) || 0));

function logSaturation(value, cap) {
  const n = number(value);
  if (n === null || n <= 0) return 0;
  const safeCap = Math.max(1, Number(cap) || 1);
  return clamp01(Math.log1p(n) / Math.log1p(safeCap));
}

function normalizedState(state) {
  return String(state || 'WAITING').trim().toUpperCase();
}

function statePriority(state) {
  return STATE_PRIORITY[normalizedState(state)] ?? 0;
}

function isLiveCandidateState(state) {
  const key = normalizedState(state);
  return key === 'WATCH' || key === 'WAITING';
}

function priceMomentumQuality(value) {
  const p = number(value);
  if (p === null) return 0;
  if (p <= -15) return 0;
  if (p < 0) return clamp01((p + 15) / 15) * 0.12;
  if (p < 5) return 0.20 + (p / 5) * 0.25;
  if (p < 40) return 0.45 + ((p - 5) / 35) * 0.35;
  if (p <= 120) return 0.80 + ((p - 40) / 80) * 0.20;
  if (p <= 180) return 1.00 - ((p - 120) / 60) * 0.12;
  if (p <= 300) return 0.88 - ((p - 180) / 120) * 0.33;
  return 0.50;
}

function ageQuality(ageMinutes) {
  const age = number(ageMinutes);
  if (age === null || age < 0) return 0.3;
  if (age <= 0.15) return 0.65;
  if (age <= 5) return 1;
  if (age <= 15) return 0.85;
  if (age <= 30) return 0.65;
  if (age <= 60) return 0.40;
  return 0.20;
}

function activityFreshness(quoteAgeMs) {
  const ms = number(quoteAgeMs);
  if (ms === null || ms < 0) return 0.25;
  if (ms <= 3_000) return 1;
  if (ms <= 10_000) return 0.85;
  if (ms <= 20_000) return 0.60;
  if (ms <= 30_000) return 0.40;
  return 0.15;
}

function volumeQuality(view) {
  const usd = number(view?.volume5mUsd);
  if (usd !== null) return logSaturation(usd, 10_000);
  const sol = number(view?.volume5mSol);
  if (sol !== null) return logSaturation(sol, 20);
  return 0;
}

function transactionQuality(view) {
  const tx = number(view?.transactions5m);
  return tx === null ? 0 : logSaturation(tx, 20);
}

function marketCapQuality(view) {
  const usd = number(view?.marketCapUsd);
  if (usd !== null) return logSaturation(usd, 50_000);
  const sol = number(view?.marketCapSol ?? view?.marketCap);
  if (sol !== null) return logSaturation(sol, 150);
  return 0;
}

function hasLiveActivity(view) {
  const tx = number(view?.transactions5m) ?? 0;
  const usd = number(view?.volume5mUsd) ?? 0;
  const sol = number(view?.volume5mSol) ?? 0;
  return tx > 0 || usd > 0 || sol > 0;
}

export function candidateRelevanceScore(view = {}) {
  const score = clamp01((number(view.score) ?? 0) / 100);
  const opportunity = clamp01((number(view.opportunityScore) ?? 0) / 100);
  const quality = clamp01((number(view.qualityScore) ?? 0) / 100);
  const holders = logSaturation(
    view.holderCount ??
    view.holders ??
    view.observedHolderCount,
    120
  );
  const holdersWeight = view.holderCountIsLowerBound === true ? 3 : 8;
  const volume = volumeQuality(view);
  const tx = transactionQuality(view);
  const momentum = priceMomentumQuality(view.priceChange5mPct);
  const marketCap = marketCapQuality(view);
  const age = ageQuality(view.ageMinutes);
  const activity = activityFreshness(view.quoteAgeMs);
  const liveActivity = hasLiveActivity(view);

  // Current tape activity deliberately carries more weight than an old
  // decision score. This prevents a stale WATCH 74 with zero trades/volume
  // from sitting above a genuinely moving WAITING candidate.
  let relevance =
    score * 16 +
    opportunity * 10 +
    quality * 6 +
    holders * holdersWeight +
    volume * 14 +
    tx * 14 +
    momentum * 13 +
    marketCap * 10 +
    age * 2 +
    activity * 3;

  if (liveActivity) relevance += 15;
  else relevance -= 30;

  const priceChange = number(view.priceChange5mPct);
  const marketCapUsd = number(view.marketCapUsd);
  const marketCapSol = number(view.marketCapSol ?? view.marketCap);
  const txCount = number(view.transactions5m) ?? 0;

  if (priceChange === null) relevance -= 4;
  else if (priceChange <= -25) relevance -= 24;
  else if (priceChange <= -15) relevance -= 18;
  else if (priceChange <= -8) relevance -= 10;

  if (marketCapUsd === null && marketCapSol === null) relevance -= 3;

  if (txCount >= 4 && priceChange !== null && priceChange > 0) relevance += 5;
  if (txCount >= 8 && priceChange !== null && priceChange > 0) relevance += 3;

  const quoteAge = number(view.quoteAgeMs);
  if (quoteAge !== null && quoteAge > 30_000) relevance -= 8;
  if (quoteAge !== null && quoteAge > 60_000) relevance -= 8;

  const drawdown = Math.max(0, number(view.drawdownFromPeakPct) ?? 0);
  const whale = Math.max(0, number(view.whaleDominancePct) ?? 0);

  relevance -= Math.min(12, Math.max(0, drawdown - 12) * 0.14);
  relevance -= Math.min(7, Math.max(0, whale - 35) * 0.09);

  if (view.opportunityTrendHealthy === false) relevance -= 4;
  if (view.dead === true) relevance = 0;

  return Math.round(clamp100(relevance) * 100) / 100;
}

export function compareCandidateViews(a = {}, b = {}) {
  const stateDelta = statePriority(b.state) - statePriority(a.state);
  if (stateDelta) return stateDelta;

  const ar = number(a.relevanceScore) ?? candidateRelevanceScore(a);
  const br = number(b.relevanceScore) ?? candidateRelevanceScore(b);
  if (br !== ar) return br - ar;

  const ao = number(a.opportunityScore) ?? 0;
  const bo = number(b.opportunityScore) ?? 0;
  if (bo !== ao) return bo - ao;

  const at = number(a.transactions5m) ?? 0;
  const bt = number(b.transactions5m) ?? 0;
  if (bt !== at) return bt - at;

  const av = number(a.volume5mUsd) ?? number(a.volume5mSol) ?? 0;
  const bv = number(b.volume5mUsd) ?? number(b.volume5mSol) ?? 0;
  if (bv !== av) return bv - av;

  const amc = number(a.marketCapUsd) ?? number(a.marketCapSol ?? a.marketCap) ?? 0;
  const bmc = number(b.marketCapUsd) ?? number(b.marketCapSol ?? b.marketCap) ?? 0;
  if (bmc !== amc) return bmc - amc;

  const ah = number(
    a.holderCount ??
    a.holders ??
    a.observedHolderCount
  ) ?? 0;
  const bh = number(
    b.holderCount ??
    b.holders ??
    b.observedHolderCount
  ) ?? 0;
  if (bh !== ah) return bh - ah;

  const aq = number(a.quoteAgeMs) ?? Number.MAX_SAFE_INTEGER;
  const bq = number(b.quoteAgeMs) ?? Number.MAX_SAFE_INTEGER;
  if (aq !== bq) return aq - bq;

  return String(a.mint || a.id || '').localeCompare(String(b.mint || b.id || ''));
}

export function rankCandidateViews(views = []) {
  return (Array.isArray(views) ? views : [])
    .filter(Boolean)
    .map(view => {
      const decisionScore = number(view.score) ?? 0;
      const relevanceScore = candidateRelevanceScore(view);
      const liveCandidate = isLiveCandidateState(view.state);
      return {
        ...view,
        decisionScore,
        score: liveCandidate ? Math.round(relevanceScore) : decisionScore,
        feedScore: relevanceScore,
        relevanceScore,
        statePriority: statePriority(view.state)
      };
    })
    .sort(compareCandidateViews);
}

export { statePriority as candidateStatePriority };
