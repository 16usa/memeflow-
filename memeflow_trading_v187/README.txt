MEMEFLOW TRADING TERMINAL POLISH V187
====================================

Purpose
-------
A typography/neutral-hierarchy polish for Trading Terminal only.
It uses ONLY the already-installed MEMEFLOW V186 role system.

No new typography values are introduced.
No new neutral colors are introduced.
No semantic/accent colors are replaced.
No spacing, geometry, borders, radii, backgrounds, chart rendering,
JavaScript, trading logic or backend code is changed.

Dense terminal mapping
----------------------
Brand / selected instrument:
- brand title: SUBHEAD / 15 / 700 / T1
- token name: SECTION / 17 / 700 / T1
- live price: PAGE / 24 / 800 / T1
- token metadata: META / 12 / 500 / T3

Operational panel header:
- system eyebrow: MICRO / 11 / 600 / T4
- panel title: SUBHEAD / 15 / 700 / T1

Data hierarchy:
- controls / names / semantic P&L: UI / 13 / 600
- strategy values / selected values: BODY / 14 / 600
- labels / evidence / timestamps / prices: META / 12 / 500
- state/action badges: MICRO / 11 / 600

Install from the EXISTING Replit workspace
-------------------------------------------
unzip -o Memflow-Trading-Terminal-Polish-V187.zip && bash memeflow_trading_v187/install.sh

No restart is performed by the patch. Restart manually from Replit Console/Run.

Rollback
--------
bash memeflow_trading_v187/rollback.sh

Audit
-----
bash memeflow_trading_v187/audit.sh

Git push after visual approval
------------------------------
git add memeflow-app/memeflow-x-canonical-v186.css memeflow-app/trading.html
git commit -m "style: polish Trading Terminal hierarchy V187"
git push
