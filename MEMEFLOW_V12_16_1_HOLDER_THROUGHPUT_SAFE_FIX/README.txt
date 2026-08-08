MEMEFLOW V12.16.1 — SAFE HOLDER THROUGHPUT FIX

Why V12.16 failed
-----------------
The first V12.16 installer expected the older exact text "const active=new Set()".
Your current Replit V12.15.x queue has already been refactored, so the installer correctly ABORTED
before changing the file. The 9 FAIL lines were therefore self-test failures against unchanged code.

V12.16.1 is adaptive and does NOT depend on the active Set/Map implementation.

What this patch changes
-----------------------
- Raises holder queue maxConcurrent to a SAFE MINIMUM OF 4.
- Keeps V12.15.x holder worker timeout/watchdog untouched.
- Keeps retries, backoff, admission gate, holder math, user settings and decision logic untouched.
- Creates an automatic timestamped backup.
- Automatically restores the backup if node --check fails.

Install
-------
cd ~/workspace
rm -rf MEMEFLOW_V12_16_1_HOLDER_THROUGHPUT_SAFE_FIX
unzip -o MEMEFLOW_V12_16_1_HOLDER_THROUGHPUT_SAFE_FIX.zip

node MEMEFLOW_V12_16_1_HOLDER_THROUGHPUT_SAFE_FIX/install-v12-16-1.mjs
node MEMEFLOW_V12_16_1_HOLDER_THROUGHPUT_SAFE_FIX/self-test-v12-16-1.mjs

Restart cleanly
---------------
pkill -9 -f '[a]pp-server\.mjs' || true
sleep 2
cd ~/workspace/memeflow-app
npm start

After restart
-------------
Wait about 30-60 seconds and open the same diagnostic endpoint.
Expected improvement:
- holder activeCount can rise above 2 (up to 4)
- queueDepth should drain faster
- attempts should progress from 0 to 1
- holderFresh/count should appear more often
- worker timeout remains bounded and releases slots

Rollback
--------
cd ~/workspace
node MEMEFLOW_V12_16_1_HOLDER_THROUGHPUT_SAFE_FIX/rollback-v12-16-1.mjs
