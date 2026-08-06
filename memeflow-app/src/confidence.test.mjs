/**
 * Tests for the resolveAiConfidence helper.
 *
 * The function is defined inline in index.html (MEMEFLOW_RESOLVE_AI_CONFIDENCE).
 * We replicate the identical logic here so it can be tested in Node.js without
 * a browser context. Any change to the logic in index.html must be mirrored here.
 *
 * Field priority (highest to lowest):
 *   1. candidate.decision.confidence   — primary AI model field on a decision object
 *   2. candidate.decision.ai_confidence— alternate AI model field on a decision object
 *   3. candidate.ai_confidence         — top-level AI confidence
 *   4. candidate.confidence_pct        — fractional alias
 *   5. candidate.confidence            — generic last resort
 *
 * IMPORTANT: candidateView() in app-server.mjs deliberately omits the `confidence`
 * field (which was data quality × 100 — NOT an AI metric). Real API responses
 * therefore have no `confidence` key, and resolveAiConfidence() correctly returns
 * null → UI shows "—" until a genuine AI confidence field is supplied.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Authoritative resolver (must match index.html exactly) ──────────────────
function resolveAiConfidence(candidate) {
  const raw =
    candidate?.decision?.confidence ??
    candidate?.decision?.ai_confidence ??
    candidate?.ai_confidence ??
    candidate?.confidence_pct ??
    candidate?.confidence;
  if (raw == null) return null; // Number(null)===0 which is finite — guard before conversion
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const percent = value >= 0 && value <= 1 ? value * 100 : value;
  if (percent < 0 || percent > 100) return null;
  return Math.round(percent);
}

// ── Formatting helper (matches render() usage) ──────────────────────────────
function fmt(candidate) {
  const v = resolveAiConfidence(candidate);
  return v !== null ? `${v}%` : '—';
}

// ── Simulated candidateView() output (no `confidence` field) ─────────────────
// Real API responses from candidateView() never include a `confidence` key;
// data completeness is under `data`. This helper produces realistic test objects.
function apiCandidate(overrides = {}) {
  return { id: 'test', name: 'TEST', score: 75, data: 100, state: 'WATCH', ...overrides };
  // NOTE: no `confidence` field — mirrors what candidateView() actually sends
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resolveAiConfidence — value normalisation', () => {
  it('0.85 fraction → 85', () =>
    assert.equal(resolveAiConfidence({ confidence: 0.85 }), 85));

  it('85 integer → 85', () =>
    assert.equal(resolveAiConfidence({ confidence: 85 }), 85));

  it('0 → 0', () =>
    assert.equal(resolveAiConfidence({ confidence: 0 }), 0));

  it('1 (exact boundary) treated as 100%', () =>
    assert.equal(resolveAiConfidence({ confidence: 1 }), 100));

  it('100 → 100', () =>
    assert.equal(resolveAiConfidence({ confidence: 100 }), 100));

  it('50.6 rounds to 51', () =>
    assert.equal(resolveAiConfidence({ confidence: 50.6 }), 51));

  it('0.61 fraction → 61 (spec candidate A)', () =>
    assert.equal(resolveAiConfidence({ confidence: 0.61 }), 61));
});

describe('resolveAiConfidence — missing / invalid input', () => {
  it('no confidence field → null', () =>
    assert.equal(resolveAiConfidence({}), null));

  it('null value → null', () =>
    assert.equal(resolveAiConfidence({ confidence: null }), null));

  it('undefined value → null', () =>
    assert.equal(resolveAiConfidence({ confidence: undefined }), null));

  it('non-numeric string → null', () =>
    assert.equal(resolveAiConfidence({ confidence: 'bad' }), null));

  it('NaN → null', () =>
    assert.equal(resolveAiConfidence({ confidence: NaN }), null));

  it('null candidate → null', () =>
    assert.equal(resolveAiConfidence(null), null));

  it('undefined candidate → null', () =>
    assert.equal(resolveAiConfidence(undefined), null));

  it('-1 out of range → null', () =>
    assert.equal(resolveAiConfidence({ confidence: -1 }), null));

  it('101 out of range → null', () =>
    assert.equal(resolveAiConfidence({ confidence: 101 }), null));
});

describe('resolveAiConfidence — field priority', () => {
  it('decision.confidence beats all other fields', () =>
    assert.equal(
      resolveAiConfidence({ decision: { confidence: 72, ai_confidence: 50 }, ai_confidence: 60, confidence: 90 }),
      72));

  it('decision.ai_confidence beats ai_confidence and confidence', () =>
    assert.equal(
      resolveAiConfidence({ decision: { ai_confidence: 55 }, ai_confidence: 60, confidence: 90 }),
      55));

  it('ai_confidence beats confidence_pct and confidence', () =>
    assert.equal(
      resolveAiConfidence({ ai_confidence: 65, confidence_pct: 0.4, confidence: 90 }),
      65));

  it('confidence_pct beats confidence', () =>
    assert.equal(
      resolveAiConfidence({ confidence_pct: 0.5, confidence: 90 }),
      50));

  it('confidence is last resort', () =>
    assert.equal(resolveAiConfidence({ confidence: 80 }), 80));

  it('decision.confidence=null falls through to decision.ai_confidence', () =>
    assert.equal(
      resolveAiConfidence({ decision: { confidence: null, ai_confidence: 58 } }),
      58));

  it('decision.confidence=null falls through to ai_confidence', () =>
    assert.equal(
      resolveAiConfidence({ decision: { confidence: null }, ai_confidence: 77 }),
      77));

  it('all decision fields null falls through to confidence_pct', () =>
    assert.equal(
      resolveAiConfidence({ decision: { confidence: null, ai_confidence: null }, confidence_pct: 0.66 }),
      66));
});

describe('resolveAiConfidence — render format', () => {
  it('valid → "85%"', () =>
    assert.equal(fmt({ confidence: 85 }), '85%'));

  it('fraction → "85%"', () =>
    assert.equal(fmt({ confidence: 0.85 }), '85%'));

  it('missing → "—"', () =>
    assert.equal(fmt({}), '—'));

  it('null candidate → "—"', () =>
    assert.equal(fmt(null), '—'));
});

// ── Multi-candidate switching (spec §9) ──────────────────────────────────────
describe('resolveAiConfidence — multi-candidate switching (spec §9)', () => {
  // Three candidates matching the spec exactly.
  // Candidate A uses the last-resort `confidence` field (0.61 fraction → 61%).
  // Candidate B uses an integer confidence (84 → 84%).
  // Candidate C has no confidence field at all (→ null → "—").
  const A = { id: 'a', name: 'Alpha', score: 72, data: 100, confidence: 0.61 };
  const B = { id: 'b', name: 'Beta',  score: 88, data: 97,  confidence: 84 };
  const C = { id: 'c', name: 'Gamma', score: 65, data: 95 }; // no confidence

  it('Candidate A: 0.61 → 61%', () =>
    assert.equal(fmt(A), '61%'));

  it('Candidate B: 84 → 84%', () =>
    assert.equal(fmt(B), '84%'));

  it('Candidate C: missing → —', () =>
    assert.equal(fmt(C), '—'));

  it('switching A → B → C gives 61% → 84% → —', () => {
    assert.equal(fmt(A), '61%');
    assert.equal(fmt(B), '84%');
    assert.equal(fmt(C), '—');
  });

  it('switching back C → B → A restores values', () => {
    assert.equal(fmt(C), '—');
    assert.equal(fmt(B), '84%');
    assert.equal(fmt(A), '61%');
  });

  it('no value leaks: A confidence never appears while B is selected', () => {
    const forA = resolveAiConfidence(A);
    const forB = resolveAiConfidence(B);
    assert.notEqual(forA, forB);
    assert.equal(forA, 61);
    assert.equal(forB, 84);
  });

  it('no value leaks: B confidence never appears while C is selected', () => {
    const forB = resolveAiConfidence(B);
    const forC = resolveAiConfidence(C);
    assert.equal(forB, 84);
    assert.equal(forC, null); // not 84
  });
});

// ── Polling update behavior (spec §10) ──────────────────────────────────────
describe('resolveAiConfidence — polling updates (spec §10)', () => {
  it('polling updates Candidate A confidence from 61% to 72%', () => {
    const A_v1 = { id: 'a', confidence: 0.61 };
    const A_v2 = { id: 'a', confidence: 0.72 }; // updated by poll

    assert.equal(resolveAiConfidence(A_v1), 61);
    assert.equal(resolveAiConfidence(A_v2), 72);
  });

  it('switching away then back to A shows the latest polled value', () => {
    const A_v2 = { id: 'a', confidence: 0.72 };
    const B    = { id: 'b', confidence: 84 };

    // Switch to B
    assert.equal(resolveAiConfidence(B),    84);
    // Switch back to A (now at v2)
    assert.equal(resolveAiConfidence(A_v2), 72);
  });

  it('polling same data 5× returns same value (no drift)', () => {
    const c = { id: 'a', confidence: 0.61 };
    for (let i = 0; i < 5; i++) {
      assert.equal(resolveAiConfidence(c), 61);
    }
  });
});

// ── Data-completeness non-leakage (spec §8, key regression) ─────────────────
describe('resolveAiConfidence — no data-completeness leakage', () => {
  // Real API candidates from candidateView() have no `confidence` field.
  // Data quality is under `data`. The resolver must return null, not 100.
  it('API candidate with data:100 but no AI confidence → null (shows —)', () => {
    const apiCand = apiCandidate({ data: 100 }); // fully enriched, no AI confidence
    assert.equal(resolveAiConfidence(apiCand), null);
    assert.equal(fmt(apiCand), '—');
  });

  it('API candidate with data:97 but no AI confidence → null (shows —)', () => {
    const apiCand = apiCandidate({ data: 97 });
    assert.equal(resolveAiConfidence(apiCand), null);
  });

  it('two fully-enriched API candidates without AI confidence both show —, not 100%', () => {
    const X = apiCandidate({ id: 'x', data: 100 });
    const Y = apiCandidate({ id: 'y', data: 100 });
    assert.equal(fmt(X), '—');
    assert.equal(fmt(Y), '—');
    // They must not both show "100%" just because data quality is 100
  });

  it('score field is not used as confidence', () => {
    const cand = apiCandidate({ score: 88 });
    assert.equal(resolveAiConfidence(cand), null);
  });

  it('no fixed 100 appears: candidate with every field null → null', () => {
    const cand = {
      id: 'z', name: 'Z', score: null, data: null,
      confidence: null, ai_confidence: null,
      confidence_pct: null,
      decision: { confidence: null, ai_confidence: null },
    };
    assert.equal(resolveAiConfidence(cand), null);
    assert.equal(fmt(cand), '—');
  });

  it('Primary Candidate and AI analysis both call same resolver → can never diverge', () => {
    const c = { ai_confidence: 73, confidence: 100 }; // confidence is data quality
    const primary = resolveAiConfidence(c);
    const detail  = resolveAiConfidence(c);
    assert.equal(primary, detail);
    assert.equal(primary, 73); // ai_confidence wins, NOT the data-quality 100
  });
});
