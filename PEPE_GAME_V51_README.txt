MEMEFLOW PEPE ROCKET GAME — V5.1 CLEAN MAX
==========================================

This package is a CLEAN REPLACEMENT of the Game module.
It does not load V1/V2/V3/V4/V5 Game CSS, JavaScript, or graphics underneath V5.1.

INSTALL IN REPLIT
-----------------
1. Upload pepe-game-v5.1-clean-max.zip into /home/runner/workspace

2. In Shell run:

cd /home/runner/workspace
unzip -o pepe-game-v5.1-clean-max.zip
node ./install-pepe-game-v51.mjs
node ./verify-pepe-game-v51.mjs

Expected final line:

PEPE GAME V5.1 VERIFY: PASS (71 checks)

3. Only after PASS, restart MEMEFLOW:

cd /home/runner/workspace/memeflow-app
npm start

4. Open:

/game

ROLLBACK
--------
The installer creates a complete pre-V5.1 snapshot before changing live files.

To restore the latest pre-V5.1 state:

cd /home/runner/workspace
node ./rollback-pepe-game-v51.mjs

Then restart MEMEFLOW.

CLEAN REPLACEMENT POLICY
------------------------
V5.1 owns exactly these live Game presentation files:

memeflow-app/game.html
memeflow-app/game.css
memeflow-app/game.js
memeflow-app/game-assets/pepe-rocket.svg

and this Game engine file:

memeflow-app/src/game-engine.mjs

The installer removes the old live game-assets directory before installing the one V5.1 rocket asset.
Old versions are stored only in the backup directory and are not loaded by the browser.

V5.1 SAFETY / RELIABILITY
-------------------------
- PAPER ONLY. No real BUY/SELL submission.
- Server-authoritative balance, multiplier, triggers, settlement and history.
- START requires a current per-user BUY READY decision.
- START requires a fresh accepted price timestamp.
- START requires holderFresh plus a real, fresh holderScannedAt timestamp.
- START rejects future-dated market, decision and holder timestamps.
- Decision must be temporally coherent with both the price and holder evidence.
- Out-of-order and exact duplicate price snapshots are ignored.
- Non-finite multiplier updates are rejected.
- Auto Cash Out and Stop Loss execute server-side.
- Manual CASH OUT locks when the quote is stale.
- Lost CASH OUT responses are reconciled against server state.
- A dead market feed voids the PAPER round and returns the reserved stake.
- START retries are idempotent through requestId.
- Selector request timeouts reconcile server state and continue scanning.
- Search pauses while the tab is backgrounded or the device is offline.
- Active sessions rebuild after a server restart.
- Engine epoch + state/session revisions protect the UI from late/out-of-order events.
- One authenticated /api/game/stream SSE channel with fallback status sync.
- Screen Wake Lock requested during active play where supported.
- Offline state immediately locks cash-out controls.
- Cross-tab reset removes stale result overlays.
- Result screen is an accessible dialog; live-region scope avoids announcing every multiplier frame.
- Reduced-motion and adaptive mobile Canvas behavior.
- One CSS file and one JS file for Game; no stacked themes.

VALIDATION
----------
The included verifier checks source hashes, integration uniqueness, old layer removal,
asset-directory cleanliness, unique HTML IDs, JS-to-DOM references, CSS balance,
Node syntax, server integration, safety features, and Game Engine behavior.

The package was tested as:
- fresh installation
- repeated/idempotent V5.1 installation
- V4 -> V5.1 clean upgrade
- V5 -> V5.1 clean upgrade
- exact rollback to a pre-Game clean fixture
