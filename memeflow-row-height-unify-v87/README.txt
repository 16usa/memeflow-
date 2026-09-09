MEMEFLOW ROW HEIGHT UNIFY V87
==============================

Root cause
----------
The three operational lists did not share one final row-height authority.

Current canonical base geometry:
- Candidates: min-height 64px; padding 8px 10px
- Recent trades: height/min/max-height 64px
- Open positions: older 58px / 62px breakpoint chain

Later responsive/visual layers made the visual mismatch more obvious.

Fix
---
Candidates stays untouched and is the reference.

V87 adds one final geometry-only stylesheet:
- Open positions = exactly 64px
- Recent trades = exactly 64px
- vertical padding = 8px
- content vertically centered

V87 does NOT change:
- Candidate rows
- token image sizes
- typography
- colors / themes
- P&L
- Close button behavior
- info popover
- selection styles
- trading logic / backend / RPC

Install
-------
  unzip -o memeflow-row-height-unify-v87.zip
  bash memeflow-row-height-unify-v87/install.sh

Rollback
--------
  bash memeflow-row-height-unify-v87/rollback.sh
