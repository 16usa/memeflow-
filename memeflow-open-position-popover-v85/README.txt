MEMEFLOW OPEN POSITION POPOVER V85
===================================

What changed
------------
Open Position rows stay single-line and compact:

  LIVE VALUE · TOTAL P&L · info-icon

The old oversized V84 "!" control is replaced with a tiny inline info icon.
The large bottom-sheet/modal is replaced with a small contextual popover that
opens next to the icon and closes on outside tap, Escape, resize, or scroll.

Design goals
------------
- tiny icon aligned to the text line
- compact popover
- minimal surface matching the MEMEFLOW style
- works in both light and dark theme
- no full-screen overlay
- P&L sign colors stay explicit:
  positive = green
  negative = red

No trading-logic changes
------------------------
V85 does NOT change:
- live remaining value calculation
- total P&L calculation
- mark continuity / fallback behavior
- entry / exit rules
- close logic
- RPC / poll cadence

Install
-------
  unzip -o memeflow-open-position-popover-v85.zip
  bash memeflow-open-position-popover-v85/install.sh

Rollback
--------
  bash memeflow-open-position-popover-v85/rollback.sh
