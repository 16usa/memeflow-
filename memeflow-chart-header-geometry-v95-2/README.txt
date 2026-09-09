MEMEFLOW CHART HEADER GEOMETRY V95.2
====================================

Purpose
-------
This is a FINALIZER for the exact state shown after V95.1 stopped at:

  [4/4] Diff guard + Git checkpoint
  trading-visual-hierarchy-v67.css:1824: new blank line at EOF.

What happened
-------------
V95.1's functional and scope tests all passed:

  chart-header-geometry-v95-1: ok
  open-position-icon-geometry-v93: ok
  row-height-canonical-v89: ok

The only failure was Git's whitespace guard. Removing historical V129/V130
left one extra blank line at the end of trading-visual-hierarchy-v67.css.

Because install.sh uses `set -e`, commit/push never happened.

What V95.2 does
---------------
- verifies the half-installed V95.1 files are present;
- refuses to touch the repo if unrelated working-tree changes exist;
- backs up the current state;
- normalizes ONLY the EOF of trading-visual-hierarchy-v67.css;
- reruns V95.1 + V93 + V89 tests;
- reruns git diff --check;
- re-verifies that V95.1 contains NO chart/canvas/timeframe/legend selectors;
- stages only the five V95.1 files;
- commits and pushes.

No new visual rule is introduced by V95.2.

The selected-token header remains:
  avatar         36x36
  header         64px
  left/right     9px
  top/bottom     14px
  avatar -> text 17px

THE CHART ITSELF IS NOT TOUCHED.

Install
-------
  unzip -o memeflow-chart-header-geometry-v95-2.zip
  bash memeflow-chart-header-geometry-v95-2/install.sh

Rollback only this finalizer
----------------------------
  bash memeflow-chart-header-geometry-v95-2/rollback.sh

Full rollback to pre-V95
------------------------
  bash memeflow-chart-header-geometry-v95-1/rollback.sh
