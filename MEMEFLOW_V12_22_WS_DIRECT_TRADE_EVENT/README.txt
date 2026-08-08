MEMEFLOW V12.22 — WS-DIRECT TRADE EVENT

Why
---
V12.21 proved the full Pump live stream was available over WebSocket:
15,449 notifications arrived, but public HTTP RPC processed only 6 transactions
and returned HTTP 429. The per-signature getTransaction queue grew past 15,000.

V12.22 removes that HTTP bottleneck.

New hot path
------------
Solana logsSubscribe
 -> value.logs
 -> "Program data: ..."
 -> decode Pump TradeEvent directly
 -> V12.22 user-only holder ledger
 -> direct market price/liquidity/buy-pressure update
 -> evaluate/publish

There is NO getTransaction call in the V12.22 live feed.

Expected diagnostics
--------------------
liveTradeFeed.version = V12.22
connected = true
notifications grows rapidly
tradeEventsDecoded grows rapidly
repeatTradeEvents > 0 and keeps growing
distinctUsers grows
httpRpcCalls = 0
queueDepth = 0
active = 0
lastError should NOT show HTTP 429 from the live feed

eventHolderLedger.version = V12.22
tradeEventsSeen should grow much faster than mintsSeen
userBalanceUpdates grows
holderCount should rise above 1 on actively traded tokens

INSTALL — ONE COMMAND AT A TIME
-------------------------------
cd ~/workspace

unzip -o MEMEFLOW_V12_22_WS_DIRECT_TRADE_EVENT.zip

node MEMEFLOW_V12_22_WS_DIRECT_TRADE_EVENT/install-v12-22.mjs

node MEMEFLOW_V12_22_WS_DIRECT_TRADE_EVENT/self-test-v12-22.mjs

pkill -9 -f '[a]pp-server\.mjs' || true

cd ~/workspace/memeflow-app

npm start

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_V12_22_WS_DIRECT_TRADE_EVENT/rollback-v12-22.mjs
