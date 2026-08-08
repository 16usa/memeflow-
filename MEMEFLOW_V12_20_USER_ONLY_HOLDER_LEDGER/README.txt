MEMEFLOW V12.20 — USER-ONLY HOLDER LEDGER

What this fixes
---------------
V12.19 still allowed protocol/bonding-curve owners from token balance metadata
to enter the holder ledger. That can produce:
  holderCount = 1-2
  Top10 = 100%
even when there are more real user wallets.

V12.20 changes the fast holder path:
- ONLY Pump TradeEvent.user can become a holder.
- Bonding curve / protocol / vault owners are ignored.
- If the user's exact postTokenBalance exists, it is authoritative.
- Otherwise BUY/SELL applies the TradeEvent tokenAmount delta.
- Creator is stored separately from Pump CREATE and used for developerPct.
- Uses a NEW clean state file:
    data/event-holder-ledger-v12-20.json
  so polluted V12.17/V12.19 holder state is NOT imported.
- V12.18 market ledger is untouched.
- Legacy RPC holder worker remains fallback/repair.

INSTALL — one command at a time
-------------------------------
cd ~/workspace

unzip -o MEMEFLOW_V12_20_USER_ONLY_HOLDER_LEDGER.zip

node MEMEFLOW_V12_20_USER_ONLY_HOLDER_LEDGER/install-v12-20.mjs

node MEMEFLOW_V12_20_USER_ONLY_HOLDER_LEDGER/self-test-v12-20.mjs

pkill -9 -f '[a]pp-server\.mjs' || true

cd ~/workspace/memeflow-app

npm start

VERIFY
------
In diagnostics expect:
eventHolderLedger.version = V12.20
stateFile = event-holder-ledger-v12-20.json
loadedMints = 0 on first clean start
tradeEventsSeen increases
authoritativeUserPostBalanceUpdates and/or userBalanceUpdates increase
protocolOwnersIgnored increases
writeErrors = 0
holderSource = event-ledger-v12-20-user-only

On actively traded tokens holderCount should grow with distinct TradeEvent.user wallets.

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_V12_20_USER_ONLY_HOLDER_LEDGER/rollback-v12-20.mjs
