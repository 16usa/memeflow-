MEMEFLOW CHART HEADER GEOMETRY V95.1
====================================

Why V95 failed
--------------
The V95 geometry test itself passed. The installer then re-ran the older
V94 regression test.

V94's test hard-coded this exact cache-bust URL:

  /trading.css?v=token-avatar-36-v94-20260909

V95 correctly changed the trading.css URL to a new cache-bust, so the old V94
test failed even though the real V94 contract (36x36 token avatars) was still
correct.

Because install.sh uses `set -e`, V95 stopped before commit/push.

V95.1 repair
------------
- works from clean V94 OR the half-installed V95 state;
- does not re-run the stale V94 cache-string assertion;
- independently verifies the actual V94 contract: 36x36 avatar;
- removes half-installed V95 asset/test;
- installs one V95.1 header authority;
- if a partial V95 is detected, rollback points to the original pre-V95 backup.

Scope
-----
ONLY selected-token summary/header above the chart:
- avatar
- token name/status
- mint/Copy
- right-side price/meta

THE CHART ITSELF IS NOT TOUCHED.

Geometry
--------
- avatar 36x36
- header 64px
- left/right padding 9px
- top/bottom free space 14px
- avatar column 46px
- column gap 7px
- avatar edge -> text 17px
- price block centered/right aligned in same row

Install
-------
  unzip -o memeflow-chart-header-geometry-v95-1.zip
  bash memeflow-chart-header-geometry-v95-1/install.sh

Rollback
--------
  bash memeflow-chart-header-geometry-v95-1/rollback.sh
