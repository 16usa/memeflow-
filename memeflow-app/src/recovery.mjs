/**
 * Bounded startup decision-recovery job.
 *
 * After a restart decisions are gone from memory (they are never persisted to
 * disk). This module re-evaluates every persisted token for every user in
 * configurable batches, yielding the event loop between each batch so the
 * server stays responsive throughout.
 *
 * Decisions are still never written to disk: store.save() already excludes
 * state.decisions, so the on-disk state file is unaffected.
 */

export function makeRecoveryMetrics() {
  return {
    decisionRecoveryStatus: 'pending',           // 'pending' | 'running' | 'complete' | 'error'
    decisionRecoveryStartedAt: null,
    decisionRecoveryCompletedAt: null,
    decisionRecoveryTokensTotal: 0,
    decisionRecoveryTokensProcessed: 0,
    decisionRecoveryDecisionsCreated: 0,
    decisionRecoveryErrors: 0,
  };
}

/**
 * @param {object} deps
 * @param {import('./store.mjs').JsonStore} deps.store
 * @param {function(object):void} deps.evaluateAll  - same function used by live discovery
 * @param {object} deps.metrics   - makeRecoveryMetrics() object (mutated in-place)
 * @param {number} [deps.batchSize=25]  - tokens evaluated per event-loop tick
 * @param {number} [deps.delayMs=25]    - ms to sleep between batches
 */
export async function startDecisionRecovery({ store, evaluateAll, metrics, batchSize = 25, delayMs = 25 }) {
  const tokens = store.tokens();
  metrics.decisionRecoveryStatus = 'running';
  metrics.decisionRecoveryStartedAt = Date.now();
  metrics.decisionRecoveryTokensTotal = tokens.length;

  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    for (const token of batch) {
      const userCount = Object.keys(store.state.users).length;
      try {
        evaluateAll(token);
        metrics.decisionRecoveryTokensProcessed++;
        metrics.decisionRecoveryDecisionsCreated += userCount;
      } catch (_) {
        metrics.decisionRecoveryErrors++;
        metrics.decisionRecoveryTokensProcessed++;
      }
    }
    // Yield to the event loop between batches so health/static requests are served
    if (i + batchSize < tokens.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  metrics.decisionRecoveryStatus = 'complete';
  metrics.decisionRecoveryCompletedAt = Date.now();
}
