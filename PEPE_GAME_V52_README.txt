MEMEFLOW PEPE ROCKET — V5.2 IN-PLACE UPDATE
===========================================

This is NOT a new visual/theme layer.

It updates the existing V5.1 Game in place:
- game.js
- src/game-engine.mjs
- only the existing game.js cache-bust in game.html: ?v=51 -> ?v=52

It does NOT replace or add:
- game.css
- new CSS files
- new JS layer files
- game graphics/assets
- index.html
- app-server.mjs

INSTALL
-------
Upload pepe-game-v5.2-inplace-update.zip to /home/runner/workspace, then:

cd /home/runner/workspace
unzip -o pepe-game-v5.2-inplace-update.zip
node ./update-pepe-game-v52.mjs
node ./verify-pepe-game-v52.mjs

Expected:
PEPE GAME V5.2 VERIFY: PASS (29 checks)

Then restart:
cd /home/runner/workspace/memeflow-app
npm start

ROLLBACK
--------
cd /home/runner/workspace
node ./rollback-pepe-game-v52.mjs

V5.2 CHANGES
------------
- cancellable ENTRY LOCKED countdown; no late GO/launch effect after a round already completed;
- recovery of the SSE stream even if the page originally opened during a temporary Game API outage;
- safer localStorage and matchMedia use for restrictive/mobile browser environments;
- result animation cancellation and background inert handling;
- bounded launch-session memory;
- two-step history clear to prevent accidental deletion;
- live holder/top10/buy-pressure/liquidity telemetry instead of only the entry snapshot;
- selector quality based on existing antiRugHistory;
- recent volatility, drawdown, liquidity deterioration and extreme chase are ranking signals;
- active same-mint game crowding is a ranking penalty;
- these are ranking signals ONLY among already BUY READY candidates; user MEMEFLOW filters are unchanged;
- improved selector diagnostics (quality and crowding).

VALIDATION
----------
- Node syntax checks
- DOM id checks
- integration uniqueness checks
- engine behavior tests
- 25-user / 3000-operation randomized fuzz test performed during build
- fresh V5.1 -> V5.2 update test
- byte-exact rollback test
