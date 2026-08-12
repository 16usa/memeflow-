MEMEFLOW PEPE ROCKET — V6.0 VISUAL + RUNTIME CLEAN UPDATE
=========================================================

HARD PROJECT RULE
-----------------
Trading logic is not modified.

This ZIP does NOT contain:
- game-engine.mjs
- app-server.mjs
- evaluate.mjs
- liveeval.mjs
- settings files
- BUY logic
- SELL logic
- selector/trading-engine files

It changes ONLY:
- memeflow-app/game.html
- memeflow-app/game.css
- memeflow-app/game.js

REQUIRED STARTING POINT
-----------------------
Pepe Rocket V5.9 Immersive Visual-Only.

INSTALL
-------
Upload pepe-game-v6.0-visual-runtime-clean.zip into /home/runner/workspace.

Then:

cd /home/runner/workspace
unzip -o pepe-game-v6.0-visual-runtime-clean.zip
node ./update-pepe-game-v60.mjs
node ./verify-pepe-game-v60.mjs

Expected:

PEPE GAME V6.0 VERIFY: PASS (34 checks)

Then restart MEMEFLOW normally:

cd /home/runner/workspace/memeflow-app
npm start

Open:
/game

BUGS FIXED BEFORE THE VISUAL UPGRADE
------------------------------------
1. ENGINE-EPOCH / REVISION RESET
   V5.9 reset event sequence after a server-engine epoch change but did not reset
   lastStateRevision and the complete session ordering identity. A restarted engine
   could therefore send valid lower revisions that the browser incorrectly rejected.
   V6.0 resets the complete client-side ordering state when engineEpoch changes.

2. CLIENT WAS MODIFYING SERVER CASH-OUT FLAGS
   V5.9's local one-second clock could write:
   session.feedFresh = false
   session.canCashout = false
   based only on client-side quote age.

   V6.0 NEVER writes those server-authority flags. The browser can visually mark an
   aged local quote, but CASH OUT authority continues to come from the server/session
   flags and connectivity state.

3. CSS ESCAPE/PARSING DEFECT
   A V5.9 appended visual section contained literal backslash-n sequences. That could
   cause some selectors to parse incorrectly. V6.0 removes all literal escape artifacts
   and the final stylesheet passes a real tinycss2 parse with zero errors.

4. INTERNAL CSS LAYERING
   Exact duplicate canonical selectors accumulated across previous visual revisions.
   V6.0 consolidates them into one final rule per selector. A recursive exact-duplicate
   selector audit passes across top-level and media contexts.

5. iPHONE / BFCache LIFECYCLE
   pagehide/pageshow now explicitly pauses and resumes the visual render loops, SSE,
   fallback synchronization and wake-lock lifecycle. Resize listeners are cleaned up.

V6.0 VISUAL IMPROVEMENTS
------------------------
- one visual flight-state machine:
  IDLE / CRUISE / BOOST / CAUTION / DANGER / HOLD / SETTLING / SECURED / CRASH
- flight-state system reads presentation values only and never decides a trade;
- animated flight-state ring around Pepe Rocket;
- stronger plasma tail during real displayed acceleration/boost;
- aurora layer through cloud/stratosphere stages;
- orbital perspective grid entering orbit;
- plasma wake in deep-space/hyperspace flight;
- distinct rocket body motion for idle, cruise, boost, caution and danger;
- secured-position ring animation;
- danger state gets a controlled visual warning rather than another trading rule;
- mobile LIVE scene expanded further;
- result card receives a more premium win/loss/void atmosphere;
- reduced-motion fallback preserved.

CSS CLEANUP
-----------
The final game.css is still exactly ONE stylesheet.
Historical V5.x override comments were converted to functional sections.
Exact duplicate selectors were consolidated.
No extra style/theme file is loaded.

SAFETY
------
The updater:
- refuses to run if the Game engine is not the expected MEMEFLOW-authority engine;
- records hashes of game-engine.mjs, app-server.mjs and index.html before changing visuals;
- checks that all three protected files remain byte-identical afterward;
- accepts V5.9 or an already-installed V6.0 only, preventing accidental layer conflicts.

ROLLBACK
--------
cd /home/runner/workspace
node ./rollback-pepe-game-v60.mjs

On a normal first V5.9 -> V6.0 install, rollback restores game.html/game.css/game.js
byte-for-byte to V5.9. Trading/server files are never overwritten.

VALIDATION COMPLETED
--------------------
- V5.9 -> V6.0 install: PASS
- repeated/idempotent V6.0 update: PASS
- byte-exact rollback to V5.9: PASS
- game.js syntax: PASS
- game-engine syntax read-only verification: PASS
- app-server syntax read-only verification: PASS
- HTML IDs unique: PASS
- all game.js DOM references resolve: PASS
- CSS braces balanced: PASS
- tinycss2 full stylesheet parsing: ZERO ERRORS
- recursive exact duplicate selector audit: ZERO DUPLICATES
- no old Game entry-filter code: PASS
- no settings mutation endpoint: PASS
- no BUY/SELL endpoint: PASS
- no client assignment to session.feedFresh: PASS
- no client assignment to session.canCashout: PASS
- game-engine byte-identical through install: PASS
- app-server byte-identical through install: PASS
- index.html byte-identical through install: PASS
- V6.0 verifier: 34 checks PASS
