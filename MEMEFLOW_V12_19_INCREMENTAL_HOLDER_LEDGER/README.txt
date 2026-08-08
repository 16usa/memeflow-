MEMEFLOW V12.19 — INCREMENTAL HOLDER LEDGER

Purpose
-------
Fix the remaining V12.17 holder-ledger weakness:
fresh Pump tokens often stayed at holderCount 1–2 and top10Pct 100 because the ledger
only saw token owners exposed in pre/post token balances.

V12.19 adds Pump TradeEvent user/tokenAmount accounting:
- BUY => add tokenAmount to that wallet's tracked balance
- SELL => subtract tokenAmount; delete wallet at zero
- postTokenBalances, when available, remain authoritative and prevent double counting
- holderCount is computed from positive wallet balances
- Top10% and developer% use Pump's total token supply denominator (default 1B tokens)
  instead of "tracked balances only"
- existing V12.17 persisted state is preserved and loaded
- V12.18 market ledger is not changed
- RPC holder queue remains repair/fallback only

Optional override
-----------------
PUMP_TOKEN_SUPPLY_UI=1000000000
Default is already 1,000,000,000.

INSTALL — run ONE command at a time
-----------------------------------
1)
cd ~/workspace

2)
unzip -o MEMEFLOW_V12_19_INCREMENTAL_HOLDER_LEDGER.zip

3)
node MEMEFLOW_V12_19_INCREMENTAL_HOLDER_LEDGER/install-v12-19.mjs

4)
node MEMEFLOW_V12_19_INCREMENTAL_HOLDER_LEDGER/self-test-v12-19.mjs

5)
pkill -9 -f '[a]pp-server\.mjs' || true

6)
cd ~/workspace/memeflow-app

7)
npm start

VERIFY
------
Open the existing diagnostics endpoint.

Expected:
eventHolderLedger.version = V12.19
tradeEventsSeen increases
eventBalanceUpdates increases
writeErrors = 0
holderSource = event-ledger-v12-19
holderCount should grow as distinct buyers arrive
top10Pct should no longer be forced to 100 simply because only 1–2 wallets have been observed
queueDepth should generally stay near 0 because event data handles the fast path

IMPORTANT
---------
Do not judge a brand-new token from the first 1–3 seconds alone.
The holder count is incremental from observed Pump trades and becomes more complete as trades arrive.
The old RPC path is still available for reconciliation/repair.

ROLLBACK
--------
node MEMEFLOW_V12_19_INCREMENTAL_HOLDER_LEDGER/rollback-v12-19.mjs
