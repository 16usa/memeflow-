PEPE ROCKET V8.1 — ARCADE COCKPIT LAYOUT FIX

This is an in-place visual/layout repair for exact V8.0.

Fixed first:
- rocket was missing position:absolute after the V8.0 clean CSS rewrite;
- desktop cockpit was taller than the viewport and produced a long page scroll;
- Round History stretched the page instead of scrolling internally.

Then improved:
- larger centered Pepe/rocket;
- larger live multiplier;
- larger central CASH OUT action;
- compact one-screen desktop cockpit;
- cleaner central scene closer to the supplied reference;
- internal Round History scroll;
- compact desktop mode for short displays.

UNCHANGED:
- game.js
- src/game-engine.mjs
- app-server.mjs
- index.html
- settings / evaluate / BUY / SELL / trading engine

Install:
cd /home/runner/workspace
unzip -o pepe-game-v8.1-arcade-layout-fix.zip
node ./pepe-game-v8.1/update-pepe-game-v81.mjs
node ./pepe-game-v8.1/verify-pepe-game-v81.mjs

Rollback:
node ./pepe-game-v8.1/rollback-pepe-game-v81.mjs
