MEMEFLOW V12.24 — CREATOR LINK + GATE + RECOVERY

What it fixes
-------------
V12.22/V12.23 already solved the main live pipeline:
- direct Pump TradeEvent decode from WebSocket
- no HTTP getTransaction hot path
- no 429 backlog
- holderCount grows correctly
- fresh Pump tokens do not use legacy holder RPC

V12.24 cleans up the remaining three issues:

1) Guaranteed creator linkage
   Whenever a token is stored/updated and the creator exists in token state,
   V12.24 pushes that creator into the event-holder ledger.
   This reduces developerPct=null cases.

2) Gate diagnostics
   Adds reusable diagnostics for:
     holders >= minHolders
     top10 <= maxTop10Pct
     developer <= maxDeveloperPct
     buyPressure >= minBuyPressure
   and exposes V12.24 diagnostic status.

3) Legacy recovery no longer scans tokens that already have a valid
   WS/event-holder snapshot, even after the 3-minute fresh window.
   This prevents pointless 12-second holder RPC timeouts on already-covered mints.

INSTALL — ONE COMMAND AT A TIME
-------------------------------
cd ~/workspace

unzip -o MEMEFLOW_V12_24_CREATOR_GATE_RECOVERY.zip

node MEMEFLOW_V12_24_CREATOR_GATE_RECOVERY/install-v12-24.mjs

node MEMEFLOW_V12_24_CREATOR_GATE_RECOVERY/self-test-v12-24.mjs

pkill -9 -f '[a]pp-server\.mjs' || true

cd ~/workspace/memeflow-app

npm start

VERIFY
------
Expected:
v12_24.version = V12.24
v12_24.creatorLinkGuaranteed = true
v12_24.legacyRepairSkipsEventHolder = true

liveTradeFeed remains:
version = V12.22
httpRpcCalls = 0
queueDepth = 0
lastError = null

eventHolderLedger:
version = V12.24
creatorLinksSet increases
writeErrors = 0

For tokens already covered by event-holder data:
legacy holder queue should not start new repair work.

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_V12_24_CREATOR_GATE_RECOVERY/rollback-v12-24.mjs
