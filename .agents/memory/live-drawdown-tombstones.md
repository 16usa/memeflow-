---
name: Live drawdown tombstones
description: Persistence and propagation rules for immediate operational deletion after an 80% live drawdown.
---

When a valid live price is at least 80% below the highest valid tracked peak, operational deletion must complete synchronously before the price update can return to downstream evaluation or publishing. Drawdown deletion creates a durable registry tombstone in addition to the session tombstone.

**Why:** Session-only deletion allowed stale queued registry writes or a stale state snapshot to resurrect a token after restart. Deferred deletion also left a window for evaluation and publishing after the threshold was crossed.

**How to apply:** Treat durable drawdown tombstones as higher priority than pending writes, registry hydration, lazy hydration, and state snapshots. Preserve open-position protection and the exact 79.99/80 boundary.