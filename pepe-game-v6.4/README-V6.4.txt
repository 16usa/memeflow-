MEMEFLOW PEPE ROCKET — V6.4 STREAM + FLIGHT DIRECTOR
=====================================================

WORKFLOW
--------
1. Audit V6.3 for client/runtime errors.
2. Fix the errors.
3. Re-run runtime, syntax, HTML and CSS checks.
4. Only after PASS, add visual improvements.
5. Verify MEMEFLOW trading/server files remain byte-identical.

HARD PROJECT RULE
-----------------
This update does NOT modify trading logic.

The package payload contains ONLY:
- game.html
- game.css
- game.js

It does NOT contain game-engine.mjs, app-server.mjs, evaluate.mjs,
liveeval.mjs, settings files, BUY logic, SELL logic or selector/trading files.

BUGS FIXED BEFORE VISUAL IMPROVEMENTS
-------------------------------------
- ignored stale/duplicate SSE packets no longer demote an already healthy stream;
- rejected packets no longer advance client ordering counters before acceptance;
- a stuck EventSource with no valid snapshot is recycled by a throttled fallback watchdog;
- restored LIVE rounds show the server-locked stake/auto/stop Flight Plan instead of local pre-flight defaults;
- hidden pages stop the fallback polling interval;
- offline closes EventSource; online performs one authoritative resync/reconnect;
- Wake Lock is re-requested after an external/system release while LIVE;
- lost PLAY AGAIN/reset responses reconcile against server status before leaving stale result UI;
- Canvas FX no longer starts and immediately stops during idle boot.

VISUAL IMPROVEMENTS AFTER FIXES
-------------------------------
- new Flight Director instrument inside the existing scene;
- Flight Director visual roll follows displayed rocket bank;
- Flight Director pitch follows displayed flight velocity;
- Flight Director states mirror presentation state only: standby/cruise/boost/caution/danger/hold/settling/secured/crash;
- observed result trace now includes an ENTRY 1.00× reference line;
- observed result trace now includes a subtle filled flight area;
- mobile and landscape versions automatically compact the Flight Director.

IMPORTANT
---------
The Flight Director is visualization only. It does not decide BUY, SELL,
candidate selection, Auto Cash Out, Stop Loss or settlement.

INSTALL
-------
cd /home/runner/workspace
unzip -o pepe-game-v6.4-stream-flight-director.zip
node ./pepe-game-v6.4/update-pepe-game-v64.mjs
node ./pepe-game-v6.4/verify-pepe-game-v64.mjs

Expected:
PEPE GAME V6.4 VERIFY: PASS

Then restart MEMEFLOW normally.

ROLLBACK
--------
cd /home/runner/workspace
node ./pepe-game-v6.4/rollback-pepe-game-v64.mjs
