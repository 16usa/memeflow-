MEMEFLOW PEPE ROCKET — V7.0 GAME-STATE UI CLEANUP
==================================================

VISUAL-ONLY UPDATE. Trading logic is not modified.

INSTALL FROM /home/runner/workspace
-----------------------------------
unzip -o pepe-game-v7.0-game-state-cleanup.zip
node ./pepe-game-v7.0/update-pepe-game-v70.mjs
node ./pepe-game-v7.0/verify-pepe-game-v70.mjs

Expected final line:
PEPE GAME V7.0 VERIFY: PASS (58 checks)

Then restart MEMEFLOW normally:
cd /home/runner/workspace/memeflow-app
npm start

WHAT WAS FIXED
--------------
- SCANNING no longer shows fake LIVE multiplier/P&L/Peak/Thrust instruments.
- Disabled CASH OUT no longer occupies half the mobile dock before a live round.
- Mobile SCANNING becomes a focused game/search scene.
- LIVE multiplier and LIVE POSITION are spatially separated.
- Duplicate Flight Position card is hidden on mobile LIVE; Altimeter remains.
- Extra static level labels are hidden on small LIVE screens.
- Fixed dock gets additional bottom content reserve so following content is not covered.
- Initial THRUST is 0%, not 20%.
- Initial Peak Capture is neutral, not 100%.
- Current asset cache-bust and metadata are V7.0.

VISUAL IMPROVEMENTS
-------------------
- New preflight/search HUD with radar.
- Clear READY vs SCANNING vs LIVE visual hierarchy.
- Cleaner single-button CANCEL SEARCH mobile dock.
- Better launchpad depth/smoke treatment.
- Less terminal clutter during the actual game.

PROTECTED / NOT TOUCHED
-----------------------
- src/game-engine.mjs
- app-server.mjs
- index.html
- evaluate.mjs / liveeval.mjs
- settings
- BUY / SELL / filters / trading selector

ROLLBACK
--------
node ./pepe-game-v7.0/rollback-pepe-game-v70.mjs
