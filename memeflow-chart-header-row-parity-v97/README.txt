MEMEFLOW CHART HEADER ROW PARITY V97
===================================

Confirmed causes
----------------
1. Left and right sides were separate auto-sized two-row grids.
   The title/badge row and price row therefore used different line boxes.
   The mint/Copy row and PRICE/MC/BP row did the same.

2. priceModeBtn is a native button, so on iPhone the global accessibility
   layer gives it min-block-size:44px. V96 fixed Copy, but not priceModeBtn.

3. Switching to market-cap mode replaces the secondary string with a much
   longer value:
     MARKET CAP · PRICE ... · BP ...
   The fixed 128px price column existed, but its child text had white-space:
   nowrap and no overflow clipping/ellipsis, so the text painted outside the
   column and looked like the field itself was stretching off-screen.

4. Pump.fun is NOT the cause. Its badge is absolute. V97 locks the header
   instance to the exact same V76 geometry used in Open positions, Candidates
   and Recent trades:
     16x16, right:-4, bottom:-4.

V97 architecture
----------------
One clean chart-header stylesheet owner replaces V95.1/V96:

  chart-header-geometry-v97.css

Shared row tracks on BOTH sides:
  primary     20px
  secondary   14px
  gap          4px
  stack       38px

Header:
  64px high
  9px horizontal padding
  36x36 avatar
  46px avatar column
  7px grid gap
  17px avatar-edge -> text

Price block:
  fixed 128px
  min-width:0
  no visual overflow
  long values ellipsize
  44px invisible touch target retained without changing layout

Copy:
  compact 14px visual row
  44x44 invisible touch target retained

Cleanup:
- old chart-header-geometry-v95-1.css removed
- stale V95.1/V96 chart-header tests removed
- only V97 is loaded

THE CHART ITSELF IS NOT TOUCHED.

Install
-------
  unzip -o memeflow-chart-header-row-parity-v97.zip
  bash memeflow-chart-header-row-parity-v97/install.sh

Rollback
--------
  bash memeflow-chart-header-row-parity-v97/rollback.sh
