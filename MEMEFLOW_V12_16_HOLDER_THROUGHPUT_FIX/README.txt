MEMEFLOW V12.16 — HOLDER THROUGHPUT FIX

Purpose
-------
V12.15.x fixed the dead/stuck active-slot behavior. Diagnostics now show the next bottleneck:
a large holder queue, only 2 active workers, and 12s holder-worker timeouts.

V12.16 changes ONLY holder-queue scheduling/capacity. It does not change user trading settings,
holder thresholds, Top-10 limits, developer limits, buy-pressure settings, or decision logic.

What changes
------------
1. Holder worker pool minimum increases from 2 (or lower configured value) to 4.
2. Two slots are protected from recovery traffic at the default 4-worker size.
3. Fresh first-attempt holder scans inside the 15s SLA window always run before recovery.
4. Recovery remains bounded and keeps the existing retry/backoff/rate-limit behavior.
5. Existing V12.15.x worker timeout/watchdog logic is preserved.
6. Adds diagnostics through holderQueue.inspect():
   - maxConcurrent
   - freshReserved
   - freshActive
   - recoveryActive
   - oldestRunnableHolderAgeMs
   - freshHolderWaitMs
   Existing queueDepth / activeCount / workerTimeoutMs diagnostics remain.

Install from Replit Shell
-------------------------
cd ~/workspace
rm -rf MEMEFLOW_V12_16_HOLDER_THROUGHPUT_FIX
unzip -o MEMEFLOW_V12_16_HOLDER_THROUGHPUT_FIX.zip
node MEMEFLOW_V12_16_HOLDER_THROUGHPUT_FIX/install-v12-16.mjs
node MEMEFLOW_V12_16_HOLDER_THROUGHPUT_FIX/self-test-v12-16.mjs

Restart cleanly
---------------
pkill -9 -f '[a]pp-server\.mjs' || true
sleep 2
cd ~/workspace/memeflow-app
npm start

What good diagnostics should look like after 30–90 seconds
----------------------------------------------------------
- maxConcurrent: 4
- freshReserved: 2
- activeCount: 0..4
- freshActive: 0..4
- recoveryActive: never above 2 at default concurrency
- freshHolderWaitMs should normally remain well below 15000
- oldestRunnableHolderAgeMs may be higher for recovery backlog; that is acceptable
- holder attempts should move from 0 to 1 instead of sitting indefinitely
- holderFresh should start appearing on completed scans
- worker timeouts may still occur on slow RPC calls, but should release their slot and retry
- SLA misses should trend down compared with the 2-worker configuration

Rollback
--------
cd ~/workspace
node MEMEFLOW_V12_16_HOLDER_THROUGHPUT_FIX/rollback-v12-16.mjs

Safety
------
Installer refuses to run unless V12.15.x worker-timeout protection is detected.
A timestamped backup is created before editing.
If node --check fails, the installer restores the backup automatically.
