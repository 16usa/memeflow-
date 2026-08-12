MEMEFLOW PEPE ROCKET — V6.3 STREAM STABILITY + FLIGHT RECAP
============================================================

PROCESS USED
------------
1. Audit V6.2 for errors first.
2. Fix errors.
3. Re-run runtime / syntax / HTML / CSS checks.
4. Only after the fixes pass, add visual polish.
5. Verify the trading/server files stayed byte-identical.

HARD PROJECT RULE
-----------------
Trading logic is NOT modified.

This package contains only the existing Game presentation files:
- game.html
- game.css
- game.js

It does NOT contain:
- game-engine.mjs
- app-server.mjs
- evaluate.mjs
- liveeval.mjs
- settings
- BUY / SELL implementation
- selector or trading-engine files

REQUIRED STARTING POINT
-----------------------
Pepe Rocket V6.2.

INSTALL
-------
cd /home/runner/workspace
unzip -o pepe-game-v6.3-stream-stability-flight-recap.zip
node ./pepe-game-v6.3/update-pepe-game-v63.mjs
node ./pepe-game-v6.3/verify-pepe-game-v63.mjs

Expected:
PEPE GAME V6.3 VERIFY: PASS

Then restart MEMEFLOW normally.

BUGS FIXED BEFORE VISUAL IMPROVEMENTS
-------------------------------------
1. SSE CONNECTING GAP
   V6.2 could stop receiving status updates if EventSource stayed CONNECTING for a
   long time and neither open nor error fired. V6.3 starts fallback status sync
   immediately and keeps it active until a valid SSE snapshot is accepted.

2. STALE SSE COULD LOOK HEALTHY
   V6.2 marked a stream healthy before checking whether an SSE packet was stale or
   out-of-order. V6.3 only marks the stream healthy after the packet is accepted.

3. COUNTDOWN COULD CONTINUE WHILE HIDDEN
   visibilitychange now cancels/hides the launch countdown immediately. The live
   server round continues; only the visual countdown is stopped.

4. OLD VISUAL TIMERS
   milestone and shockwave timers are now centrally cleared with the other visual
   timers so a later round cannot inherit an old effect.

5. IDLE BATTERY USE
   The one-second visual clock now sleeps in stable IDLE / COMPLETE states and runs
   only while SEARCHING / LIVE / SETTLING.

6. CANVAS DENSITY AFTER ROTATION
   Star density is recalculated on resize/orientation changes instead of remaining
   fixed to the width at first load.

7. RESULT FX IN BACKGROUND
   Result particles are cancelled when the page is hidden or Reduced Motion is
   enabled.

8. V6.2 VERIFIER DEFECT
   The V6.2 verifier had a malformed CSS-brace check. V6.3 verifier uses a valid,
   dependency-free brace scanner and does not rely on the old broken check.

VISUAL IMPROVEMENTS AFTER FIXES
-------------------------------
- new "Observed Flight Path" chart on the result screen;
- path uses only multiplier points actually observed on this screen;
- peak and exit points are separately marked;
- if the page was reloaded and no local path exists, it explicitly says so instead
  of inventing a fake trajectory;
- subtle live focus glow based on existing displayed scene energy;
- adaptive star density for phone / tablet / desktop / Save-Data.

ROLLBACK
--------
cd /home/runner/workspace
node ./pepe-game-v6.3/rollback-pepe-game-v63.mjs

Rollback restores only game.html / game.css / game.js to V6.2.
Trading/server files are never written.
