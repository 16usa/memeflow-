MEMEFLOW PEPE ROCKET V8.0 — ARCADE COCKPIT

This is a visual/client-only redesign based on the supplied arcade reference:
- PLACE YOUR BET on the left
- large neon multiplier + rocket + market path in the center
- ROUND HISTORY on the right
- selected token/session information beneath the main play area
- large center CASH OUT during LIVE

Hard rule:
This package contains only game.html, game.css, and game.js as live payload.
It does not contain or modify BUY/SELL/settings/evaluate/trading-engine files.

Required starting point:
Exact Pepe Rocket V7.1 Live Experience.

Install:
cd /home/runner/workspace
unzip -o pepe-game-v8.0-arcade-cockpit.zip
node ./pepe-game-v8.0/update-pepe-game-v80.mjs
node ./pepe-game-v8.0/verify-pepe-game-v80.mjs

Then restart:
cd /home/runner/workspace/memeflow-app
npm start

Rollback:
cd /home/runner/workspace
node ./pepe-game-v8.0/rollback-pepe-game-v80.mjs
