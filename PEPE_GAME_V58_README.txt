MEMEFLOW PEPE ROCKET — V5.8 CASHOUT VISUAL-ONLY UPDATE
======================================================

HARD RULE
---------
This package does NOT contain or modify the trading engine.

It does NOT contain:
- game-engine.mjs
- app-server.mjs
- evaluate.mjs
- liveeval.mjs
- settings files
- BUY/SELL implementation files

It updates ONLY:
- memeflow-app/game.html
- memeflow-app/game.css
- memeflow-app/game.js

REQUIRED STARTING POINT
-----------------------
Pepe Rocket V5.7.1 Site-Engine Authority Fix.

INSTALL
-------
Upload pepe-game-v5.8-cashout-visual-only.zip into /home/runner/workspace.

Then:

cd /home/runner/workspace
unzip -o pepe-game-v5.8-cashout-visual-only.zip
node ./update-pepe-game-v58.mjs
node ./verify-pepe-game-v58.mjs

Expected final line:

PEPE GAME V5.8 VERIFY: PASS (23 checks)

Then restart MEMEFLOW normally.

WHAT V5.8 CHANGES
-----------------
VISUALIZATION ONLY:
- new live-position HUD;
- current PAPER value;
- current visual PAPER P&L;
- peak-capture percentage;
- visual distance to the already server-provided Auto Cash Out / Stop Loss levels;
- visual progress meter between entry, current level and observed peak;
- CASH OUT request pulse and freeze-frame effect;
- secured-position flash after a profitable server-settled result;
- stronger flight recap on the existing result screen;
- improved mobile LIVE display around the existing CASH OUT button.

The new HUD never triggers BUY, SELL, Auto Cash Out, Stop Loss, or candidate selection.
It only renders fields already received from the current Game/server session.

UNCHANGED BY DESIGN
-------------------
- MEMEFLOW user settings
- BUY logic
- SELL logic
- token filters
- AI evaluation
- BUY READY generation
- main selector logic
- Paper/Live trading engine
- server Auto Cash Out
- server Stop Loss
- game-engine.mjs
- app-server.mjs
- index.html
- Pepe SVG asset

SAFETY
------
The updater refuses to run if game-engine.mjs is not the expected V5.7.1 authority-fix
engine. It records the game-engine and app-server hashes before the visual update and
checks that both remain byte-identical afterward.

ROLLBACK
--------
cd /home/runner/workspace
node ./rollback-pepe-game-v58.mjs

The rollback restores only the three visual files and refuses to overwrite anything if
the trading engine changed independently after installation.

VALIDATION
----------
- game.js syntax: PASS
- game-engine syntax: PASS (read-only verification)
- app-server syntax: PASS (read-only verification)
- unique HTML IDs: PASS
- all game.js DOM references resolve: PASS
- CSS brace balance: PASS
- exactly one Game stylesheet: PASS
- exactly one Game JavaScript file: PASS
- no settings mutation endpoint in Game client: PASS
- no BUY/SELL endpoint added by Game client: PASS
- no old Game entry-filter code reintroduced: PASS
- game-engine byte-identical through update: PASS
- app-server byte-identical through update: PASS
- index.html byte-identical through update: PASS
- repeated installation: PASS
- byte-exact rollback of all changed visual files: PASS

PAPER ONLY
----------
Game remains PAPER-only unless the main MEMEFLOW product itself is intentionally changed
elsewhere. This visual update does not alter that.
