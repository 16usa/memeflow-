MEMEFLOW V12.2 — FRESH TOKEN PRIORITY SCHEDULER

WHY
V12.1 fixed bridge overlap:
- skippedInflight -> 0
- one bridge run at a time
- no duplicate recovery flood

But live diagnostics then showed a different problem:
- runsSkippedBusy high
- tokensDeferred high
- 20-40 second old Pump tokens still status=unknown
- pricePolling=null / decision=null for fresh tokens

That means the recovery scheduler was fair to old backlog but not fast enough
for brand-new tokens.

V12.2 FIX

TWO-LANE SCHEDULER

Lane A — FRESH PRIORITY
- newest Pump tokens <=45 seconds old
- up to 3 fresh tokens per run
- processed before old recovery work

Lane B — BACKGROUND RECOVERY
- older missed tokens
- up to 2 per run
- processed only after fresh-priority work

PER-ITEM TIMEOUT
A single slow mint cannot block the whole bridge indefinitely.
Default timeout: 12 seconds per token.

IMPORTANT
The timeout only stops waiting in the scheduler. Existing per-mint inflight
protection remains active, so the next run will not duplicate the same enrich
while it is still executing.

DOES NOT CHANGE USER SETTINGS
No changes to:
- minHolders
- maxTop10Pct
- maxDeveloperPct
- minBuyPressure
- liquidity/market-cap filters
- AI thresholds
- entry/exit rules
- position sizing
- billing/wallet rules

INSTALL

cd ~/workspace

unzip -o MEMEFLOW_V12_2_FRESH_TOKEN_PRIORITY_SCHEDULER.zip   -d MEMEFLOW_V12_2_FRESH_TOKEN_PRIORITY_SCHEDULER

node MEMEFLOW_V12_2_FRESH_TOKEN_PRIORITY_SCHEDULER/install.mjs

node MEMEFLOW_V12_2_FRESH_TOKEN_PRIORITY_SCHEDULER/self-test.mjs

REQUIRED:
ALL V12.2 SELF-TESTS PASSED

Then:
Stop -> Run

DO NOT REPUBLISH YET.

TEST AFTER 2-3 MINUTES

/api/debug/filter-pipeline-lifecycle?limit=10

EXPECTED IMPROVEMENT
For tokens older than roughly 5-15 seconds:
- schedulerLane = fresh-priority
- holderQueue should stop remaining unknown for tens of seconds
- pricePolling should appear much earlier
- decisions should begin appearing earlier

Bridge metrics should show:
- freshPriorityStarted increasing
- freshPrioritySucceeded increasing
- recoveryStarted increasing more slowly
- itemTimeouts low
- runsStarted/runsCompleted close together
- skippedInflight remains near zero

If fresh tokens still stay status=unknown after 15+ seconds even with V12.2,
the remaining bug is no longer scheduler priority. It is then inside the
specific discovery/enrich trigger path and should be fixed there directly.

ROLLBACK
node MEMEFLOW_V12_2_FRESH_TOKEN_PRIORITY_SCHEDULER/rollback.mjs
