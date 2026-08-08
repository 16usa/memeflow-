MEMEFLOW V12.15.4 — HOLDER ACTIVE SLOT FIX

Purpose
-------
This patch targets the failure mode visible in diagnostics where many holder jobs are:
  status="queued", pending=true, active=false, attempts=0, nextDueInMs=0
while the holder queue does not drain.

It replaces only makeHolderQueue() in memeflow-app/src/enrich.mjs.
It does NOT change:
- user trading settings
- minHolders / maxTop10Pct / maxDeveloperPct / minBuyPressure
- discovery logic
- price polling logic
- scoring / evaluateAll rules

What changes
------------
1. Active jobs use lease-tracked Map entries with startedAt timestamps.
2. Holder jobs have a hard worker timeout (default 12,000 ms).
3. Slot release is guaranteed in finally.
4. Releasing a slot immediately kicks drain().
5. A 250 ms watchdog detects overdue work and stale active bookkeeping.
6. Diagnostics expose activeAgeMs, activeCount, queueDepth and workerTimeoutMs.
7. Initial delay accepts sub-1000ms values (keeps 750/75ms style patches compatible).
8. First-attempt jobs remain prioritized over retries.

INSTALL FROM REPLIT SHELL
-------------------------
Run from ~/workspace:

cd ~/workspace
unzip -o MEMEFLOW_V12_15_4_HOLDER_ACTIVE_SLOT_FIX.zip

node MEMEFLOW_V12_15_4_HOLDER_ACTIVE_SLOT_FIX/install-v12-15-4.mjs
node MEMEFLOW_V12_15_4_HOLDER_ACTIVE_SLOT_FIX/self-test-v12-15-4.mjs

Then make sure only ONE app-server is running:

pkill -9 -f '[a]pp-server\.mjs' || true
sleep 2

cd ~/workspace/memeflow-app
npm start

EXPECTED SELF-TEST
------------------
All lines should say PASS.

WHAT TO CHECK IN LIVE DIAGNOSTICS
---------------------------------
For fresh tokens, holderQueue should progress:
queued -> running -> success (or timeout/retry)

The bad pattern should no longer persist for many seconds:
attempts:0 + pending:true + nextDueInMs:0

If an RPC call hangs, you should see:
- attempts increment
- active=true while running
- after timeout, slot freed and another queued job starts
- workerTimeouts/retries can increment instead of the whole queue freezing

ROLLBACK
--------
From ~/workspace:

node MEMEFLOW_V12_15_4_HOLDER_ACTIVE_SLOT_FIX/rollback-v12-15-4.mjs

Then restart the app-server.
