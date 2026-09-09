MEMEFLOW OPEN POSITION LIVE VALUE V83
====================================

Final Open Positions display
----------------------------
Each open position now shows:

  CURRENT LIVE VALUE OF REMAINING TOKENS · TOTAL POSITION P&L

Example:
  0.82000 SOL · +0.14000 SOL

Meaning:
- 0.82000 SOL = remainingTokenQuantity × current live mark price.
- +0.14000 SOL = realized P&L from already-sold portions
                  + unrealized P&L on the remaining open tokens.

Partial sell example
--------------------
Open 1.00 SOL.
Sell 25%.
The engine already reduces remainingTokenQuantity.

If the remaining 75% are currently worth 0.82 SOL:
  first number -> 0.82000 SOL

If already-realized P&L + current unrealized P&L = +0.14 SOL:
  second number -> +0.14000 SOL

Therefore the first number is NOT the original 1 SOL and NOT the remaining
cost basis. It is the actual current market value of the still-open portion.

Quiet-market fix
----------------
Confirmed post-entry TradeEvent prices no longer expire merely because no new
trade occurred for 120 seconds. The last confirmed trade remains the latest
known price until a newer confirmed trade supersedes it.

Safety
------
- pre-entry trade marks rejected
- future trade timestamps rejected
- non-trade telemetry still expires
- engine lifecycle marks still expire
- V78 false-Flat protection preserved
- no new RPC, WebSocket, polling loop, or timer
- backup + rollback + regression tests included

Install
-------
  unzip -o memeflow-open-position-live-value-v83.zip
  bash memeflow-open-position-live-value-v83/install.sh

Rollback
--------
  bash memeflow-open-position-live-value-v83/rollback.sh
