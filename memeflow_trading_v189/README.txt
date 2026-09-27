MEMEFLOW TRADING TERMINAL TECHNICAL HIERARCHY V189
===================================================

Purpose
-------
Final compact mobile hierarchy for Trading Terminal on top of V188.
It follows ONLY the installed MEMEFLOW V186 typography/color system.

Core visual rule
----------------
- T1: decisive information only
- T2: working values/data
- T3: secondary controls/data
- T4: technical/system metadata

Mobile mapping (<= 820px)
-------------------------
- APE TRADING: META 12 / 700 / T1
- TRADING TERMINAL: MICRO 11 / 600 / T4
- selected token: UI 13 / 600 / T1
- selected price: SUBHEAD 15 / 700 / T1
- module title: UI 13 / 600 / T1
- module eyebrow: MICRO 11 / 600 / T4
- strategy labels: MICRO 11 / 500 / T4
- strategy values: META 12 / 600 / T1
- token names in lists: META 12 / 600 / T1
- evidence / timestamps / technical lines: MICRO 11 / 500 / T4
- candidate price / working numeric data: META 12 / 500 / T2
- inactive chart controls: META 12 / 600 / T3

Semantic colors
---------------
OPEN POSITION / LIVE / WAITING / WATCH / BUY / SELL / P&L / CLOSE etc.
keep their existing semantic/accent colors. V189 does not recolor them.

Safety
------
No spacing, geometry, borders, radii, backgrounds, chart rendering,
JavaScript, trading logic or backend code is changed.
Desktop/tablet above 820px stays on V188.

Install from the EXISTING Replit workspace
-------------------------------------------
unzip -o Memflow-Trading-Terminal-Technical-Hierarchy-V189.zip && bash memeflow_trading_v189/install.sh

No restart is performed. Restart manually from Replit Console/Run.

Rollback to exact V188 state
----------------------------
bash memeflow_trading_v189/rollback.sh

Audit
-----
bash memeflow_trading_v189/audit.sh

Git push after visual approval
------------------------------
git add memeflow-app/memeflow-x-canonical-v186.css memeflow-app/trading.html
git commit -m "style: refine Trading Terminal technical hierarchy V189"
git push
