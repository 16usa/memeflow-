MEMEFLOW V12.18 — EVENT MARKET LEDGER

Purpose
- Keep V12.17 holder ledger unchanged.
- Decode Pump TradeEvent directly from transaction logMessages already fetched by MEMEFLOW.
- Derive priceSol from virtual SOL/token reserves and liquiditySol from real SOL reserves.
- Maintain a 60-second event-flow buyPressure value.
- Write market data directly into the existing token store and trigger evaluation/publish.
- Existing RPC/bonding-curve price polling remains as fallback. No user settings are changed.
- Does NOT call getProgramAccounts.

Why
The public api.mainnet-beta.solana.com endpoint returns HTTP/RPC 403 for getProgramAccounts in this Replit environment, while transaction discovery works. V12.17 removed that dependency from holder snapshots. V12.18 does the same for the primary fresh-token market snapshot path.

Install from ~/workspace
1) unzip -o MEMEFLOW_V12_18_EVENT_MARKET_LEDGER.zip
2) node MEMEFLOW_V12_18_EVENT_MARKET_LEDGER/install-v12-18.mjs
3) node MEMEFLOW_V12_18_EVENT_MARKET_LEDGER/self-test-v12-18.mjs
4) stop the existing MEMEFLOW server, then start it once with: cd ~/workspace/memeflow-app && npm start

Expected live diagnostic
- eventMarketLedger.tradeEventsDecoded increases
- eventMarketLedger.marketSnapshots increases
- eventMarketLedger.lastError remains null
- fresh sample tokens begin showing market.priceSol and market.liquiditySol without waiting on getProgramAccounts
- pricePolling stays available only as fallback

Safety
Installer requires the V12.17 marker, makes a timestamped app-server backup, and runs node --check. If syntax validation fails it restores app-server automatically.
