MEMEFLOW PEPE ROCKET — V6.2 STABILITY + ALTITUDE HUD

Order used: audit -> fix -> re-test -> visual improvements.
Trading logic is not modified. Package payload contains game.html, game.css and game.js only.

INSTALL
cd /home/runner/workspace
unzip -o pepe-game-v6.2-stability-altitude.zip
node ./pepe-game-v6.2/update-pepe-game-v62.mjs
node ./pepe-game-v6.2/verify-pepe-game-v62.mjs

Then restart MEMEFLOW normally.

ROLLBACK
node ./pepe-game-v6.2/rollback-pepe-game-v62.mjs

BUG FIXES
- rapid double-tap START no longer instantly cancels a new search;
- EventSource open no longer disables fallback before the first valid snapshot;
- fallback status requests are de-duplicated;
- pageshow/visibility/online resync calls share one in-flight request;
- countdown visuals stop on pagehide;
- background clock pauses;
- PLAY AGAIN and history clear are request-locked against repeated taps.

VISUAL IMPROVEMENTS
- live Flight Altimeter;
- current multiplier marker;
- observed peak ghost marker;
- boost/danger marker states;
- improved mobile/landscape altimeter sizing;
- touch-action optimization for mobile controls.
