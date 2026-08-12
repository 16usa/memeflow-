PEPE ROCKET V8.5 — MOBILE COMPOSITION FIX

Exact baseline: V8.4.

Fixed:
- multiplier HUD was missing position:absolute and could shift off the left edge;
- READY duplicate 'No launch selected' presentation removed on mobile;
- mobile Round History reduced to the two latest rows;
- LIVE hides the settings panel and gives the scene most of the screen;
- iOS gesture/double-click zoom guard added without modifying game.js.

UNCHANGED:
- game.js
- src/game-engine.mjs
- app-server.mjs
- index.html
- BUY/SELL/settings/evaluate/trading engine
