MEMEFLOW V12.15.1 — HOLDER QUEUE DRAIN FIX

This supersedes the broken V12.15 installer.
The V12.15 ZIP had an installer-generation bug: ${jobTimeoutMs} was interpolated
inside the installer itself, causing ReferenceError before any patch was applied.

INSTALL:
cd ~/workspace
rm -rf MEMEFLOW_V12_15_1_HOLDER_QUEUE_DRAIN_FIX
unzip -o MEMEFLOW_V12_15_1_HOLDER_QUEUE_DRAIN_FIX.zip
node MEMEFLOW_V12_15_1_HOLDER_QUEUE_DRAIN_FIX/install-v12-15-1.mjs
node MEMEFLOW_V12_15_1_HOLDER_QUEUE_DRAIN_FIX/self-test-v12-15-1.mjs

RESTART:
pkill -f "node app-server.mjs" || true
sleep 2
cd ~/workspace/memeflow-app
npm start

Expected self-test: all PASS.
