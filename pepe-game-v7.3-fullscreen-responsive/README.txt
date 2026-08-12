PEPE ROCKET V7.3 — FULLSCREEN RESPONSIVE

Changes only game.html / game.css / game.js.
- Removes MEMEFLOW site header and footer from Game page.
- Game fills the phone viewport edge-to-edge.
- Portrait: fixed flight stage + independently scrolling cockpit with every desktop panel.
- Landscape: flight stage left + full scrolling cockpit right.
- Restores mobile access to Risk Deck, Selector checks, Selected Launch, Flight Record, Round History, flight HUD instruments.
- Sound, PAPER balance, connection status moved into the Game cockpit.
- FULL SCREEN button uses the Fullscreen API where available.
- iPhone standalone metadata added for browser-chrome-free launch from Home Screen.
- Trading/server/BUY/SELL/settings/evaluate logic is not modified.

Install:
  cd /home/runner/workspace
  unzip -o pepe-game-v7.3-fullscreen-responsive.zip
  node ./pepe-game-v7.3-fullscreen-responsive/update-pepe-game-v73.mjs
  node ./pepe-game-v7.3-fullscreen-responsive/verify-v73.mjs

Rollback:
  node ./pepe-game-v7.3-fullscreen-responsive/rollback-v73.mjs
