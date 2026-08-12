MEMEFLOW PEPE ROCKET — V5.7 FLIGHT PLAN IN-PLACE UPDATE
=======================================================

NO NEW LAYERS
-------------
V5.7 updates only the existing:
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
Pepe Rocket V5.6.

INSTALL
-------
Upload pepe-game-v5.7-flight-plan-inplace.zip into /home/runner/workspace.

Then:

cd /home/runner/workspace
unzip -o pepe-game-v5.7-flight-plan-inplace.zip
node ./update-pepe-game-v57.mjs
node ./verify-pepe-game-v57.mjs

Expected:

PEPE GAME V5.7 VERIFY: PASS (58 checks)

Then restart MEMEFLOW:

cd /home/runner/workspace/memeflow-app
npm start

Open:
/game

ROLLBACK
--------
cd /home/runner/workspace
node ./rollback-pepe-game-v57.mjs

Restart MEMEFLOW after rollback.

V5.7 IMPROVEMENTS
-----------------
- premium Flight Plan panel before START;
- projected payout based on paper stake and selected auto target;
- projected target profit;
- projected stop downside when a stop is enabled;
- reward/risk ratio preview;
- clear profile labels: MANUAL / CONSERVATIVE / BALANCED / AGGRESSIVE / MOONSHOT;
- five quick auto-target presets that update the existing auto-cashout select;
- projected payout is shown directly inside desktop and mobile START controls;
- presets lock while SEARCHING/LIVE/SETTLING;
- all projections explicitly remain non-authoritative;
- server-observed market price remains authoritative for final settlement;
- completed result now records the actual locked flight plan from the server session;
- all V5.6 target acquisition, V5.5 cinematic launch, V5.4 telemetry and server safety remain.

VALIDATION
----------
- V5.6 -> V5.7 update: PASS
- repeated/idempotent V5.7 updater: PASS
- byte-exact rollback to V5.6: PASS
- game.js syntax: PASS
- game-engine.mjs syntax: PASS
- app-server.mjs syntax: PASS
- CSS brace balance: PASS
- unique HTML IDs: PASS
- every game.js DOM reference resolves: PASS
- engine byte-exact through update: PASS
- app-server byte-exact through update: PASS
- live V5.4 Game Engine compatibility tests: PASS
- verifier: 58 checks PASS

IMPORTANT
---------
PAPER ONLY. The projected payout is a UI estimate, not a guaranteed payout.
The server-observed market price determines the settled PAPER result.
