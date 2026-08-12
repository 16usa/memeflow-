MEMEFLOW PEPE ROCKET — V5.3 CINEMATIC IN-PLACE UPDATE
=====================================================

THIS IS NOT A NEW LAYER
-----------------------
V5.3 updates the existing Game files in place.

It does NOT add:
- a second CSS file
- a second JavaScript layer
- a new theme file
- an app-server patch layer
- an index.html patch layer

It updates the existing:
- game.html
- game.css
- game.js
- src/game-engine.mjs

The server engine remains V5.2-compatible; the new Flight UI is V5.3.

SUPPORTED STARTING POINT
------------------------
The updater accepts the current Pepe Rocket V5.1 or V5.2 installation.

INSTALL
-------
Upload pepe-game-v5.3-cinematic-inplace.zip into /home/runner/workspace.

Then run:

cd /home/runner/workspace
unzip -o pepe-game-v5.3-cinematic-inplace.zip
node ./update-pepe-game-v53.mjs
node ./verify-pepe-game-v53.mjs

Expected final line:

PEPE GAME V5.3 VERIFY: PASS (36 checks)

Then restart:

cd /home/runner/workspace/memeflow-app
npm start

Open:

/game

ROLLBACK
--------
To restore the exact four files that existed before V5.3:

cd /home/runner/workspace
node ./rollback-pepe-game-v53.mjs

Then restart MEMEFLOW.

V5.3 IMPROVEMENTS
-----------------
- cinematic camera reacts smoothly to live price velocity;
- subtle zoom/vertical/side camera movement without changing server logic;
- rocket engine flame length reacts to live thrust;
- speed lines and boost glow scale with momentum;
- danger is graduated: none / low / medium / high;
- danger uses drawdown + negative velocity, not every tiny red tick;
- high danger haptic/sound is rate-limited to avoid spam;
- stronger danger state produces controlled rocket shake;
- milestones create a short cinematic light kick;
- Canvas stars stretch into speed trails as velocity increases;
- mobile LIVE focus mode hides nonessential cockpit panels;
- mobile LIVE dock becomes one large CASH OUT control;
- mobile stage expands toward full viewport height during a live round;
- reduced-motion mode disables cinematic camera transforms;
- existing PAPER Game server authority, Auto Cash Out, Stop Loss,
  stale-price protection, session recovery and SSE architecture are preserved.

VALIDATION PERFORMED
--------------------
- V5.1 -> V5.3 update: PASS
- V5.2 -> V5.3 update: PASS
- repeated/idempotent V5.3 update: PASS
- byte-exact V5.3 rollback test: PASS
- game.js syntax: PASS
- game-engine.mjs syntax: PASS
- app-server.mjs syntax: PASS
- CSS brace balance: PASS
- unique HTML IDs: PASS
- all game.js DOM references resolve: PASS
- no extra Game JS file: PASS
- no extra Game CSS file: PASS
- GameEngine behavior tests: PASS

IMPORTANT
---------
This remains PAPER ONLY. No real BUY/SELL orders are submitted by this package.
