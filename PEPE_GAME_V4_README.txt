MEMEFLOW PEPE ROCKET GAME — CLEAN V4.1.0
========================================

PURPOSE
-------
This package installs the Pepe Rocket PAPER game as one clean Game module.
It does NOT stack V4 graphics/CSS/JS over V1, V2, or V3.

INSTALL IN REPLIT
-----------------
Upload pepe-game-v4-clean-max.zip to /home/runner/workspace, then run:

cd /home/runner/workspace
unzip -o pepe-game-v4-clean-max.zip
node ./install-pepe-game-v4.mjs
node ./verify-pepe-game-v4.mjs

Expected final line:

PEPE GAME V4 VERIFY: PASS (38 checks)

Then restart MEMEFLOW:

cd /home/runner/workspace/memeflow-app
npm start

Open:

/game

IMPORTANT
---------
This is PAPER ONLY. It does not submit real BUY/SELL orders.

CLEAN-REPLACEMENT POLICY
------------------------
The live Game presentation consists only of:
- memeflow-app/game.html
- memeflow-app/game.css
- memeflow-app/game.js
- memeflow-app/game-assets/pepe-rocket.svg

The live Game engine consists only of:
- memeflow-app/src/game-engine.mjs

Old V1/V2/V3 Game CSS/JS files are overwritten, not layered.

SAFETY / BACKUP
---------------
Before replacement, the installer creates:

memeflow-app/.memeflow-patches/pepe-game-v4/<timestamp>/

It stores the pre-install index.html, app-server.mjs and any prior Game files there.

V4.1 SAFETY IMPROVEMENTS
------------------------
- server-authoritative virtual balance and round settlement;
- fresh BUY READY decision + real accepted price timestamp required to start;
- generic token metadata updates cannot revive a stale market quote;
- out-of-order price snapshots are rejected;
- manual CASH OUT is disabled when the accepted quote is stale;
- Auto Cash Out and Stop Loss execute server-side from accepted live token updates;
- round timeout waits for the next fresh accepted quote instead of settling on stale data;
- idempotent START request IDs protect against retry/double-start races;
- active sessions rebuild after a server restart;
- one authenticated SSE game stream, with low-frequency status fallback only on stream failure;
- client rejects delayed/out-of-order server payloads;
- mobile screen wake lock is requested during a live round when supported;
- reduced-motion support and adaptive mobile Canvas load;
- clean responsive mobile action dock.

VALIDATION INCLUDED
-------------------
verify-pepe-game-v4.mjs checks clean source hashes, legacy-layer removal,
navigation/integration uniqueness, DOM references, Node syntax, and Game Engine behavior.

The package was tested for fresh install, V3-style upgrade, repeated/idempotent install,
HTML parsing, CSS block balance, and server Game Engine state behavior.
