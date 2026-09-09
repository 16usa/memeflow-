MEMEFLOW ROW HEIGHT CANONICAL V89
==================================

Decision
--------
Keep the original 64px Trading row contract.

Historical base rule:
  Candidates -> min-height 64px; padding 8px 10px

V89 makes that contract explicit and exact for all three operational lists:

  Candidates      = 64px
  Open positions  = 64px
  Recent trades   = 64px
  vertical padding = 8px

Why this is cleaner
-------------------
- No runtime measuring.
- No MutationObserver.
- No polling.
- No JS-based geometry sync.
- One final CSS authority loaded last.
- Old V87 runtime link is removed from trading.html.
- Experimental V88 runtime sync is defensively removed if present.
- Candidates are restored to their intended 64px design contract.

Untouched
---------
- avatar sizes
- text sizes
- colors / themes
- selected-state fills
- P&L
- CLOSE
- V85/V86 info popover
- trading logic
- backend
- RPC / WebSocket / polling

Install
-------
  unzip -o memeflow-row-height-canonical-v89.zip
  bash memeflow-row-height-canonical-v89/install.sh

Rollback
--------
  bash memeflow-row-height-canonical-v89/rollback.sh
