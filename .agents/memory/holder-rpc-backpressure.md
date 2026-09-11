---
name: Holder RPC backpressure
description: Non-obvious provider pacing and token-program constraints for canonical holder scans.
---

Canonical holder scans must use one provider-bounded RPC attempt, select the mint's known token program directly, and keep queue intake below the paced `getProgramAccounts` service rate. If an older token lacks program identity, resolve the mint account owner before scanning rather than blindly probing both token programs.

**Why:** Same-method RPC pacing serializes request starts. Hidden provider retries and blind legacy-then-Token-2022 scans caused worker deadlines to expire while requests continued underneath, amplifying retries and backlog.

**How to apply:** Preserve token-program identity from discovery events, retain fail-closed holder validation, and compare queue arrival rate with measured completion rate before changing concurrency or deadlines.