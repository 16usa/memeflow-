---
name: decision-recovery
description: Startup recovery job design, optimization history, and live-evaluation wiring
---

## Startup decision recovery
- `startDecisionRecovery()` in `src/recovery.mjs` runs once after `server.listen`
- Re-evaluates newest 200 tokens × active users (lastActiveAt within 24h)
- Pauses when live queue is busy (checks `getLiveState()`)
- Decisions never persisted to disk — always re-evaluated after restart
- `evaluateAll` passed as a dep from `app-server.mjs` (not imported directly)

**Why:** Decisions were excluded from state.json to reduce save size; startup recovery rebuilds them. Recovery must use the same active-user gate as live evaluation for consistency.

## Per-user decision Map index
- `store._uidDec` — `Map<uid, Map<key, updatedAt>>`, max 250 per user
- O(250) lookup vs O(36K) full scan

## Live evaluation (liveeval.mjs)
- `makeEvaluateForActiveUsers()` factory — batches evaluation across active users
- Active = `lastActiveAt` within `LIVE_EVALUATION_ACTIVE_USER_HOURS` (default 24h)
- Owner users always included regardless of lastActiveAt
- Returns Promise (fire-and-forget in production; awaitable in tests)
- `store.touchUser(uid)` called on every authenticated request to track activity

## Lazy recovery
- `lazyRecoverUser()` triggered on first `/api/ai/decisions` if `_uidDec[uid]` is empty
- Deduplicates via `_lazyInProgress` Map

## Discovery queue (discqueue.mjs)
- Priority queue: fresh creates always processed before retries
- Stale signatures dropped at drain time (`DISCOVERY_SIGNATURE_MAX_AGE_MS=120000`)
- Circuit breaker: 10s pause on 429/rate-limit, resumes automatically
- `processSignature` uses `rpc.callOnce` (single attempt); queue owns retry logic
- Max 2 retries, delays [2000, 5000]ms
- `RpcPool.callOnce()` rotates endpoint index on 429

## Decode diagnostics (decodePumpCreate in solana.mjs)
- Replaces generic `decodeFailed` counter with sub-counters:
  `noPumpInstruction`, `pumpInstructionWithoutData`, `unknownPumpDiscriminator`,
  `invalidAccountLayout`, `invalidMint`, `createInstructionDecoded`
- `knownNonCreate` reason for Buy/Sell/Withdraw — caller skips decodeFailed increment
- Unknown discriminator bytes logged to stdout for live investigation
- Inner instructions tagged with `_isInner` for diagnostic logging
- Per-transaction mint dedup (`seenMints` Set) prevents double-counting

**Why:** `decodeFailed: 25` with `createsDecoded: 9` suggested unrecognized discriminators or Buy/Sell instructions slipping through; per-reason counters expose the real cause.
