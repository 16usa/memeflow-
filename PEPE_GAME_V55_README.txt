MEMEFLOW PEPE ROCKET — V5.5 CINEMATIC FLIGHT IN-PLACE UPDATE
============================================================

THIS IS NOT A NEW LAYER
-----------------------
V5.5 updates only the existing:
- game.html
- game.css
- game.js

It does NOT modify:
- src/game-engine.mjs
- app-server.mjs
- index.html
- the existing Pepe rocket SVG
- MEMEFLOW filters or trading logic

No second CSS file and no second JavaScript layer are added.

REQUIRED STARTING POINT
-----------------------
Pepe Rocket V5.4.

INSTALL
-------
Upload pepe-game-v5.5-cinematic-flight-inplace.zip into /home/runner/workspace.

Then run:

cd /home/runner/workspace
unzip -o pepe-game-v5.5-cinematic-flight-inplace.zip
node ./update-pepe-game-v55.mjs
node ./verify-pepe-game-v55.mjs

Expected final line:

PEPE GAME V5.5 VERIFY: PASS (57 checks)

Then restart MEMEFLOW:

cd /home/runner/workspace/memeflow-app
npm start

Open:

/game

ROLLBACK
--------
cd /home/runner/workspace
node ./rollback-pepe-game-v55.mjs

Restart MEMEFLOW after rollback.

V5.5 IMPROVEMENTS
-----------------
- cinematic pre-launch sequence:
  TARGET VERIFIED -> ENTRY LOCKED -> IGNITION -> 3 / 2 / 1 -> LAUNCH;
- sequence remains cancellable if the server round finishes or changes state;
- stronger 2x / 5x / 10x milestone effects;
- shockwave effect at major milestones;
- deep-space warp tunnel and comet motion generated inside the existing CSS;
- stronger visual progression into DEEP SPACE and HYPERSPACE;
- emergency descent animation before a STOP LOSS / losing result;
- secured-position animation before a profitable result;
- result badges distinguish manual cash out, auto target, stop loss and feed refund;
- result screen shows how much of the observed peak was captured;
- all V5.4 Flight Telemetry, mobile focus mode, danger states and server protections remain.

VALIDATION
----------
- V5.4 -> V5.5 update: PASS
- repeated/idempotent V5.5 updater: PASS
- byte-exact rollback to V5.4: PASS
- game.js syntax: PASS
- game-engine.mjs syntax: PASS
- app-server.mjs syntax: PASS
- CSS brace balance: PASS
- unique HTML IDs: PASS
- all game.js DOM references resolve: PASS
- server GameEngine remains byte-exact through update: PASS
- app-server remains byte-exact through update: PASS
- live V5.4 Game Engine compatibility tests: PASS
- verifier: 57 checks PASS

IMPORTANT
---------
PAPER ONLY. No real BUY or SELL order is submitted by this update.
