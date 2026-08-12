MEMEFLOW PEPE ROCKET — V5.6 TARGET ACQUISITION IN-PLACE UPDATE
==============================================================

NO NEW LAYERS
-------------
V5.6 updates only the existing:
- game.html
- game.css
- game.js

It does NOT modify:
- src/game-engine.mjs
- app-server.mjs
- index.html
- game-assets/pepe-rocket.svg
- MEMEFLOW trading filters or server settlement logic

No second stylesheet and no second Game JavaScript file are added.

REQUIRED STARTING POINT
-----------------------
Pepe Rocket V5.5.

INSTALL
-------
Upload pepe-game-v5.6-target-acquisition-inplace.zip into /home/runner/workspace.

Then:

cd /home/runner/workspace
unzip -o pepe-game-v5.6-target-acquisition-inplace.zip
node ./update-pepe-game-v56.mjs
node ./verify-pepe-game-v56.mjs

Expected:

PEPE GAME V5.6 VERIFY: PASS (58 checks)

Then restart MEMEFLOW:

cd /home/runner/workspace/memeflow-app
npm start

Open:
/game

ROLLBACK
--------
cd /home/runner/workspace
node ./rollback-pepe-game-v56.mjs

Restart MEMEFLOW after rollback.

V5.6 IMPROVEMENTS
-----------------
- upgraded selector radar inside the existing Launch Control;
- animated decision / price / holders / coherence scan phases;
- target-reticle animation while the server searches;
- target lock changes the radar to a confirmed green lock;
- selected launch quality is surfaced before the launch sequence;
- selector diagnostics remain tied to real server responses;
- no fake "passed" state is shown before the server actually selects a launch;
- rocket banking is now smoothed instead of snapping directly to price velocity;
- banking also reacts to server-derived acceleration;
- sharp positive-to-negative momentum reversal has a distinct visual bank;
- reversal haptic/sound is rate-limited;
- all V5.5 launch, warp, result, V5.4 Flight Telemetry, V5.3 mobile focus mode,
  stale-price protection, Auto Cash Out, Stop Loss and server authority remain.

VALIDATION
----------
- V5.5 -> V5.6 update: PASS
- repeated/idempotent V5.6 updater: PASS
- byte-exact rollback to V5.5: PASS
- game.js syntax: PASS
- game-engine.mjs syntax: PASS
- app-server.mjs syntax: PASS
- CSS brace balance: PASS
- unique HTML IDs: PASS
- every game.js DOM reference resolves: PASS
- engine unchanged through update: PASS
- app-server unchanged through update: PASS
- live V5.4 Game Engine compatibility tests: PASS
- verifier: 58 checks PASS

IMPORTANT
---------
PAPER ONLY. This update does not submit real BUY or SELL orders.
