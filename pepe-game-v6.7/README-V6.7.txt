MEMEFLOW PEPE ROCKET — V6.7 MOBILE STABILITY + LAUNCH CONTROL POLISH
====================================================================

WORKFLOW
--------
1. Reproduced/audited the V6.6 mobile runtime from the supplied iPhone screenshots.
2. Fixed stability/runtime issues first.
3. Re-ran syntax, DOM, CSS, runtime, installation and rollback checks.
4. Only after PASS, added visual polish.

ROOT CAUSE OF THE STRONG MOBILE SCREEN SHAKE
--------------------------------------------
V6.6 listened to iOS visualViewport resize AND scroll events and repeatedly wrote a
pixel --vvh CSS variable. That variable controlled body/game minimum height and LIVE
scene height. Safari/Replit browser chrome changes visualViewport.height continuously
while scrolling, so the page was being re-laid out while a fixed blurred action dock
was being composited at the bottom. The combination could visibly shake/jump the page.

V6.7 FIX
--------
- removes all visualViewport scroll/resize layout writes;
- removes the dynamic --vvh variable;
- uses stable 100svh for page/LIVE viewport sizing;
- removes backdrop blur from the fixed mobile action dock;
- removes mobile sticky topbar blur;
- promotes the mobile dock to one stable composited/contained layer;
- stabilizes START/CASH OUT text width so state changes do not resize the dock;
- blurs mobile action button focus after pointer release;
- keeps safe-area bottom padding;
- slightly compacts Launch Control on narrow iPhones to reduce unnecessary scroll.

VISUAL POLISH ADDED AFTER THE FIX
---------------------------------
- stable control-deck indicator above the mobile action dock;
- indicator follows Game presentation state: searching / live / settling / complete;
- cleaner compact Launch Control spacing on narrow mobile;
- no new stylesheet and no new JS layer.

HARD PROJECT RULE
-----------------
Trading logic is NOT modified.

This ZIP contains no:
- game-engine.mjs
- app-server.mjs
- evaluate.mjs
- liveeval.mjs
- settings files
- BUY logic
- SELL logic
- selector/trading-engine files

It updates ONLY:
- memeflow-app/game.html
- memeflow-app/game.css
- memeflow-app/game.js

REQUIRED STARTING POINT
-----------------------
Pepe Rocket V6.6.

INSTALL
-------
Upload pepe-game-v6.7-mobile-stability.zip to /home/runner/workspace.

Then:

cd /home/runner/workspace
unzip -o pepe-game-v6.7-mobile-stability.zip
node ./pepe-game-v6.7/update-pepe-game-v67.mjs
node ./pepe-game-v6.7/verify-pepe-game-v67.mjs

Expected final line:

PEPE GAME V6.7 VERIFY: PASS (46 checks)

Then restart MEMEFLOW normally:

cd /home/runner/workspace/memeflow-app
npm start

ROLLBACK
--------
cd /home/runner/workspace
node ./pepe-game-v6.7/rollback-pepe-game-v67.mjs

VALIDATION COMPLETED
--------------------
- V6.6 -> V6.7 install: PASS
- repeated/idempotent update: PASS
- byte-exact rollback to V6.6: PASS
- game.js syntax: PASS
- runtime smoke: PASS
- unique HTML IDs: PASS
- all JS DOM references: PASS
- CSS braces: PASS
- exact duplicate CSS selectors: 0
- dynamic visualViewport layout listeners: 0
- dynamic --vvh layout mutation: removed
- game-engine unchanged: PASS
- app-server unchanged: PASS
- index.html unchanged: PASS
- BUY/SELL/settings endpoints in visual client: NONE
