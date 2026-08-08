MEMEFLOW V12.23 — FRESH HOLDER WARMING + GATE DIAGNOSTICS

What this fixes
---------------
V12.22 solved the main live pipeline:
- direct WebSocket TradeEvent decode
- no getTransaction hot path
- no HTTP 429 queue
- live holderCount grows correctly

One legacy problem remained:
some brand-new Pump tokens were still sent to the old holder RPC worker before
their first WS TradeEvent arrived. Those jobs could timeout after 12 seconds.

V12.23:
1. For fresh Pump tokens, legacy holder RPC is NOT used.
2. Before the first WS holder event:
     reason = fresh_pump_holder_warming
3. Once V12.22 has a holder snapshot:
     reason = fresh_pump_event_holder_ready
4. Old/recovery tokens can still use the existing legacy repair path.
5. Adds gate diagnostics helper for:
     holders
     top10
     developer
     buyPressure
6. Does not modify V12.22 live WebSocket feed.

Default fresh event-only window
-------------------------------
180000 ms (3 minutes)

Optional:
FRESH_PUMP_EVENT_ONLY_MS=180000

INSTALL — ONE COMMAND AT A TIME
-------------------------------
cd ~/workspace

unzip -o MEMEFLOW_V12_23_FRESH_WARMING_GATE_DIAGNOSTICS.zip

node MEMEFLOW_V12_23_FRESH_WARMING_GATE_DIAGNOSTICS/install-v12-23.mjs

node MEMEFLOW_V12_23_FRESH_WARMING_GATE_DIAGNOSTICS/self-test-v12-23.mjs

pkill -9 -f '[a]pp-server\.mjs' || true

cd ~/workspace/memeflow-app

npm start

VERIFY
------
Expected:
liveTradeFeed.version = V12.22
liveTradeFeed.httpRpcCalls = 0
liveTradeFeed.queueDepth = 0

v12_23.version = V12.23
v12_23.legacyHolderRpcForFreshPump = false

Fresh Pump tokens should stop creating holder RPC timeout jobs while waiting for
their first WS-direct TradeEvent.

For an eligible token the gate logic is:
holders >= minHolders
top10 <= maxTop10Pct
developer <= maxDeveloperPct
buyPressure >= minBuyPressure

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_V12_23_FRESH_WARMING_GATE_DIAGNOSTICS/rollback-v12-23.mjs
