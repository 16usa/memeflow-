MEMEFLOW EMPTY MARKET CHART FIX

Fixes the last stale-chart issue.

When there is no active Primary Candidate:
- old candles are hidden;
- old price is cleared;
- old percentage is cleared;
- old quote age is cleared;
- LIVE changes to WAITING;
- the module shows: No active token / Waiting for the next live candidate.

When a new candidate arrives, the live chart is restored automatically.

INSTALL:

cd ~/workspace
unzip -o MEMEFLOW_EMPTY_MARKET_CHART_FIX.zip -d MEMEFLOW_EMPTY_MARKET_CHART_FIX
node MEMEFLOW_EMPTY_MARKET_CHART_FIX/install.mjs
node MEMEFLOW_EMPTY_MARKET_CHART_FIX/self-test.mjs

Then restart Replit and hard-refresh Safari.

ROLLBACK:

node MEMEFLOW_EMPTY_MARKET_CHART_FIX/rollback.mjs
