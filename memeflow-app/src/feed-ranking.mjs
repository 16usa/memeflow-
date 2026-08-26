// MEMEFLOW_FEED_RELEVANCE_RANKING_V1
// Strict feed order:
// 1) state: BUY READY > WATCH > WAITING > BLOCKED
// 2) combined relevance from live/card metrics inside the same state.

const STATE_PRIORITY = Object.freeze({
  'BUY READY': 400,
  'WATCH': 300,
  'WAITING': 200,
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

function statePriority(state) {
  const key = String(state || 'WAITING').trim().toUpperCase();
  return STATE_PRIORITY[key] ?? 0;
}

// Reward real upward motion without letting a vertical +500% candle win
// purely because its raw percentage is huge.
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

function marketCapQuality(view) {
  const usd = number(view?.marketCapUsd);
  if (usd !== null) return logSaturation(usd, 50_000);
  const sol = number(view?.marketCapSol ?? view?.marketCap);
  if (sol !== null) return logSaturation(sol, 150);
  return 0;
}

export function candidateRelevanceScore(view = {}) {
  const score = clamp01((number(view.score) ?? 0) / 100);
  const opportunity = clamp01((number(view.opportunityScore) ?? 0) / 100);
  const quality = clamp01((number(view.qualityScore) ?? 0) / 100);
  const holders = logSaturation(view.holderCount ?? view.holders, 120);
  const volume = volumeQuality(view);
  const tx = clamp01((number(view.transactions5m) ?? 0) / 100);
  const momentum = priceMomentumQuality(view.priceChange5mPct);
  const marketCap = marketCapQuality(view);
  const age = ageQuality(view.ageMinutes);
  const activity = activityFreshness(view.quoteAgeMs);

  let relevance =
    score * 24 +
    opportunity * 14 +
    quality * 10 +
    holders * 11 +
    volume * 11 +
    tx * 9 +
    momentum * 9 +
    marketCap * 5 +
    age * 4 +
    activity * 3;

  const drawdown = Math.max(0, number(view.drawdownFromPeakPct) ?? 0);
  const whale = Math.max(0, number(view.whaleDominancePct) ?? 0);

  relevance -= Math.min(8, Math.max(0, drawdown - 12) * 0.10);
  relevance -= Math.min(6, Math.max(0, whale - 35) * 0.08);

  if (view.opportunityTrendHealthy === false) relevance -= 3;
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

  const as = number(a.score) ?? 0;
  const bs = number(b.score) ?? 0;
  if (bs !== as) return bs - as;

  const at = number(a.transactions5m) ?? 0;
  const bt = number(b.transactions5m) ?? 0;
  if (bt !== at) return bt - at;

  const av = number(a.volume5mUsd) ?? number(a.volume5mSol) ?? 0;
  const bv = number(b.volume5mUsd) ?? number(b.volume5mSol) ?? 0;
  if (bv !== av) return bv - av;

  const ah = number(a.holderCount ?? a.holders) ?? 0;
  const bh = number(b.holderCount ?? b.holders) ?? 0;
  if (bh !== ah) return bh - ah;

  const aq = number(a.quoteAgeMs) ?? Number.MAX_SAFE_INTEGER;
  const bq = number(b.quoteAgeMs) ?? Number.MAX_SAFE_INTEGER;
  if (aq !== bq) return aq - bq;

  return String(a.mint || a.id || '').localeCompare(String(b.mint || b.id || ''));
}

export function rankCandidateViews(views = []) {
  return (Array.isArray(views) ? views : [])
    .filter(Boolean)
    .map(view => ({
      ...view,
      relevanceScore: candidateRelevanceScore(view),
      statePriority: statePriority(view.state)
    }))
    .sort(compareCandidateViews);
}

export { statePriority as candidateStatePriority };
