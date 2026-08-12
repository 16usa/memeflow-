MEMEFLOW PEPE ROCKET — V6.8 ROUND RESET + SETTLEMENT DISPLAY
============================================================

WORKFLOW
--------
1. Audited V6.7 first.
2. Fixed runtime/display bugs.
3. Re-ran runtime + static checks.
4. Added only visual/UX polish after PASS.
5. Verified trading/server files are byte-identical.

HARD RULE
---------
This package does NOT modify trading logic.
It contains ONLY these live payload files:
- game.html
- game.css
- game.js

It does NOT package or write:
- game-engine.mjs
- app-server.mjs
- index.html
- evaluate.mjs / liveeval.mjs
- settings
- BUY/SELL logic
- selector/trading engine

REQUIRED STARTING POINT
-----------------------
Pepe Rocket V6.7.

INSTALL
-------
cd /home/runner/workspace
unzip -o pepe-game-v6.8-round-reset.zip
node ./pepe-game-v6.8/update-pepe-game-v68.mjs
node ./pepe-game-v6.8/verify-pepe-game-v68.mjs

Expected:
PEPE GAME V6.8 VERIFY: PASS (54 checks)

Then restart MEMEFLOW:
cd /home/runner/workspace/memeflow-app
npm start

BUGS FIXED
----------
1. STALE MULTIPLIER AFTER ROUND
   The exact screenshot failure is fixed. When there is no active session or a new
   SEARCHING round starts, the entire round presentation resets to 1.00x.

2. STALE PEAK / THRUST / STAGE
   Peak resets to 1.00x, drawdown to 0.0%, thrust to 0%, stage to LAUNCHPAD,
   Flight Position to 1.00x and the rocket/altimeter return to entry state.

3. STALE LIVE CASHOUT TELEMETRY WHILE WAITING
   Peak capture no longer displays 100% when no launch is live. It displays —.
   AUTO DIST / STOP DIST also remain — until a real LIVE session exists.

4. REDUCED-MOTION FIRST-LIVE THRUST
   Initial live rendering now derives active thrust from the server session state,
   not from whether the UI mode switch has already executed on that line.

5. PLAY-AGAIN ONE-FRAME PEAK LEAK
   The finished session is cleared before the new 1.00x visual state is rendered.

6. POST-ROUND BALANCE / STATS DISPLAY LAG
   After a result screen appears, the client performs one read-only /api/game/status
   refresh for balance/history/stats. It does NOT modify the session or trading state.

VISUAL POLISH
-------------
- Virtual balance briefly highlights when the server-reported amount actually changes.
- Starting a new scan gives the 1.00x multiplier a short reset pulse.
- Reduced-motion disables these animations.

VALIDATION
----------
- Exact LIVE 1.52x -> COMPLETE -> PLAY AGAIN -> SCANNING regression: PASS
- Post-round balance read-only refresh: PASS
- V6.7 -> V6.8 install: PASS
- repeated/idempotent update: PASS
- byte-exact rollback to V6.7: PASS
- game.js syntax: PASS
- runtime smoke: PASS
- HTML ids / JS references: PASS
- CSS parser: 0 errors
- exact duplicate CSS selectors: 0
- game-engine unchanged: PASS
- app-server unchanged: PASS
- index.html unchanged: PASS
- BUY/SELL/settings endpoints added: NONE

ROLLBACK
--------
cd /home/runner/workspace
node ./pepe-game-v6.8/rollback-pepe-game-v68.mjs
