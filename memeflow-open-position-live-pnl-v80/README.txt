MEMEFLOW OPEN POSITION LIVE P&L V80
==================================

Root cause
----------
The backend live endpoint already calculates canonical current P&L for every
open PAPER position and returns it under:

  position.tokenMetrics.pnlReady
  position.tokenMetrics.pnlPct
  position.tokenMetrics.pnlUnrealizedSol
  position.tokenMetrics.pnlMarkPriceSol
  position.tokenMetrics.pnlMarkSource

Trading Terminal renderPositions() ignored those live values and rendered the
older durable field:

  position.unrealizedPnlPct

It also forced missing values to 0, so a stale/not-ready P&L appeared as +0%.

Fix
---
- Open Positions now renders tokenMetrics.pnlPct only when pnlReady=true.
- Positive values: green +X.XX%
- Negative values: red -X.XX%
- Exact zero: neutral 0%
- Missing/untrusted live mark: — (never fake +0%)
- Tiny non-zero moves below 0.01% use 4 decimals.
- Existing 1.8 second terminal polling cadence remains unchanged.
- No trading logic, settlement, strategy, or styling is changed.
- trading.html module URL is cache-busted for mobile Safari/Replit WebView.

Install
-------
From repository root:

  unzip -o memeflow-open-position-live-pnl-v80.zip
  bash memeflow-open-position-live-pnl-v80/install.sh

Rollback
--------
  bash memeflow-open-position-live-pnl-v80/rollback.sh
