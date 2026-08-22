import {evaluateSettingsGate,tokenAgeMinutes} from './settings-gate.mjs';

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
    quality.push({key: 'holders', value: holders, points: pts, maxPoints: 20});
  }

  if (finite(token.top10Pct)) {
    const top10 = Number(token.top10Pct);

    let pts = 0;
    if (top10 <= 15) pts = 20;
    else if (top10 <= 25) pts = 17;
    else if (top10 <= 35) pts = 12;
    else if (top10 <= 50) pts = 6;

    score += pts;
    quality.push({key: 'top10', value: top10, points: pts, maxPoints: 20});
  }

  if (finite(token.developerPct)) {
    const developer = Number(token.developerPct);

    let pts = 0;
    if (developer <= 5) pts = 20;
    else if (developer <= 10) pts = 18;
    else if (developer <= 20) pts = 14;
    else if (developer <= 30) pts = 7;

    score += pts;
    quality.push({key: 'developer', value: developer, points: pts, maxPoints: 20});
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
    quality.push({key: 'buyPressure', value: pressure, points: pts, maxPoints: 20});
  }

  const hasPrice = finite(token.priceSol) && Number(token.priceSol) > 0;
  if (hasPrice) score += 10;
  quality.push({key: 'verifiedPrice', value: hasPrice, points: hasPrice ? 10 : 0, maxPoints: 10});

  const freshHolders = token.holderFresh === true;
  if (freshHolders) score += 10;
  quality.push({key: 'freshHolders', value: freshHolders, points: freshHolders ? 10 : 0, maxPoints: 10});

  return {score: clampScore(score), quality};
}

export function evaluate(token, s = {}) {
  // AI quality remains independent from user policy.
  const ai = independentAiScore(token);
  const score = ai.score;
  const confidence = clampScore((finite(token.dataQuality) ? Number(token.dataQuality) : 0) * 100);

  // One canonical settings gate is shared by the evaluator and the pipeline.
  // A known FAIL always outranks WAITING so an already-ineligible token cannot
  // masquerade as merely incomplete while the system keeps doing expensive work.
  const policy = evaluateSettingsGate(token, s);
  const reasons = [...policy.reasons];

  // Verified price is an execution-quality prerequisite rather than a user
  // setting. Missing price is WAITING; an explicit non-positive value is FAIL.
  let priceWaiting = false;
  let priceBlocked = false;
  let priceStatus = 'PASS';
  if (token.priceSol == null) {
    priceWaiting = true;
    priceStatus = 'WAITING';
    reasons.push('price unavailable');
  } else if (!finite(token.priceSol) || Number(token.priceSol) <= 0) {
    priceBlocked = true;
    priceStatus = 'FAIL';
    reasons.push('price unavailable');
  }

  const minimumAiScore = finite(s.minScore) ? Number(s.minScore) : null;
  const minimumConfidence = finite(s.minConfidence) ? Number(s.minConfidence) : null;
  const aiScorePass = minimumAiScore === null ? true : score >= minimumAiScore;
  const confidencePass = minimumConfidence === null ? true : confidence >= minimumConfidence;

  if (minimumAiScore !== null && !aiScorePass) {
    reasons.push(`AI score ${score} below configured minimum ${minimumAiScore}`);
  }
  if (minimumConfidence !== null && !confidencePass) {
    reasons.push(`confidence ${confidence}% below configured minimum ${minimumConfidence}%`);
  }

  let state;
  // BLOCKED must win over WAITING whenever any configured gate has a known fail.
  if (policy.blocked || priceBlocked) {
    state = 'BLOCKED';
  } else if (policy.waiting || priceWaiting) {
    state = 'WAITING';
  } else if (aiScorePass && confidencePass) {
    state = 'BUY READY';
  } else {
    state = 'WATCH';
  }

  const gates = [
    ...policy.gates,
    {
      name: 'Verified price',
      key: 'verifiedPrice',
      status: priceStatus,
      pass: priceStatus === 'PASS',
      value: token.priceSol ?? null,
      threshold: '> 0',
      operator: '>',
      retryable: true,
      reason: 'price unavailable',
      source: 'priceSol'
    },
    {
      name: 'Minimum AI score',
      key: 'minScore',
      status: aiScorePass ? 'PASS' : 'FAIL',
      pass: aiScorePass,
      value: score,
      threshold: minimumAiScore,
      operator: '>=',
      retryable: true
    },
    {
      name: 'Minimum confidence',
      key: 'minConfidence',
      status: confidencePass ? 'PASS' : 'FAIL',
      pass: confidencePass,
      value: confidence,
      threshold: minimumConfidence,
      operator: '>=',
      retryable: true
    }
  ];

  return {
    state,
    score,
    confidence,
    reasons,
    primaryReason: reasons[0] || 'Independent AI quality and all configured user gates passed',
    aiQuality: {
      model: 'MEMEFLOW_INDEPENDENT_AI_V1',
      score,
      components: ai.quality
    },
    settingsEvaluation: {
      state: policy.state,
      minScore: minimumAiScore,
      minConfidence: minimumConfidence,
      gates,
      failedGates: policy.failedGates,
      waitingGates: policy.waitingGates,
      hasRetryableFailure: policy.hasRetryableFailure,
      hasStableFailure: policy.hasStableFailure
    }
  };
}

export {tokenAgeMinutes};
