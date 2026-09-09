MEMEFLOW CHART HEADER GEOMETRY V95
==================================

Scope
-----
ONLY the selected-token summary/header above the chart:

- token avatar
- token name + status
- mint + Copy
- right-side price + PRICE/MC/BP meta

THE CHART ITSELF IS NOT TOUCHED.
No chart-wrap, canvas, timeframes, legend, indicators, candle logic,
chart JS, or chart data is modified.

Canonical geometry
------------------
Matches the three operational modules after V94/V89:

- avatar: 36x36
- header row: 64px
- left/right padding: 9px
- top/bottom visual free space around avatar: 14px
- avatar grid column: 46px
- column gap: 7px
- resulting avatar edge -> text: 17px

Right price block
-----------------
Stays in the same header row, centered vertically, right aligned,
and respects the same 9px outer edge.

Conflict cleanup
----------------
V95 does not merely stack another random rule.

Installer:
1. removes old base chart-header 73px/flex geometry;
2. removes old chart-specific avatar sizes 48 / 40 / 33 / 31;
3. removes old compact chart-head 62 / 54 size overrides;
4. removes marked V129 and V130 chart-header layout experiments;
5. loads ONE final isolated V95 authority last.

Backup / tests / diff guard / commit / push / rollback are included.

Install
-------
  unzip -o memeflow-chart-header-geometry-v95.zip
  bash memeflow-chart-header-geometry-v95/install.sh

Rollback
--------
  bash memeflow-chart-header-geometry-v95/rollback.sh
