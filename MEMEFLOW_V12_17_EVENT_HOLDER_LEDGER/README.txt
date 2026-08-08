MEMEFLOW V12.17 — EVENT HOLDER LEDGER

Run commands ONE BY ONE in Replit Shell:

1) cd ~/workspace
2) unzip -o MEMEFLOW_V12_17_EVENT_HOLDER_LEDGER.zip
3) node MEMEFLOW_V12_17_EVENT_HOLDER_LEDGER/install-v12-17.mjs
4) node MEMEFLOW_V12_17_EVENT_HOLDER_LEDGER/self-test-v12-17.mjs
5) pkill -9 -f '[a]pp-server\.mjs' || true
6) cd ~/workspace/memeflow-app
7) npm start

What it changes:
- Fresh Pump holder data comes from preTokenBalances/postTokenBalances of transactions MEMEFLOW already receives.
- Calculates holderCount, top10Pct, developerPct locally.
- Fresh token holder admission bypasses heavy getProgramAccounts when an event-ledger snapshot exists.
- Adds persistence to data/event-holder-ledger-v12-17.json.
- Existing user settings are NOT changed.
- Old/recovery tokens keep existing fallback behavior.

Verify:
Open /api/debug/filter-pipeline-lifecycle and look for eventHolderLedger metrics.
