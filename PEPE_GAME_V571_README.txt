MEMEFLOW PEPE ROCKET — V5.7.1 SITE-ENGINE AUTHORITY FIX
=======================================================

PURPOSE
-------
This repair restores the intended trading principle:

MEMEFLOW USER SETTINGS -> MEMEFLOW PER-USER EVALUATION -> BUY READY -> GAME

The Game no longer runs a second hidden trading filter after MEMEFLOW has already
approved a token as BUY READY.

REMOVED FROM GAME ENTRY ELIGIBILITY
-----------------------------------
- Game-specific price-age gate
- Game-specific decision-age gate
- Game-specific holder-age gate
- Game-specific decision/price/holder timestamp coherence gate
- antiRugHistory volatility/drawdown/liquidity scoring as an entry veto/ranking layer
- same-mint crowding penalty as an entry ranking layer
- recent-mint penalty as an entry ranking layer

STILL AUTHORITATIVE
-------------------
- Your existing MEMEFLOW user settings and BUY READY decision
- MEMEFLOW kill switch
- A valid positive token price (mechanically required to form 1.00x)
- Server-side PAPER Auto Cash Out
- Server-side PAPER Stop Loss
- Stale-quote Cash Out safety
- Market-feed-loss PAPER refund
- Existing Game graphics, Flight Plan, target acquisition and cinematic UI

IMPORTANT BEHAVIOR
------------------
If MEMEFLOW says BUY READY for the current user and the token has a valid positive
price, Game may launch it. Game no longer rejects it because Game itself thinks the
decision, holders or quote timestamps are too old or not "coherent".

If the entry price has no trusted live timestamp yet, the round can still start from
the site-approved price, but CASH OUT remains safely locked until a fresh live market
quote arrives. This prevents the old Game-side selector from blocking entry while
preserving live settlement safety.

FILES UPDATED IN PLACE
----------------------
- memeflow-app/game.html
- memeflow-app/game.css
- memeflow-app/game.js
- memeflow-app/src/game-engine.mjs

NOT MODIFIED
------------
- memeflow-app/app-server.mjs
- memeflow-app/index.html
- MEMEFLOW settings
- MEMEFLOW evaluate.mjs
- MEMEFLOW liveeval.mjs
- token discovery / holder / market engines
- Pepe rocket asset

No second CSS or JavaScript layer is added.

SUPPORTED STARTING POINT
------------------------
Pepe Rocket V5.4, V5.5, V5.6 or V5.7.

INSTALL
-------
Upload:
pepe-game-v5.7.1-site-engine-authority-fix.zip

to:
/home/runner/workspace

Then:

cd /home/runner/workspace
unzip -o pepe-game-v5.7.1-site-engine-authority-fix.zip
node ./update-pepe-game-v571.mjs
node ./verify-pepe-game-v571.mjs

Expected:

PEPE GAME V5.7.1 VERIFY: PASS (39 checks)

Then restart MEMEFLOW:

cd /home/runner/workspace/memeflow-app
npm start

ROLLBACK
--------
cd /home/runner/workspace
node ./rollback-pepe-game-v571.mjs

Then restart MEMEFLOW.

TESTED REGRESSIONS
------------------
- A BUY READY with old/missing Game freshness metadata is accepted.
- WATCH / BLOCKED / WAITING never launch.
- Missing/non-positive price never launches.
- Game volatility/crowding cannot override a higher MEMEFLOW score.
- Equal scores use decision recency only as a tie-breaker.
- MEMEFLOW kill switch remains authoritative.
- Auto Cash Out remains server-side.
- Stop Loss remains server-side.
- Stale Cash Out protection remains.
- Repeated updater is idempotent.
- Rollback restores all four changed files byte-for-byte.
