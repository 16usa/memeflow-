/**
 * Bounded startup decision-recovery and lazy per-user recovery.
 *
 * Startup: evaluates only the newest tokenLimit persisted tokens for users
 * who were active within activeUserHoursMs. Yields to the event loop
 * between batches and pauses whenever the live discovery queue is non-empty
 * so live events always have priority.
 *
 * Lazy: when an inactive user opens /api/ai/decisions their newest tokenLimit
 * tokens are evaluated on demand. Concurrent requests for the same user are
 * deduplicated (return the same Promise).
 *
 * Decisions are never written to disk — store.save() excludes state.decisions.
 */

import {evaluate} from './evaluate.mjs';
import {tokenAllowedForSettings} from './discovery-eligibility.mjs';

export function makeRecoveryMetrics() {
  return {
    decisionRecoveryStatus: 'pending',
    decisionRecoveryStartedAt: null,
    decisionRecoveryCompletedAt: null,
    decisionRecoveryTokensTotal: 0,          // all persisted tokens at startup
    decisionRecoveryTokensLimit: 0,          // configured cap
    decisionRecoveryTokensProcessed: 0,
    decisionRecoveryUsersTotal: 0,           // active users at startup
    decisionRecoveryUsersProcessed: 0,
    decisionRecoveryDecisionsCreated: 0,     // decisions retained in memory
    decisionRecoveryEvaluationsPerformed: 0, // total evaluate() calls
    decisionRecoveryErrors: 0,
    decisionRecoveryPausedForLiveWork: 0,    // times yielded for live queue
    lazyRecoveryUsersRunning: 0,
    lazyRecoveryCompleted: 0,
  };
}

// Per-user lazy recovery deduplication: uid → Promise
const _lazyInProgress = new Map();

/**
 * @param {object} deps
 * @param {object} deps.store            JsonStore instance
 * @param {object} deps.metrics          makeRecoveryMetrics() object (mutated)
 * @param {function} [deps.getLiveState] () => { queueDepth, processing } — live queue state
 * @param {number} [deps.batchSize=25]   tokens per event-loop tick
 * @param {number} [deps.delayMs=25]     ms to sleep between batches
 * @param {number} [deps.tokenLimit=200] max newest tokens to evaluate
 * @param {number} [deps.activeUserHoursMs=86400000] cutoff for "active" users
 */
export async function startDecisionRecovery({
  store, metrics, getLiveState,
  batchSize = 25, delayMs = 25, tokenLimit = 200, activeUserHoursMs = 86400000,
}) {
  const now = Date.now();
  const cutoff = now - activeUserHoursMs;

  // Newest tokenLimit tokens (store.tokens() already returns desc by discoveredAt)
  const allTokens = store.tokens();
  const tokens = allTokens.slice(0, tokenLimit);

  // Only users active within the configured window
  const activeUids = Object.keys(store.state.users).filter(uid => {
    const u = store.state.users[uid];
    return u.lastActiveAt != null && u.lastActiveAt >= cutoff;
  });

  metrics.decisionRecoveryStatus = 'running';
  metrics.decisionRecoveryStartedAt = now;
  metrics.decisionRecoveryTokensTotal = allTokens.length;
  metrics.decisionRecoveryTokensLimit = tokenLimit;
  metrics.decisionRecoveryUsersTotal = activeUids.length;

  for (let i = 0; i < tokens.length; i += batchSize) {
    // Pause for live discovery work — live events must always have priority
    if (getLiveState) {
      let ls = getLiveState();
      while (ls.queueDepth > 0 || ls.processing > 0) {
        metrics.decisionRecoveryPausedForLiveWork++;
        await new Promise(r => setTimeout(r, delayMs));
        ls = getLiveState();
      }
    }

    const batch = tokens.slice(i, i + batchSize);
    for (const token of batch) {
      for (const uid of activeUids) {
        try {
          const settings = store.settings(uid);

          if (!tokenAllowedForSettings(settings, token)) {
            store.deleteDecision?.(uid, token.mint);
            continue;
          }

          const d = evaluate(token, settings);
          store.setDecision(uid, token.mint, { ...d, primaryReason: d.primaryReason });
          metrics.decisionRecoveryEvaluationsPerformed++;
        } catch (_) {
          metrics.decisionRecoveryErrors++;
        }
      }
      metrics.decisionRecoveryTokensProcessed++;
    }

    if (i + batchSize < tokens.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  // Count actually retained decisions (evictions already applied by setDecision)
  metrics.decisionRecoveryDecisionsCreated =
    Object.values(store._uidDec).reduce((s, m) => s + m.size, 0);
  metrics.decisionRecoveryUsersProcessed = activeUids.length;
  metrics.decisionRecoveryStatus = 'complete';
  metrics.decisionRecoveryCompletedAt = Date.now();
}

/**
 * Evaluate the newest tokenLimit tokens for a single user.
 * Deduplicates concurrent calls for the same uid.
 * Called from /api/ai/decisions when user has no current decisions.
 *
 * @param {object} deps
 * @param {object} deps.store
 * @param {string} deps.uid
 * @param {object} deps.metrics   makeRecoveryMetrics() object (mutated)
 * @param {number} [deps.tokenLimit=200]
 * @returns {Promise<void>}
 */
export function lazyRecoverUser({ store, uid, metrics, tokenLimit = 200 }) {
  if (_lazyInProgress.has(uid)) return _lazyInProgress.get(uid);

  metrics.lazyRecoveryUsersRunning++;

  const p = Promise.resolve().then(() => {
    const tokens = store.tokens().slice(0, tokenLimit);
    const settings = store.settings(uid);

    for (const token of tokens) {
      try {
        if (!tokenAllowedForSettings(settings, token)) {
          store.deleteDecision?.(uid, token.mint);
          continue;
        }

        const d = evaluate(token, settings);
        store.setDecision(uid, token.mint, { ...d, primaryReason: d.primaryReason });
      } catch (_) { /* skip individual failures */ }
    }
  }).finally(() => {
    _lazyInProgress.delete(uid);
    metrics.lazyRecoveryUsersRunning = Math.max(0, metrics.lazyRecoveryUsersRunning - 1);
    metrics.lazyRecoveryCompleted++;
  });

  _lazyInProgress.set(uid, p);
  return p;
}
