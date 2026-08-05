---
name: Decision recovery job
description: Bounded startup recovery that re-evaluates persisted tokens for all users after a restart, since decisions are never persisted to disk.
---

## Optimized design (v2)
Startup recovery now evaluates only newest `DECISION_RECOVERY_TOKEN_LIMIT` (default 200) tokens × active users (`lastActiveAt` within `DECISION_RECOVERY_ACTIVE_USER_HOURS=24`). Pauses for live discovery queue. Inactive users get lazy recovery via `lazyRecoverUser()` on first `/api/ai/decisions` call. Recovery time: 35s → 210ms.

`store.touchUser(id)` updates `lastActiveAt` on every authenticated request, enabling active-user detection across restarts.

## Rule
After each restart, `startDecisionRecovery()` in `memeflow-app/src/recovery.mjs` re-evaluates all persisted tokens in batches. It is called in `server.listen()` callback in `app-server.mjs` and runs concurrently with live discovery.

**Why:** `store.save()` excludes `state.decisions` (to keep the state file small and avoid event-loop blocking). So after restart, `store._uidDec` and `store.state.decisions` are empty. Live discovery only re-evaluates tokens when new Pump.fun events arrive; persisted tokens are never re-enriched by discovery. The recovery job fills the gap.

**How to apply:**
- Batch size: `DECISION_RECOVERY_BATCH_SIZE` env var (default 25 tokens/batch)
- Delay between batches: `DECISION_RECOVERY_DELAY_MS` env var (default 25ms)
- Recovery metrics are exposed in `/api/discovery/status` under the `decisionRecovery*` keys
- With 2,619 tokens and 1,090 users, one recovery run takes ~35 seconds and produces ~2.9M decisions
- Event loop remains responsive throughout (requests complete in 1-4ms between batch blocks)
- Decisions are still never written to disk during recovery (save() excludes them)

## Key constraint
`evaluateAll()` is defined as a closure in `app-server.mjs` and passed into `startDecisionRecovery()` as a dep — it cannot be imported separately.
