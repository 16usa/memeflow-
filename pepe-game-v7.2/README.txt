PEPE ROCKET V7.2 — ONE-SCREEN STABLE

Exact baseline: V7.1 Live Experience (pre-V8 redesign).

Core fix:
- removes the visual focus-mode function that enlarged/reformatted the game after START;
- READY, SCANNING, LIVE and SETTLING use the same physical mobile scene/control dimensions.

Mobile one-screen:
- stage + compact Launch Control + controls fit in one viewport;
- no mobile page scrolling;
- secondary diagnostic/history panels are hidden on phone to avoid duplication;
- controls remain in the same place when START is pressed;
- iPhone focus zoom is disabled.

Trading/server logic unchanged:
- src/game-engine.mjs untouched
- app-server.mjs untouched
- index.html untouched
- no BUY/SELL/settings/evaluate changes
