MEMEFLOW OPEN POSITION COPY ALIGN V90
=====================================

Problem
-------
After V89 all operational rows are exactly 64px, but Open Positions still
looked vertically wrong: the token name sat too high above the live-value/P&L
line.

Cause
-----
The Open Positions copy stack still inherited older independent layout rules.
Candidates already has a late compact rule that centers its two-line
.candidate-main stack with a 4px gap. Open Positions did not have an equally
strong final internal-stack authority.

Fix
---
V90 keeps V89 completely intact and changes only .position-main composition:

  token name
  4px gap
  live value · total P&L · info

The two rows are shrink-wrapped as max-content and the WHOLE stack is centered
inside the existing 64px row.

Unchanged
---------
- V89 64px row height
- Candidates
- Recent trades
- avatars
- font sizes
- colors
- P&L calculation
- Close button
- info popover
- light/dark theme
- trading logic / backend / RPC

Install
-------
  unzip -o memeflow-open-position-copy-align-v90.zip
  bash memeflow-open-position-copy-align-v90/install.sh

Rollback
--------
  bash memeflow-open-position-copy-align-v90/rollback.sh
