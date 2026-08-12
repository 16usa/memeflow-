MEMEFLOW PEPE ROCKET — V6.9 REALTIME HUD
=========================================

This is a VISUAL/CLIENT-RUNTIME update only. It changes game.html, game.css and game.js.
It does not contain or modify game-engine.mjs, app-server.mjs, evaluate.mjs, settings,
BUY, SELL or MEMEFLOW trading logic.

WHY V6.8 FELT SLOW
------------------
V6.8 received server ticks immediately, but the big displayed multiplier was intentionally
interpolated toward the new server value by only 10–16% per frame. The visual loop was
also capped around 45 FPS. So the number and PAPER P&L visibly lagged after the tick had
already arrived. Two-decimal formatting hid small real moves as well.

V6.9
----
- Multiplier, PAPER value and P&L update synchronously on every accepted SSE tick.
- 3-decimal multiplier below 2x makes small movement visible sooner.
- Rocket/camera stay smooth separately from the authoritative numeric HUD.
- Active scene follows native requestAnimationFrame; old 22 ms cap is removed.
- Scene smoothing is fast and refresh-rate-independent (~42 ms time constant).
- Currency formatter is cached.
- Big multiplier no longer reparses innerHTML every frame.
- Live trace SVG draws are coalesced to one animation frame.
- Trigger-line and flight-progress DOM updates are skipped when unchanged.
- Browser title is throttled because it is not gameplay-critical.

A visible 1 ms screen refresh is physically impossible: a 120 Hz display paints about every
8.3 ms and a 60 Hz display about every 16.7 ms. V6.9 updates the DOM immediately when the
server tick arrives, so it is visible on the next screen refresh. Market tick frequency still
depends on when MEMEFLOW receives an actual new price.

INSTALL
-------
cd /home/runner/workspace
unzip -o pepe-game-v6.9-realtime-hud.zip
node ./pepe-game-v6.9/update-pepe-game-v69.mjs
node ./pepe-game-v6.9/verify-pepe-game-v69.mjs

ROLLBACK
--------
cd /home/runner/workspace
node ./pepe-game-v6.9/rollback-pepe-game-v69.mjs
