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

// MEMEFLOW_RECOVERY_LIVE_PRIORITY_V38
// Recovery is never authoritative over a decision that the live path has
// already produced for the same user+mint.
export function recoveryCurrentToken(store,tokenSnapshot){
  const mint=String(tokenSnapshot?.mint||'').trim();
  if(!mint)return tokenSnapshot||null;
  return (
    store.getToken?.(mint) ||
    store.state?.tokens?.[mint] ||
    tokenSnapshot ||
    null
  );
}

export function recoveryDecisionExists(store,uid,mint){
  const key=String(uid||'')+':'+String(mint||'');
  return Boolean(store.state?.decisions?.[key]);
}

export function recoveryLiveStateBusy(getLiveState){
  if(typeof getLiveState!=='function')return false;
  const state=getLiveState()||{};
  return (
    Number(state.queueDepth||0)>0 ||
    Number(state.processing||0)>0
  );
}

async function waitForLiveIdle(getLiveState,metrics,delayMs){
  while(recoveryLiveStateBusy(getLiveState)){
    metrics.decisionRecoveryPausedForLiveWork++;
    await new Promise(
      r=>setTimeout(r,Math.max(1,Number(delayMs)||1))
    );
  }
}

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
  evaluateFn = evaluate,
}) {
  const now = Date.now();
  const cutoff = now - activeUserHoursMs;

  // Keep only mint ordering from the startup snapshot. The token object itself
  // is re-read immediately before evaluate() so WS updates cannot go stale.
  const allTokens = store.tokens();
  const tokens = allTokens.slice(0, tokenLimit);

  // Match the live evaluator: owner is always active.
  const activeUids = Object.keys(store.state.users).filter(uid => {
    const u = store.state.users[uid] || {};
    return (
      u.isOwner === true ||
      (u.lastActiveAt != null && u.lastActiveAt >= cutoff)
    );
  });

  metrics.decisionRecoveryStatus = 'running';
  metrics.decisionRecoveryStartedAt = now;
  metrics.decisionRecoveryTokensTotal = allTokens.length;
  metrics.decisionRecoveryTokensLimit = tokenLimit;
  metrics.decisionRecoveryUsersTotal = activeUids.length;

  const safeBatchSize=Math.max(1,Number(batchSize)||1);

  for (let i = 0; i < tokens.length; i += safeBatchSize) {
    // Recovery may begin only while live work is idle.
    await waitForLiveIdle(getLiveState,metrics,delayMs);

    const batch = tokens.slice(i, i + safeBatchSize);

    for (const tokenSnapshot of batch) {
      // Yield before EVERY recovered token so a WS event can land and become
      // visible to getLiveState/recoveryDecisionExists before recovery writes.
      await new Promise(r => setImmediate(r));
      await waitForLiveIdle(getLiveState,metrics,delayMs);

      const token=recoveryCurrentToken(store,tokenSnapshot);
      const mint=String(token?.mint||'').trim();

      if(!mint){
        metrics.decisionRecoveryTokensProcessed++;
        continue;
      }

      for (const uid of activeUids) {
        try {
          // Fresh/live/current decision is authoritative. Recovery fills only
          // missing gaps; it never downgrades WATCH/BUY READY/score.
          if(recoveryDecisionExists(store,uid,mint))continue;

          const d = evaluateFn(token, store.settings(uid));

          // evaluateFn is synchronous today. Keep a second adjacent guard so a
          // future async/refactor cannot silently reintroduce this overwrite.
          if(recoveryDecisionExists(store,uid,mint))continue;

          store.setDecision(
            uid,
            mint,
            {
              ...d,
              primaryReason:d.primaryReason,
              recoverySource:'startup'
            }
          );

          metrics.decisionRecoveryEvaluationsPerformed++;
        } catch (_) {
          metrics.decisionRecoveryErrors++;
        }
      }

      metrics.decisionRecoveryTokensProcessed++;
    }

    if (i + safeBatchSize < tokens.length) {
      await new Promise(
        r=>setTimeout(r,Math.max(1,Number(delayMs)||1))
      );
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
export function lazyRecoverUser({
  store, uid, metrics, tokenLimit = 200, evaluateFn = evaluate,
}) {
  if (_lazyInProgress.has(uid)) return _lazyInProgress.get(uid);

  metrics.lazyRecoveryUsersRunning++;

  const p = Promise.resolve().then(async () => {
    // Snapshots define ordering only. Re-read every token immediately before
    // evaluation so lazy recovery also respects current WS state.
    const snapshots = store.tokens().slice(0, tokenLimit);

    for (const tokenSnapshot of snapshots) {
      await new Promise(r => setImmediate(r));

      const token=recoveryCurrentToken(store,tokenSnapshot);
      const mint=String(token?.mint||'').trim();

      if(!mint || recoveryDecisionExists(store,uid,mint))continue;

      try {
        const d = evaluateFn(token, store.settings(uid));

        if(recoveryDecisionExists(store,uid,mint))continue;

        store.setDecision(
          uid,
          mint,
          {
            ...d,
            primaryReason:d.primaryReason,
            recoverySource:'lazy'
          }
        );
      } catch (_) { /* skip individual failures */ }
    }
  }).finally(() => {
    _lazyInProgress.delete(uid);
    metrics.lazyRecoveryUsersRunning =
      Math.max(0, metrics.lazyRecoveryUsersRunning - 1);
    metrics.lazyRecoveryCompleted++;
  });

  _lazyInProgress.set(uid, p);
  return p;
}
