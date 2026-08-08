MEMEFLOW V12.21 — LIVE TRADE STREAM HOLDER FEED

What it fixes
-------------
V12.20 correctly excluded protocol/bonding-curve owners, but diagnostics showed
roughly 1 TradeEvent per mint. That means the holder ledger was attached mostly
to discovery/new-token transactions, not the continuing BUY/SELL stream.

V12.21 adds an independent Solana WebSocket logsSubscribe for the official
Pump program:
  6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P

Every confirmed Pump transaction signature is fetched with getTransaction and
sent through BOTH:
- V12.21 user-only holder ledger
- V12.18 market ledger

It also:
- removes the incorrect requirement that a Pump mint address must end in "pump"
- deduplicates transaction signatures
- retries briefly when getTransaction is not immediately available
- keeps bounded concurrency (default 2; max 4)
- attempts to copy creator from the existing token created by Pump CREATE
- adds liveTradeFeed diagnostics:
  notifications, signaturesProcessed, repeatTradeEvents, distinctMints,
  distinctUsers, queueDepth, active, fetchErrors, txMissing

INSTALL — ONE COMMAND AT A TIME
-------------------------------
cd ~/workspace

unzip -o MEMEFLOW_V12_21_LIVE_TRADE_STREAM_HOLDER_FEED.zip

node MEMEFLOW_V12_21_LIVE_TRADE_STREAM_HOLDER_FEED/install-v12-21.mjs

node MEMEFLOW_V12_21_LIVE_TRADE_STREAM_HOLDER_FEED/self-test-v12-21.mjs

pkill -9 -f '[a]pp-server\.mjs' || true

cd ~/workspace/memeflow-app

npm start

VERIFY
------
After 1-2 minutes diagnostics should show:
eventHolderLedger.version = V12.21
liveTradeFeed.connected = true
notifications increasing
signaturesProcessed increasing
repeatTradeEvents > 0
tradeEventsSeen should grow faster than mintsSeen
holderCount should grow above 1 on active tokens
valid Pump mints without the "pump" suffix should receive event-ledger holder data
queueDepth should remain bounded

Rollback:
cd ~/workspace
node MEMEFLOW_V12_21_LIVE_TRADE_STREAM_HOLDER_FEED/rollback-v12-21.mjs
