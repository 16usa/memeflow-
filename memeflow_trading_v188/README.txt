MEMEFLOW TRADING TERMINAL COMPACT V188

Purpose
- Make the mobile Trading Terminal materially more compact while preserving readability.
- Use ONLY the installed Memflow V186 typography roles, weights and neutral text tiers.
- Keep V187 as the required base and override only typography hierarchy.

What becomes smaller
- Brand title: SUBHEAD -> UI
- Selected token name: SECTION -> SUBHEAD
- Selected price: PAGE -> SECTION
- Chart controls: UI -> META
- Chart legend: META -> MICRO
- Metric labels/values: META/BODY -> MICRO/META
- Module titles: SUBHEAD -> UI
- Strategy labels/values: META/BODY -> MICRO/UI
- Position / candidate / log names: UI -> META
- Secondary row info: META -> MICRO

Untouched
- spacing / margins / padding / gaps
- borders / radii / backgrounds
- chart geometry and rendering
- semantic green/red/blue state colors
- JavaScript / scanner / trading / backend
- all other pages

Install from the existing Replit workspace
  unzip -o Memflow-Trading-Terminal-Compact-V188.zip && bash memeflow_trading_v188/install.sh

Rollback to exact V187 state
  bash memeflow_trading_v188/rollback.sh

No server restart is performed by this patch.
