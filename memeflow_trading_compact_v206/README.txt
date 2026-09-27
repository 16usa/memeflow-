MEMEFLOW TRADING TERMINAL COMPACT V206

Goal:
Maximum mobile density while keeping every Trading Terminal function and all
currently displayed information.

What changes:
- header + runtime strip height
- chart header/timeframes/chart/indicator/metrics density
- Pending approvals density
- Trade strategy row density
- Open positions row density
- Candidate filters + rows
- Recent trades rows
- panel spacing/radius on mobile

What does NOT change:
- trading.js
- scanner / candidate feed
- ranking / state logic
- P&L calculations
- chart data / indicators / ECharts behavior
- buy/sell/close logic
- APIs
- global typography family
- semantic colors

Typography:
Uses only 8 / 9 / 10 / 11 / 13 / 15px.
The existing global Inter owner stays untouched.

Safety:
1) build shadow from CURRENT trading.html
2) apply V206 to shadow
3) audit shadow
4) only after PASS touch real files
5) exact backup
6) audit real files
7) git diff --check
8) auto restore on failure
9) no restart
10) no automatic push

Install:
  unzip -o Memflow-Trading-Terminal-Compact-V206.zip
  bash memeflow_trading_compact_v206/install.sh

Rollback:
  bash memeflow_trading_compact_v206/rollback.sh
