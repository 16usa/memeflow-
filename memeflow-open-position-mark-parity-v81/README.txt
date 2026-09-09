MEMEFLOW OPEN POSITION MARK PARITY V81
======================================

Observed symptom
----------------
V80 correctly stopped rendering a fake +0%. It exposed the real backend state:
pnlReady=false, therefore the UI showed "—".

At the same time, after a restart, a manual PAPER close could succeed and Recent
Trades recorded a real realized P&L.

Root cause
----------
There were two different market-price authorities:

1) /api/paper/positions/live
   - accepted a trade-backed market mark;
   - otherwise accepted an engine price only after it differed from entry;
   - rejected fresh token market telemetry.

2) manual PAPER close V78
   - accepted a fresh token price with a fresh post-entry timestamp.

So the same position could be:
  "no live P&L available" in Open Positions
while also being:
  "safe to close at a current price" in V78.

V81 fix
-------
Adds one shared resolver used by both paths.

Authority order:
1. fresh post-entry trade mark
2. fresh post-entry token market mark
3. fresh post-entry engine lifecycle mark
4. unavailable

Default freshness window remains 120 seconds.

A stale price-specific timestamp cannot be made fresh merely because a generic
record updatedAt changed.

No extra polling, RPC, Solana calls, or UI timers are added.

Install
-------
  unzip -o memeflow-open-position-mark-parity-v81.zip
  bash memeflow-open-position-mark-parity-v81/install.sh

Rollback
--------
  bash memeflow-open-position-mark-parity-v81/rollback.sh
