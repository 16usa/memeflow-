/**
 * Tests for the resolveAiConfidence helper.
 *
 * The function is defined inline in index.html (MEMEFLOW_RESOLVE_AI_CONFIDENCE).
 * We replicate the identical logic here so it can be tested in Node.js without
 * a browser context. Any change to the logic in index.html must be mirrored here.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Authoritative resolver (must match index.html exactly) ──────────────────
function resolveAiConfidence(candidate) {
  const raw =
    candidate?.decision?.confidence ??
    candidate?.ai_confidence ??
    candidate?.confidence ??
    candidate?.confidence_pct;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  // Values in [0, 1] are treated as fractions (0.85 → 85); otherwise integer %.
  const percent = value >= 0 && value <= 1 ? value * 100 : value;
  if (percent < 0 || percent > 100) return null;
  return Math.round(percent);
}

// ── Formatting helper (matches render() usage) ──────────────────────────────
function fmt(candidate) {
  const v = resolveAiConfidence(candidate);
  return v !== null ? `${v}%` : '—';
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('resolveAiConfidence — value normalisation', () => {
  it('0.85 (fraction) → 85', () =>
    assert.equal(resolveAiConfidence({ confidence: 0.85 }), 85));

  it('85 (integer) → 85', () =>
    assert.equal(resolveAiConfidence({ confidence: 85 }), 85));

  it('0 → 0', () =>
    assert.equal(resolveAiConfidence({ confidence: 0 }), 0));

  it('100 → 100', () =>
    assert.equal(resolveAiConfidence({ confidence: 100 }), 100));

  it('50.6 rounds to 51', () =>
    assert.equal(resolveAiConfidence({ confidence: 50.6 }), 51));
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
  it('decision.confidence beats confidence', () =>
    assert.equal(resolveAiConfidence({ decision: { confidence: 72 }, confidence: 90 }), 72));

  it('ai_confidence beats confidence', () =>
    assert.equal(resolveAiConfidence({ ai_confidence: 65, confidence: 90 }), 65));

  it('ai_confidence beats confidence_pct', () =>
    assert.equal(resolveAiConfidence({ ai_confidence: 65, confidence_pct: 0.9 }), 65));

  it('confidence beats confidence_pct', () =>
    assert.equal(resolveAiConfidence({ confidence: 80, confidence_pct: 0.5 }), 80));

  it('falls back to confidence_pct when no other field', () =>
    assert.equal(resolveAiConfidence({ confidence_pct: 0.6 }), 60));

  it('decision.confidence=null falls through to confidence', () =>
    assert.equal(resolveAiConfidence({ decision: { confidence: null }, confidence: 77 }), 77));
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

describe('resolveAiConfidence — candidate switching and poll stability', () => {
  const candidateA = { id: 'a', confidence: 85 };
  const candidateB = { id: 'b', confidence: 92 };
  const candidateNoConf = { id: 'c' };

  it('switching from A to B gives B confidence', () => {
    assert.equal(resolveAiConfidence(candidateA), 85);
    assert.equal(resolveAiConfidence(candidateB), 92);
  });

  it('switching to a candidate without confidence gives null (not a fallback value)', () =>
    assert.equal(resolveAiConfidence(candidateNoConf), null));

  it('polling with same data returns same value (no drift)', () => {
    // Simulates render() being called multiple times for the same candidate.
    for (let i = 0; i < 5; i++) {
      assert.equal(resolveAiConfidence(candidateA), 85);
    }
  });

  it('Primary Candidate and AI analysis use the same resolver (same output for same input)', () => {
    // Both surfaces call resolveAiConfidence(c); the single source of truth means
    // they can never diverge for the same candidate object.
    const c = { confidence: 73, decision: { confidence: 68 } };
    const primary = resolveAiConfidence(c);
    const detail  = resolveAiConfidence(c);
    assert.equal(primary, detail);
    assert.equal(primary, 68); // decision.confidence wins
  });
});
