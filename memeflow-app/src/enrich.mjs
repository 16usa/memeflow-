/**
 * Per-step token enrichment with partial-result preservation.
 * Imported by app-server.mjs; dep-injected for testability.
 */
import {decodeCurve} from './solana.mjs';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip RPC URLs and long base58 addresses from error messages. */
function sanitize(msg) {
  return (msg || 'unknown error')
    .replace(/https?:\/\/\S+/gi, '[rpc-url]')
    .replace(/[1-9A-HJ-NP-Za-km-z]{32,}/g, '[addr]')
    .slice(0, 200);
}

export function recordEnrichError(enrichDiag, mint, step, e) {
  const msg = sanitize(e?.message || String(e));
  enrichDiag.lastEnrichError = `${step}: ${msg}`;
  enrichDiag.lastEnrichErrorAt = Date.now();
  enrichDiag.lastEnrichMint = mint;
  enrichDiag.enrichFailureReasons[msg] = (enrichDiag.enrichFailureReasons[msg] || 0) + 1;
}

export function makeEnrichDiag() {
  return {
    lastEnrichError: null,
    lastEnrichErrorAt: null,
    lastEnrichMint: null,
    enrichFailureReasons: {},
    enrichStepFailures: {
      getTokenSupply: 0,
      getTokenLargestAccounts: 0,
      getAccountInfo: 0,
      decodeCurve: 0,
      evaluate: 0,
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Enrich a newly-discovered Pump.fun token with on-chain data.
 *
 * Each step is attempted independently. Partial results are stored.
 * Success is defined as: token stored + evaluateAll run + publish called —
 * even when some optional enrichment fields are unavailable.
 *
 * holderFresh reflects ONLY whether getTokenLargestAccounts succeeded;
 * bonding-curve failures do not affect it.
 *
 * @param {string}      mint   token mint address
 * @param {string|null} curve  bonding-curve account address (may be null)
 * @param {object}      deps   { rpc, store, tradeWindows, evaluateAll,
 *                               publish, ensurePriceTimer, discMetrics, enrichDiag }
 */
export async function enrichToken(mint, curve, deps) {
  const {
    rpc, store, tradeWindows, evaluateAll,
    publish, ensurePriceTimer, discMetrics, enrichDiag,
  } = deps;

  let anyStepFailed = false;

  function fail(step, e) {
    anyStepFailed = true;
    if (step in enrichDiag.enrichStepFailures) enrichDiag.enrichStepFailures[step]++;
    recordEnrichError(enrichDiag, mint, step, e);
  }

  try {
    // ── Step 1: getTokenSupply ──────────────────────────────────────────────
    let supply = null;
    try {
      supply = await rpc.call('getTokenSupply', [mint, {commitment: 'confirmed'}]);
    } catch(e) { fail('getTokenSupply', e); }

    // ── Step 2: getTokenLargestAccounts ────────────────────────────────────
    // Only meaningful when supply succeeded (need decimals for % calculation).
    // holderFresh = true ONLY when this step succeeds.
    let largest = null;
    let holderFresh = false;
    if (supply) {
      try {
        largest = await rpc.call('getTokenLargestAccounts', [mint, {commitment: 'confirmed'}]);
        holderFresh = true;
      } catch(e) { fail('getTokenLargestAccounts', e); }
    }

    // ── Step 3: getAccountInfo (bonding curve, optional) ───────────────────
    // Failure here does NOT affect holderFresh or supply data.
    let curveInfo = null;
    if (curve) {
      try {
        curveInfo = await rpc.call('getAccountInfo', [curve, {encoding: 'base64', commitment: 'confirmed'}]);
      } catch(e) { fail('getAccountInfo', e); }
    }

    // ── Step 4: decodeCurve (optional, depends on curveInfo) ───────────────
    let c = {};
    if (curveInfo?.value?.data?.[0]) {
      try {
        c = decodeCurve(curveInfo.value.data[0], supply?.value?.decimals ?? 6);
      } catch(e) { fail('decodeCurve', e); }
    }

    // ── Build token update from whatever succeeded ─────────────────────────
    const decimals = supply?.value?.decimals ?? 6;
    const total = Number(supply?.value?.uiAmountString ?? 0);
    const vals = (largest?.value ?? []).map(x => Number(x.uiAmountString ?? 0));
    const top10 = (total && vals.length)
      ? vals.slice(0, 10).reduce((a, b) => a + b, 0) / total * 100
      : null;
    const holderCount = largest
      ? (vals.length === 20 ? null : vals.filter(v => v > 0).length)
      : null;
    const tw = (tradeWindows?.get?.(mint)) || {buy: 0, sell: 0};

    const update = {
      scanError: null,
      lastScannedAt: Date.now(),
      holderFresh,
      buyPressure: tw.sell ? tw.buy / tw.sell : (tw.buy ? tw.buy : null),
      dataQuality: [total || null, top10, c.priceSol ?? null].filter(x => x != null).length / 3,
      source: 'Solana RPC',
    };
    // Supply data
    if (supply) { update.decimals = decimals; update.totalSupply = total; }
    // Holder data (independent of curve)
    if (largest) { update.top10Pct = top10; update.holderCount = holderCount; }
    // Curve data (independent of holder)
    if (Object.keys(c).length) {
      update.priceSol       = c.priceSol    ?? null;
      update.liquiditySol   = c.liquiditySol ?? null;
      update.marketCapSol   = (c.priceSol && total) ? c.priceSol * total : null;
      update.complete       = c.complete     ?? null;
    }

    // ── Always store, evaluate, publish ────────────────────────────────────
    const token = store.setToken(mint, update);

    // ── Step 5: evaluate (score the token) ─────────────────────────────────
    try {
      evaluateAll(token);
    } catch(e) { fail('evaluate', e); }

    publish(mint);
    if (ensurePriceTimer) ensurePriceTimer(mint, curve);

    // Success: token stored and published regardless of step failures
    discMetrics.enrichSucceeded++;

    // Clear stale enrich error only after a fully clean enrichment (no step errors)
    if (!anyStepFailed) {
      enrichDiag.lastEnrichError    = null;
      enrichDiag.lastEnrichErrorAt  = null;
      enrichDiag.lastEnrichMint     = null;
    }
  } catch(e) {
    // Truly unrecoverable: store.setToken or publish threw (should not happen)
    if (store.state?.metrics) store.state.metrics.errors++;
    store.save?.();
    discMetrics.enrichFailed++;
    recordEnrichError(enrichDiag, mint, 'store/publish', e);
  }
}
