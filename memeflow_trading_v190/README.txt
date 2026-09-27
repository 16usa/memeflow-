MEMEFLOW TRADING TERMINAL DENSITY & GEOMETRY V190
==================================================

Purpose
-------
Bring the installed V189 Trading Terminal closer to the approved professional
software mockup without changing the Memflow typography/color system.

V190 changes geometry only
--------------------------
- 8px mobile workspace rhythm
- consistent 12px module radii
- compact 44px module header/toolbars
- compact selected-token header
- 40px timeframe and candidate-filter strips
- 36px indicator strip
- 52px quick-metric band
- denser 44px strategy rows
- 56px execution list rows
- 36px list token avatars
- 22px compact status/action badge geometry
- safer ellipsis/no-wrap behavior for dynamic values
- Open Positions / Candidates / Recent trades share one row system

Untouched
---------
- V186/V187/V188/V189 typography
- T1/T2/T3/T4 neutral text colors
- semantic BUY/SELL/P&L/LIVE/WAITING/CLOSE colors
- chart data/rendering behavior
- JavaScript
- API/backend
- scanner/trading logic
- desktop above 820px

Install from the EXISTING Replit workspace
------------------------------------------
unzip -o Memflow-Trading-Terminal-Density-Geometry-V190.zip && bash memeflow_trading_v190/install.sh

No restart is performed. Restart manually from Replit Console/Run.

Rollback to exact V189 state
----------------------------
bash memeflow_trading_v190/rollback.sh

Audit
-----
bash memeflow_trading_v190/audit.sh

Git push after visual approval
------------------------------
git add memeflow-app/memeflow-x-canonical-v186.css memeflow-app/trading.html
git commit -m "style: compact Trading Terminal geometry V190"
git push
