/**
 * Live token evaluation — active-user registry.
 *
 * Replaces the original evaluateAll(token) which evaluated every registered
 * user synchronously. The new evaluateForActiveUsers(token) evaluates only
 * users active within the configured window (plus all owners), runs in
 * configurable batches, yields between batches so HTTP routes remain
 * responsive, and evicts in-memory decisions for users who have become
 * inactive.
 *
 * The returned function is synchronous from enrich.mjs's perspective
 * (returns a Promise that is ignored by callers that don't await it).
 * Tests can await the returned Promise for deterministic assertions.
 */

import {evaluate} from './evaluate.mjs';

export function makeLiveEvalMetrics() {
  return {
    activeEvaluationUsers: 0,
    liveEvaluationsPerformed: 0,
    liveEvaluationTokensProcessed: 0,
    liveEvaluationUsersSkipped: 0,
    liveEvaluationBatchErrors: 0,
    decisionsInMemoryByActiveUsers: 0,
    lastLiveEvaluationAt: null,
  };
}

/**
 * @param {object} deps
 * @param {object} deps.store              JsonStore instance
 * @param {object} deps.metrics            makeLiveEvalMetrics() object (mutated)
 * @param {number} [deps.activeUserHoursMs=86400000] active-user window in ms
 * @param {number} [deps.batchSize=25]     users per event-loop tick
 * @param {number} [deps.delayMs=0]        ms to sleep between batches
 * @returns {function(object):Promise<void>}  evaluateForActiveUsers(token)
 */
export function makeEvaluateForActiveUsers({
  store, metrics, activeUserHoursMs = 86400000, batchSize = 25, delayMs = 0, onDecision = null,
}) {
  let lastEvictAt = 0;

  async function _run(token) {
    const now = Date.now();
    const cutoff = now - activeUserHoursMs;
    const allUids = Object.keys(store.state.users);

    // Evict in-memory decisions for users that have become inactive (≤ once/min)
    if (now - lastEvictAt > 60000) {
      lastEvictAt = now;
      for (const uid of allUids) {
        const u = store.state.users[uid];
        if (!u.isOwner && (!u.lastActiveAt || u.lastActiveAt < cutoff)) {
          if (store._uidDec[uid]) {
            for (const key of store._uidDec[uid].keys()) delete store.state.decisions[key];
            delete store._uidDec[uid];
          }
        }
      }
    }

    const activeUids = allUids.filter(uid => {
      const u = store.state.users[uid];
      return (u.lastActiveAt && u.lastActiveAt >= cutoff) || u.isOwner;
    });

    metrics.liveEvaluationUsersSkipped += allUids.length - activeUids.length;
    metrics.activeEvaluationUsers = activeUids.length;

    for (let i = 0; i < activeUids.length; i += batchSize) {
      const batch = activeUids.slice(i, i + batchSize);
      for (const uid of batch) {
        try {
          const d = evaluate(token, store.settings(uid));
          const savedDecision = { ...d, primaryReason: d.primaryReason };
          store.setDecision(uid, token.mint, savedDecision);
          if (onDecision) onDecision(uid, token, savedDecision);
          metrics.liveEvaluationsPerformed++;
        } catch (_) {
          metrics.liveEvaluationBatchErrors++;
        }
      }
      if (i + batchSize < activeUids.length) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    metrics.liveEvaluationTokensProcessed++;
    metrics.lastLiveEvaluationAt = Date.now();
    metrics.decisionsInMemoryByActiveUsers =
      activeUids.reduce((s, uid) => s + (store._uidDec[uid]?.size || 0), 0);
  }

  // Synchronous wrapper: returns Promise (awaitable in tests; dropped in prod fire-and-forget)
  return function evaluateForActiveUsers(token) {
    return _run(token).catch(() => {});
  };
}
