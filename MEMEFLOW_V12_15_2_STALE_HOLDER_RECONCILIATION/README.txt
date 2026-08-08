MEMEFLOW V12.15.2 — STALE HOLDER RECONCILIATION

This patch sits on top of V12.15.1.

It fixes the race where a holder RPC times out in the queue but later finishes
and commits holderFresh=true while a retry is still queued.

What changes:
- does NOT increase holder concurrency;
- cancels stale queued retries once durable holderFresh=true exists;
- refuses duplicate enqueue for already-fresh holder data;
- reconciles pending jobs on every drain;
- adds holderLateSucceeded metric;
- leaves user settings and evaluateAll() enforcement unchanged.

INSTALL:
cd ~/workspace
rm -rf MEMEFLOW_V12_15_2_STALE_HOLDER_RECONCILIATION
unzip -o MEMEFLOW_V12_15_2_STALE_HOLDER_RECONCILIATION.zip
node MEMEFLOW_V12_15_2_STALE_HOLDER_RECONCILIATION/install-v12-15-2.mjs
node MEMEFLOW_V12_15_2_STALE_HOLDER_RECONCILIATION/self-test-v12-15-2.mjs

RESTART ONE SERVER:
pkill -9 -f '[a]pp-server\.mjs' || true
sleep 2
cd ~/workspace/memeflow-app
npm start

ROLLBACK:
cd ~/workspace
node MEMEFLOW_V12_15_2_STALE_HOLDER_RECONCILIATION/rollback-v12-15-2.mjs
