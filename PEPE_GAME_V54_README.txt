MEMEFLOW PEPE ROCKET — V5.4 FLIGHT ASSIST IN-PLACE UPDATE
=========================================================

NO NEW LAYERS
-------------
This update modifies the existing Game files in place:
- game.html
- game.css
- game.js
- src/game-engine.mjs

It does NOT add another CSS file or another JavaScript layer.
It does NOT rewrite index.html or app-server.mjs.
The existing Pepe rocket asset remains the same single asset.

INSTALL
-------
Upload pepe-game-v5.4-flight-assist-inplace.zip into /home/runner/workspace.

Then:

cd /home/runner/workspace
unzip -o pepe-game-v5.4-flight-assist-inplace.zip
node ./update-pepe-game-v54.mjs
node ./verify-pepe-game-v54.mjs

Expected:

PEPE GAME V5.4 VERIFY: PASS (49 checks)

Then restart MEMEFLOW:

cd /home/runner/workspace/memeflow-app
npm start

Open:
/game

ROLLBACK
--------
cd /home/runner/workspace
node ./rollback-pepe-game-v54.mjs

Restart MEMEFLOW after rollback.

WHAT V5.4 IMPROVES
------------------
- new Flight Telemetry HUD inside the existing Game UI;
- telemetry states: STANDBY / CRUISE / CLIMB / BOOST / SOFT DIP / PULLBACK / REVERSAL / FEED HOLD;
- Flight Telemetry is descriptive only; it never submits or forces a trade;
- telemetry compares current buy pressure and liquidity against the locked entry snapshot;
- clearer selector waiting reason when no candidate is ready;
- server records accepted quote count, peak time, trough time and maximum adverse excursion;
- result screen now shows max adverse excursion and time to peak;
- result receipt shows launch quality, accepted price update count, entry price and exit price;
- server persists the new recap fields into round history;
- all V5.3 cinematic camera, mobile focus mode, danger states, Auto Cash Out,
  Stop Loss, stale-price protection, feed-loss refund, SSE and session recovery remain.

TESTS
-----
- Node syntax: PASS
- CSS balance: PASS
- unique HTML IDs: PASS
- JS -> DOM references: PASS
- V5.4 Game Engine behavior tests: PASS
- V5.3 -> V5.4 update: PASS
- repeated/idempotent install: PASS
- rollback to V5.3: PASS
- 40 users / 7000 randomized Game Engine operations: PASS

IMPORTANT
---------
PAPER ONLY. This package does not submit real BUY or SELL orders.
