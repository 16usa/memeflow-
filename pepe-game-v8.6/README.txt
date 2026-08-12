PEPE ROCKET V8.6 — MOBILE SEARCH STATE FIX

Exact baseline: V8.5.

Fixed before polish:
- stage-card is now the positioning context for multiplier/overlay HUDs;
- 1.000× no longer anchors against the page/header;
- SCANNING no longer keeps the full READY settings form open;
- SCANNING keeps only radar status + CANCEL SEARCH;
- Round History collapses during SCANNING and LIVE;
- LIVE gives almost the entire mobile viewport to the game scene;
- compact READY history uses fixed-height rows instead of stretching cards.

Unchanged:
- game.js
- src/game-engine.mjs
- app-server.mjs
- index.html
- BUY/SELL/settings/evaluate/trading engine
