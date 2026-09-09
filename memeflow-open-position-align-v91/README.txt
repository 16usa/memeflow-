MEMEFLOW OPEN POSITION ALIGN V91
================================

Diagnosis
---------
There IS a real CSS conflict.

trading-visual-hierarchy-v67.css has this mobile rule:

  .position-bottomline {
    display: block !important;
  }

V90 never overrode display, so the Open Position telemetry line continued to
obey that old mobile layout rule. The old Open Position layout chain also left
room for the two internal rows to look vertically distributed instead of
behaving like the compact Candidate / Recent Trade stacks.

V91 fix
-------
V91 becomes the ONE final Open Position vertical-layout owner:

  .position-main
    display:flex
    flex-direction:column
    justify-content:center
    height:100%
    gap:4px

  .position-topline
    flex row

  .position-bottomline
    display:flex !important
    nowrap

This makes:
  token name
  live value · total P&L · info

behave as one centered two-line stack.

V90 is removed from trading.html, so there are not two alignment layers
competing with each other.

V89 stays untouched and still owns the canonical 64px row height.

Unchanged
---------
- Candidates
- Recent trades
- 64px row contract
- avatar sizes
- typography scale
- colors / themes
- P&L
- CLOSE
- info popover
- trading logic / backend / RPC

Install
-------
  unzip -o memeflow-open-position-align-v91.zip
  bash memeflow-open-position-align-v91/install.sh

Rollback
--------
  bash memeflow-open-position-align-v91/rollback.sh
