MEMEFLOW PEPE ROCKET — V5.9 IMMERSIVE VISUAL-ONLY UPDATE
========================================================

HARD PROJECT RULE
-----------------
This update does NOT modify MEMEFLOW trading logic.

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
Pepe Rocket V5.8 Visual-Only.

INSTALL
-------
Upload pepe-game-v5.9-immersive-visual-only.zip into /home/runner/workspace.

Then:

cd /home/runner/workspace
unzip -o pepe-game-v5.9-immersive-visual-only.zip
node ./update-pepe-game-v59.mjs
node ./verify-pepe-game-v59.mjs

Expected:

PEPE GAME V5.9 VERIFY: PASS (29 checks)

Then restart MEMEFLOW normally.

V5.9 VISUAL IMPROVEMENTS
------------------------
- deeper multi-layer parallax scene;
- independent far / mid / near visual depth;
- atmosphere haze that fades naturally into orbit/deep space;
- extra high-altitude/deep-space star depth;
- flight dust / speed particles driven only by already displayed live velocity;
- rocket micro-float for a less static sprite;
- engine heat shimmer;
- animated exhaust smoke in low atmosphere;
- smoke automatically fades in space;
- stronger visual energy as the already received multiplier/velocity rises;
- richer vignette and danger framing;
- more cinematic emergency descent before an already server-settled losing result;
- cleaner secured-position hold before an already server-settled profitable result;
- larger immersive mobile LIVE viewport;
- improved mobile full-screen feeling without changing any server decision;
- reduced-motion fallback preserved.

WHAT THE NEW EFFECTS ARE ALLOWED TO READ
----------------------------------------
Only existing presentation/session values such as:
- multiplier
- displayed velocity
- acceleration
- already provided drawdown
- existing stage
- existing server result

They do not decide eligibility, BUY, SELL, Auto Cash Out, Stop Loss, or candidate selection.

UNCHANGED
---------
- MEMEFLOW settings
- BUY READY generation
- BUY/SELL
- evaluate()
- live evaluation
- token filters
- trading selector
- game-engine.mjs
- app-server.mjs
- index.html
- server Auto Cash Out
- server Stop Loss
- server settlement

SAFETY
------
The updater refuses to run unless the existing Game engine is the expected
site-authority engine. It records hashes of game-engine.mjs, app-server.mjs and
index.html before updating visuals and verifies those files are byte-identical after.

ROLLBACK
--------
cd /home/runner/workspace
node ./rollback-pepe-game-v59.mjs

On a normal first V5.8 -> V5.9 install, rollback restores the three visual files
byte-for-byte to their V5.8 state. Protected engine/server/index files are never changed.

VALIDATION
----------
- V5.8 -> V5.9 update: PASS
- repeated/idempotent V5.9 update: PASS
- first-install byte-exact rollback to V5.8: PASS
- game.js syntax: PASS
- game-engine syntax read-only check: PASS
- app-server syntax read-only check: PASS
- CSS braces: PASS
- unique HTML IDs: PASS
- all JavaScript DOM IDs resolve: PASS
- one Game stylesheet only: PASS
- one Game script only: PASS
- no Game entry filters reintroduced: PASS
- no settings mutation endpoint: PASS
- no BUY endpoint: PASS
- no SELL endpoint: PASS
- game-engine unchanged: PASS
- app-server unchanged: PASS
- index.html unchanged: PASS
- V5.9 verifier: 29 checks PASS
