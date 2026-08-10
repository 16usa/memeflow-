const clampScore = value =>
  Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const finite = value => Number.isFinite(Number(value));

function independentAiScore(token = {}) {
  let score = 0;
  const quality = [];

  if (finite(token.holderCount)) {
    const holders = Number(token.holderCount);

    let pts = 0;
    if (holders >= 100) pts = 20;
    else if (holders >= 60) pts = 17;
    else if (holders >= 30) pts = 13;
    else if (holders >= 15) pts = 7;
    else if (holders > 0) pts = 3;

    score += pts;
    quality.push({
      key: 'holders',
      value: holders,
      points: pts,
      maxPoints: 20
    });
  }

  if (finite(token.top10Pct)) {
    const top10 = Number(token.top10Pct);

    let pts = 0;
    if (top10 <= 15) pts = 20;
    else if (top10 <= 25) pts = 17;
    else if (top10 <= 35) pts = 12;
    else if (top10 <= 50) pts = 6;

    score += pts;
    quality.push({
      key: 'top10',
      value: top10,
      points: pts,
      maxPoints: 20
    });
  }

  if (finite(token.developerPct)) {
    const developer = Number(token.developerPct);

    let pts = 0;
    if (developer <= 5) pts = 20;
    else if (developer <= 10) pts = 18;
    else if (developer <= 20) pts = 14;
    else if (developer <= 30) pts = 7;

    score += pts;
    quality.push({
      key: 'developer',
      value: developer,
      points: pts,
      maxPoints: 20
    });
  }

  if (finite(token.buyPressure)) {
    const pressure = Number(token.buyPressure);

    let pts = 0;
    if (pressure >= 3) pts = 20;
    else if (pressure >= 2) pts = 17;
    else if (pressure >= 1.5) pts = 13;
    else if (pressure >= 1.2) pts = 9;
    else if (pressure >= 1) pts = 4;

    score += pts;
    quality.push({
      key: 'buyPressure',
      value: pressure,
      points: pts,
      maxPoints: 20
    });
  }

  const hasPrice =
    finite(token.priceSol) &&
    Number(token.priceSol) > 0;

  if (hasPrice) score += 10;

  quality.push({
    key: 'verifiedPrice',
    value: hasPrice,
    points: hasPrice ? 10 : 0,
    maxPoints: 10
  });

  const freshHolders = token.holderFresh === true;

  if (freshHolders) score += 10;

  quality.push({
    key: 'freshHolders',
    value: freshHolders,
    points: freshHolders ? 10 : 0,
    maxPoints: 10
  });

  return {
    score: clampScore(score),
    quality
  };
}

export function evaluate(token, s = {}) {
  const reasons = [];
  const gates = [];

  let waiting = false;
  let blocked = false;

  const addGate = (name, result, reason) => {
    const status =
      result === null || result === undefined
        ? 'WAITING'
        : result
          ? 'PASS'
          : 'FAIL';

    gates.push({
      name,
      status,
      pass: status === 'PASS'
    });

    if (status === 'WAITING') {
      waiting = true;
      reasons.push('Waiting: ' + reason);
    } else if (status === 'FAIL') {
      blocked = true;
      reasons.push(reason);
    }
  };

  // --------------------------------------------------
  // INDEPENDENT AI SCORE
  // DOES NOT USE USER SETTINGS
  // --------------------------------------------------

  const ai = independentAiScore(token);
  const score = ai.score;

  const confidence = clampScore(
    (finite(token.dataQuality)
      ? Number(token.dataQuality)
      : 0) * 100
  );

  // --------------------------------------------------
  // USER SETTINGS FILTERS
  // THESE DO NOT CHANGE AI SCORE
  // --------------------------------------------------

  if (finite(s.minHolders) && Number(s.minHolders) > 0) {
    addGate(
      'Minimum holders',
      token.holderCount == null
        ? null
        : Number(token.holderCount) >= Number(s.minHolders),
      `holders below ${s.minHolders}`
    );
  }

  if (finite(s.maxTop10Pct) && Number(s.maxTop10Pct) > 0) {
    addGate(
      'Top-10 concentration',
      token.top10Pct == null
        ? null
        : Number(token.top10Pct) <= Number(s.maxTop10Pct),
      `Top 10 above ${s.maxTop10Pct}%`
    );
  }

  if (
    finite(s.maxDeveloperPct) &&
    Number(s.maxDeveloperPct) > 0
  ) {
    addGate(
      'Developer concentration',
      token.developerPct == null
        ? null
        : Number(token.developerPct) <= Number(s.maxDeveloperPct),
      `developer above ${s.maxDeveloperPct}%`
    );
  }

  if (
    finite(s.minBuyPressure) &&
    Number(s.minBuyPressure) > 0
  ) {
    addGate(
      'Buy pressure',
      token.buyPressure == null
        ? null
        : Number(token.buyPressure) >= Number(s.minBuyPressure),
      `buy pressure below ${s.minBuyPressure}×`
    );
  }

  if (
    finite(s.minLiquidityUsd) &&
    Number(s.minLiquidityUsd) > 0
  ) {
    addGate(
      'Minimum liquidity',
      token.liquidityUsd == null
        ? null
        : Number(token.liquidityUsd) >= Number(s.minLiquidityUsd),
      `liquidity below $${s.minLiquidityUsd}`
    );
  }

  addGate(
    'Verified price',
    token.priceSol == null
      ? null
      : finite(token.priceSol) &&
        Number(token.priceSol) > 0,
    'price unavailable'
  );

  if (s.requireFreshHolderSnapshot === true) {
    addGate(
      'Fresh holder snapshot',
      token.holderFresh == null
        ? null
        : token.holderFresh === true,
      'holder snapshot unavailable'
    );
  }

  // --------------------------------------------------
  // USER-CONTROLLED AI SCORE THRESHOLD
  // NO HARDCODED 72
  // --------------------------------------------------

  const minimumAiScore =
    finite(s.minScore)
      ? Number(s.minScore)
      : null;

  const minimumConfidence =
    finite(s.minConfidence)
      ? Number(s.minConfidence)
      : null;

  const aiScorePass =
    minimumAiScore === null
      ? true
      : score >= minimumAiScore;

  const confidencePass =
    minimumConfidence === null
      ? true
      : confidence >= minimumConfidence;

  gates.push({
    name: 'Minimum AI score',
    status: aiScorePass ? 'PASS' : 'FAIL',
    pass: aiScorePass,
    value: score,
    threshold: minimumAiScore
  });

  gates.push({
    name: 'Minimum confidence',
    status: confidencePass ? 'PASS' : 'FAIL',
    pass: confidencePass,
    value: confidence,
    threshold: minimumConfidence
  });

  if (minimumAiScore !== null && !aiScorePass) {
    reasons.push(
      `AI score ${score} below configured minimum ${minimumAiScore}`
    );
  }

  if (
    minimumConfidence !== null &&
    !confidencePass
  ) {
    reasons.push(
      `confidence ${confidence}% below configured minimum ${minimumConfidence}%`
    );
  }

  let state;

  if (waiting) {
    state = 'WAITING';
  } else if (blocked) {
    state = 'BLOCKED';
  } else if (aiScorePass && confidencePass) {
    state = 'BUY READY';
  } else {
    state = 'WATCH';
  }

  return {
    state,
    score,
    confidence,
    reasons,

    primaryReason:
      reasons[0] ||
      'Independent AI quality and all configured user gates passed',

    aiQuality: {
      model: 'MEMEFLOW_INDEPENDENT_AI_V1',
      score,
      components: ai.quality
    },

    settingsEvaluation: {
      minScore: minimumAiScore,
      minConfidence: minimumConfidence,
      gates
    }
  };
}

export function tokenAgeMinutes(token = {}, now = Date.now()) {
  const createdAt =
    Number(token.createdAt) ||
    Number(token.discoveredAt) ||
    Number(token.created_at) ||
    Number(token.timestamp) ||
    null;

  if (!Number.isFinite(createdAt) || createdAt <= 0) {
    return null;
  }

  const createdMs =
    createdAt < 1e12
      ? createdAt * 1000
      : createdAt;

  return Math.max(0, (Number(now) - createdMs) / 60000);
}
