MEMEFLOW PEPE ROCKET — V6.1 STABILITY + FLIGHT POLISH
=====================================================

WORKFLOW USED
-------------
1. Audit V6.0 for errors.
2. Fix the errors.
3. Re-run syntax / DOM / CSS / runtime checks.
4. Only after PASS, add visual improvements.
5. Verify protected MEMEFLOW trading/server files remained byte-identical.

HARD PROJECT RULE
-----------------
This package does NOT modify trading logic.

The ZIP does NOT contain:
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
Pepe Rocket V6.0 Visual + Runtime Clean.

INSTALL
-------
Upload pepe-game-v6.1-stability-flight-polish.zip into /home/runner/workspace.

Then:

cd /home/runner/workspace
unzip -o pepe-game-v6.1-stability-flight-polish.zip
node ./update-pepe-game-v61.mjs
node ./verify-pepe-game-v61.mjs

Expected:

PEPE GAME V6.1 VERIFY: PASS (47 checks)

Then restart MEMEFLOW normally:

cd /home/runner/workspace/memeflow-app
npm start

Open:
/game

BUGS FIXED BEFORE VISUAL WORK
-----------------------------
1. NEW-ROUND MOTION LEAK
   A new round could briefly inherit velocity, acceleration, danger/bank state,
   camera energy and visual motion from the previous round.
   V6.1 resets all visual motion state when the session id changes.

2. OLD BANK TIMER RACE
   A reversal timer from the previous round could fire during a later round and
   reset the new rocket bank state. V6.1 centrally clears visual timers.

3. CASH/SECURED PULSE RESIDUE
   A fast PLAY AGAIN could retain the prior secured/cash visual pulse briefly.
   V6.1 clears and resets the relevant timers/states before a new round.

4. AUTO / STOP LINE DISPLAY SOURCE
   During a live round, trigger lines now display the Auto Cash Out / Stop Loss
   values locked into the current server session instead of reading the editable
   pre-flight selects. This is DISPLAY ONLY and does not alter those triggers.

5. IDLE BATTERY / CPU LOAD
   The main visual requestAnimationFrame loop no longer spins continuously while
   the Game is stable/idle. It sleeps until live motion actually needs rendering.
   The canvas star FX loop is also capped to roughly 30 fps.

6. REDUCED MOTION LIVE UPDATE
   prefers-reduced-motion is no longer read only once at boot. A system setting
   change while the page is open is handled live and expensive FX are paused.

7. MOBILE CSS DUPLICATES
   V6.0 still contained 3 exact duplicate selectors inside identical mobile media
   contexts. They are consolidated. Recursive duplicate-selector audit = 0.

VISUAL IMPROVEMENTS ADDED AFTER FIXES
-------------------------------------
- FLIGHT LEVEL transition pill between altitude/stage changes;
- stage transitions use real displayed multiplier only;
- rocket body glint during BOOST;
- two expanding engine exhaust rings;
- richer engine-speed impression without a new asset;
- result-screen route:
  LAUNCH -> SKY -> ATMOS -> ORBIT -> MOON -> DEEP -> HYPER;
- the result route highlights the highest stage actually reached by the observed peak;
- dedicated mobile landscape flight layout;
- result card adapts to short landscape screens;
- existing V6.0 flight-state system, parallax, plasma, aurora, orbit grid,
  crash/secured states and reduced-motion fallbacks remain.

VALIDATION COMPLETED
--------------------
- game.js Node syntax: PASS
- updater/verifier/rollback syntax: PASS
- HTML parse: PASS
- unique HTML IDs: PASS
- every JavaScript DOM id resolves: PASS
- CSS tinycss2 parse errors: 0
- recursive exact duplicate selectors in same CSS context: 0
- runtime smoke with stub DOM/API: PASS
- clean V6.0 -> V6.1 update: PASS
- second/idempotent V6.1 update: PASS (no rewrite)
- byte-exact rollback to V6.0: PASS
- game-engine byte-identical through update/rollback: PASS
- app-server byte-identical through update/rollback: PASS
- index.html byte-identical through update/rollback: PASS
- no settings mutation endpoint in Game client: PASS
- no Game BUY endpoint: PASS
- no Game SELL endpoint: PASS
- no old Game entry freshness/ranking filters: PASS

ROLLBACK
--------
cd /home/runner/workspace
node ./rollback-pepe-game-v61.mjs

Rollback restores ONLY game.html / game.css / game.js to the V6.0 files that existed
before the update. Trading/server files are never written.
