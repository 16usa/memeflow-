MEMEFLOW V12.12 — HOLDER ADMISSION FIX

What it fixes:
minBuyPressure will no longer prevent a fresh Pump token from entering holder enrichment.

What stays unchanged:
- user settings are not modified
- evaluateAll() still enforces minBuyPressure for the actual decision
- minHolders / Top10 / developer concentration remain part of the normal logic

Install:
1) Upload this ZIP into Replit and extract it in ~/workspace
2) Run:

cd ~/workspace
node MEMEFLOW_V12_12_HOLDER_ADMISSION_FIX/install-v12-12.mjs

3) If PASS appears, restart:

cd ~/workspace/memeflow-app
pkill -f "app-server.mjs" || true
npm start

Self-test:
cd ~/workspace
node MEMEFLOW_V12_12_HOLDER_ADMISSION_FIX/self-test-v12-12.mjs

Rollback:
cd ~/workspace
node MEMEFLOW_V12_12_HOLDER_ADMISSION_FIX/rollback-v12-12.mjs

Safety:
The installer creates a timestamped backup before editing and restores it automatically if node --check fails.
