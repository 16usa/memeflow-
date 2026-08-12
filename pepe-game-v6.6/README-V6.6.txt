MEMEFLOW PEPE ROCKET — V6.6 STABILITY + FLIGHT POSITION
========================================================

WORKFLOW USED
-------------
1. Audit V6.5 for runtime / visual errors.
2. Fix all discovered issues.
3. Re-run syntax, DOM, CSS and runtime tests.
4. Only after PASS, add visual improvements.
5. Re-run install / repeat-install / rollback tests.
6. Verify trading/server files stayed byte-identical.

HARD PROJECT RULE
-----------------
Trading logic is NOT modified.

This package does NOT contain:
- game-engine.mjs
- app-server.mjs
- evaluate.mjs
- liveeval.mjs
- settings files
- BUY logic
- SELL logic
- selector/trading-engine files

It changes ONLY:
- memeflow-app/game.html
- memeflow-app/game.css
- memeflow-app/game.js

REQUIRED STARTING POINT
-----------------------
Pepe Rocket V6.5.

INSTALL
-------
Upload pepe-game-v6.6-stability-flight-position.zip into /home/runner/workspace.

Then:

cd /home/runner/workspace
unzip -o pepe-game-v6.6-stability-flight-position.zip
node ./pepe-game-v6.6/update-pepe-game-v66.mjs
node ./pepe-game-v6.6/verify-pepe-game-v66.mjs

Expected:
PEPE GAME V6.6 VERIFY: PASS (57 checks)

Then restart MEMEFLOW normally:

cd /home/runner/workspace/memeflow-app
npm start

Open:
/game

BUGS FIXED BEFORE VISUAL WORK
-----------------------------
1. MILESTONE BURST STORM
   A large multiplier jump could cross several thresholds in one server update and fire
   several sounds / haptics / shockwaves immediately. V6.6 marks every crossed level as
   reached but only presents the highest newly crossed milestone.

2. BACKGROUND SSE
   visibilitychange to hidden now closes the Game EventSource immediately instead of
   waiting for pagehide. This reduces background network / battery usage on iPhone.

3. BACKGROUND SEARCH WAKE
   The paused search no longer wakes itself every 30 seconds while hidden. It now waits
   only for visibility / online events or explicit cancellation.

4. TRACE CAP LOST FIRST OBSERVED POINT
   Long rounds previously kept only the newest 100 trace samples, eventually losing the
   first observed point. V6.6 keeps the first observed point plus the latest samples.

5. V6.6 DEVELOPMENT REGRESSION CAUGHT BEFORE RELEASE
   During development, the new Flight Position HUD initially referenced peak outside its
   local scope. Runtime-smoke caught the ReferenceError before packaging. The final build
   has peak defined in renderVisual scope and passes runtime tests.

VISUAL IMPROVEMENTS ADDED AFTER FIXES
-------------------------------------
- new Flight Position HUD in the live scene:
  ENTRY 1.00x / CURRENT / PEAK;
- values are presentation only and read the already provided session / multiplier state;
- HUD changes visual tone for BOOST and DANGER;
- new rocket ghost rings tied only to already displayed visual velocity / multiplier;
- ghost trail fades completely in reduced-motion mode;
- mobile / small-phone / landscape layouts included;
- all existing V6.5 navigation, Flight Director, altimeter, parallax and result visuals remain.

VALIDATION
----------
- V6.5 -> V6.6 install: PASS
- repeated V6.6 updater: PASS / no rewrite
- byte-exact rollback to V6.5: PASS
- game.js syntax: PASS
- runtime smoke: PASS
- HTML IDs unique: PASS
- every JavaScript DOM id resolves: PASS
- CSS braces balanced: PASS
- exact duplicate selector audit: 0
- CSS parse errors: 0
- Game engine packaged: NO
- app-server packaged: NO
- index.html packaged: NO
- game-engine byte-identical through update / rollback: PASS
- app-server byte-identical through update / rollback: PASS
- index.html byte-identical through update / rollback: PASS
- verifier: 57 checks PASS

ROLLBACK
--------
cd /home/runner/workspace
node ./pepe-game-v6.6/rollback-pepe-game-v66.mjs

Rollback restores only game.html / game.css / game.js to V6.5.
