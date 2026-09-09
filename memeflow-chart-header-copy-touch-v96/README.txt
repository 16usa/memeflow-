MEMEFLOW CHART HEADER COPY TOUCH V96
===================================

Confirmed root cause:
On iPhone/coarse pointers, the global accessibility stylesheet gives native
buttons min-block-size: 44px. The chart-header Copy control is a native button,
so its invisible 44px layout box prevented the 64px header from becoming truly
compact even though the avatar was already 36x36.

V96 updates the EXISTING single chart-header authority:
  chart-header-geometry-v95-1.css

It does not add a competing stylesheet.

Only #copyMintBtn changes:
  min-block-size: 0
  min-height: 0
  height: auto

A 44x44 absolutely positioned pseudo-element preserves the touch target
without participating in layout.

Unchanged:
- avatar 36x36
- header 64px
- left/right 9px
- top/bottom around avatar 14px
- avatar-to-text 17px
- price block
- Pump.fun badge
- global accessibility stylesheet
- chart/canvas/candles/timeframes/legend/indicators
- trading/backend/RPC logic

Install:
  unzip -o memeflow-chart-header-copy-touch-v96.zip
  bash memeflow-chart-header-copy-touch-v96/install.sh

Rollback:
  bash memeflow-chart-header-copy-touch-v96/rollback.sh
