MEMEFLOW OPEN POSITION CANDIDATE ALIGN V92
============================================

What was actually wrong
-----------------------
The screenshot after V91 showed the token names clipped at the TOP of each
Open Position row.

The important difference versus Candidates is structural:

Candidates:
- .candidate-main is AUTO HEIGHT
- display:grid
- the whole two-line stack is centered in the row
- mobile late layer uses gap:4px

V91:
- .position-main height:100%
- align-self:stretch
- overflow:hidden
- vertical flex stack

That full-height stretched model is unnecessary and on mobile Safari it can
produce the exact clipping seen in the screenshot.

There was also an older V67 rule:
  .position-bottomline { display:block !important; }

V92 explicitly neutralizes that too.

V92
---
- removes V91 from trading.html
- keeps V89 64px rows unchanged
- makes .position-main use the SAME auto-height grid model as Candidate
- centers the complete two-line text stack
- uses 4px mobile gap like Candidate V74
- keeps telemetry inline with flex/nowrap

No changes to:
- Candidates
- Recent trades
- row height
- avatar
- typography sizes
- colors
- P&L
- CLOSE
- info popover
- trading/backend/RPC logic

Install
-------
  unzip -o memeflow-open-position-candidate-align-v92.zip
  bash memeflow-open-position-candidate-align-v92/install.sh

Rollback
--------
  bash memeflow-open-position-candidate-align-v92/rollback.sh
