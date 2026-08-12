MEMEFLOW PEPE ROCKET — V6.5 STABILITY + FLIGHT NAVIGATION
==========================================================

PROCESS USED
------------
1. Audit V6.4 for client/runtime errors.
2. Fix the errors.
3. Re-run runtime, syntax, DOM and CSS checks.
4. Only after PASS, add visual improvements.
5. Verify protected MEMEFLOW trading/server files remain byte-identical.

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
Pepe Rocket V6.4.

INSTALL
-------
cd /home/runner/workspace
unzip -o pepe-game-v6.5-stability-flight-navigation.zip
node ./pepe-game-v6.5/update-pepe-game-v65.mjs
node ./pepe-game-v6.5/verify-pepe-game-v65.mjs

Then restart MEMEFLOW normally.

BUGS FIXED BEFORE VISUAL WORK
-----------------------------
- Wake Lock request race: concurrent lifecycle callbacks can no longer create multiple in-flight screen locks.
- Late Wake Lock resolution: if the page becomes hidden/idle before a lock resolves, that late lock is immediately released.
- Hidden resync reconnect: a status request that finishes after pagehide can no longer reopen EventSource in the background.
- Hidden/offline stream guard: EventSource creation is lifecycle-gated.
- Observed flight path time ordering: older latestPriceAt samples are ignored instead of drawing a backward time jump.
- Same-timestamp price updates replace the current trace sample instead of appending a duplicate time point.
- Search background battery usage: hidden/offline search now waits on visibility/online events instead of waking every 500 ms.
- Result focus timer is now tracked and cancelled across reset/unload.
- iPhone viewport height follows visualViewport and is cleaned up on unload.

VISUAL IMPROVEMENTS AFTER FIXES
-------------------------------
- live flight progress: PAD -> SKY -> ATMOS -> ORBIT -> MOON -> DEEP -> HYPER;
- current stage and highest reached stage are visually distinct;
- orbit satellite in ORBIT/MOON;
- meteor streaks in DEEP/HYPER;
- subtle boost/hyperspace lens flare;
- improved dynamic full-screen height on iPhone/Safari;
- existing Flight Director, altimeter, stage transitions and result path remain.

ROLLBACK
--------
cd /home/runner/workspace
node ./pepe-game-v6.5/rollback-pepe-game-v65.mjs

Rollback restores only game.html/game.css/game.js to V6.4. Trading/server files are never written.
