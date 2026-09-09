MEMEFLOW OPEN POSITION SURFACE V86
==================================

Purpose
-------
Align the compact V85 info popover with MEMEFLOW's existing theme surface
hierarchy without changing its geometry or behavior.

LIGHT
-----
Uses the existing second light application surface:
  --mf-app-surface-2 / #f7f9fb

DARK
----
Uses the approved second/neutral dark inset surface:
  --mf-x-dark-inset / #101113

Also aligns the popover border/arrow to the corresponding theme line token.

Not changed
-----------
- info icon size or shape
- popover width, spacing, radius or positioning
- text hierarchy
- P&L green/red colors
- live value / P&L calculations
- trading logic
- polling / RPC / WebSocket behavior

Install
-------
  unzip -o memeflow-open-position-surface-v86.zip
  bash memeflow-open-position-surface-v86/install.sh

Rollback
--------
  bash memeflow-open-position-surface-v86/rollback.sh
