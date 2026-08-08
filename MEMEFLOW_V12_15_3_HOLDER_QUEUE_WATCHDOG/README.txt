MEMEFLOW V12.15.3 — HOLDER QUEUE WATCHDOG

Why this patch exists
---------------------
Fresh diagnostics after V12.15.2 still show holder jobs with:
  pending=true
  active=false
  attempts=0
  nextDueInMs=0
for many seconds.

That means admission is now working, but the queue wake/drain scheduler is
occasionally not starting due jobs.

V12.15.3 adds a 250ms safety watchdog plus an enqueue microtask kick.
It DOES NOT raise maxConcurrent and DOES NOT bypass dueAt/admission rules.

INSTALL
-------
cd ~/workspace
rm -rf MEMEFLOW_V12_15_3_HOLDER_QUEUE_WATCHDOG
unzip -o MEMEFLOW_V12_15_3_HOLDER_QUEUE_WATCHDOG.zip
node MEMEFLOW_V12_15_3_HOLDER_QUEUE_WATCHDOG/install-v12-15-3.mjs
node MEMEFLOW_V12_15_3_HOLDER_QUEUE_WATCHDOG/self-test-v12-15-3.mjs

RESTART EXACTLY ONE SERVER
--------------------------
pkill -9 -f '[a]pp-server\.mjs' || true
sleep 2
cd ~/workspace/memeflow-app
npm start

VERIFY
------
Within 15-30 seconds, recent sample rows should no longer sit at
attempts=0 with nextDueInMs=0. You should see attempts=1 and then
running/success/retry states.

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_V12_15_3_HOLDER_QUEUE_WATCHDOG/rollback-v12-15-3.mjs
