MEMEFLOW V12.15 — HOLDER QUEUE DRAIN / WAKE FIX

PURPOSE
Fix the observed state:
  pending=true, active=false, attempts=0, nextDueInMs=0

V12.15 changes only the holder queue worker mechanics.
It does NOT change user filters, minHolders, Top10, developer %, buy pressure
trading rule, discovery logic, or PAPER/LIVE execution logic.

INSTALL IN REPLIT SHELL
1. Upload this ZIP into ~/workspace.
2. Run:

cd ~/workspace
rm -rf MEMEFLOW_V12_15_HOLDER_QUEUE_DRAIN_FIX
unzip -o MEMEFLOW_V12_15_HOLDER_QUEUE_DRAIN_FIX.zip
node MEMEFLOW_V12_15_HOLDER_QUEUE_DRAIN_FIX/install-v12-15.mjs
node MEMEFLOW_V12_15_HOLDER_QUEUE_DRAIN_FIX/self-test-v12-15.mjs

3. Restart the server cleanly:

pkill -f "node app-server.mjs" || true
sleep 2
cd ~/workspace/memeflow-app
npm start

WHAT SHOULD CHANGE IN DIAGNOSTICS
Fresh holderQueue rows should stop sitting indefinitely at:
  attempts:0, pending:true, active:false, nextDueInMs:0

Expected lifecycle:
  queued -> running (active:true, attempts>=1) -> success/retry

New holder metrics are dynamically recorded:
  workerWakeups
  jobsStarted
  jobsCompleted
  jobsTimedOut
  stuckQueuedRescued

ROLLBACK
cd ~/workspace
node MEMEFLOW_V12_15_HOLDER_QUEUE_DRAIN_FIX/rollback-v12-15.mjs
