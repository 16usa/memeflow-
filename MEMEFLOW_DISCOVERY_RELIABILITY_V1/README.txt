MEMEFLOW DISCOVERY RELIABILITY V1

This patch targets the failures visible in /api/discovery/status:

- connected:false / recurring WebSocket errors
- 83 create events accepted but only 13 signatures processed
- 63 staleSignaturesDropped
- 226 RPC retries / 253 timeouts / 38 HTTP 429s
- holderSucceeded:0
- getTokenLargestAccounts rate-limit/abort failures
- liveEvaluationsPerformed:0
- liveEvaluationBatchErrors:3011
- recoveryErrors:2000
- buyPressure staying null

WHY THE LIVE EVALUATOR WAS FAILING
Persisted legacy users can exist without a settings object. JsonStore.user() only created
defaults for new users; store.settings(uid) returned undefined for old users. evaluate(token, undefined)
then throws when it reaches settings fields. Recovery/live-eval catches hid the real error.
The patch backfills and normalizes settings for every user on read.

WHY TOKENS WERE DROPPED
processSignature() waited for full enrichment before releasing the discovery queue slot.
So one create signature occupied the transaction queue while supply/curve/metadata RPC calls ran.
Under public RPC throttling, fresh signatures aged past the 120-second cutoff and were discarded.
The patch makes enrichment asynchronous after the create transaction is decoded.

WHY minHolders=30 COULD NOT WORK RELIABLY
getTokenLargestAccounts returns at most 20 token accounts. It cannot prove that a token has 30 holders.
The old code intentionally set holderCount=null when it received 20 rows, so minHolders=30 stayed WAITING.
The patch uses native Solana getProgramAccounts filtered by mint and counts positive token accounts directly.

WHY TOP-10 WAS OFTEN ~100%
The old Top-10 calculation included protocol inventory from the Pump bonding curve.
The new holder scan parses token-account authority and excludes the bonding-curve authority from
the Top-10 numerator while keeping total token supply as the denominator.

WHY RPC WAS THROTTLED
Every token could own a permanent 2-second getAccountInfo timer because successful polling refreshed
updatedAt, preventing the old timer-stop condition from ever becoming true. The patch uses:
  <3 min old, not viewed: 5 sec
  3-15 min old, not viewed: 15 sec
  >15 min old, not viewed: 60 sec
  viewed chart: configured POLL_ACTIVE_MS (default 2 sec)
  absolute background maximum: 180 min by default
It also adds a global native RPC start pacer (default one request start every 200 ms).

BUY PRESSURE WITHOUT AN INDEXER
The app already had tradeWindows but never populated it because discovery intentionally ignored
Buy/Sell transactions. Fetching every Pump trade transaction would overwhelm public RPC.
The patch derives a 60-second on-chain curve-pressure proxy from changes in bonding-curve SOL liquidity:
liquidity increase = buy pressure event; decrease = sell pressure event.
This keeps minBuyPressure useful without Helius or a third-party indexer.

INSTALL

cd ~/workspace
unzip -o MEMEFLOW_DISCOVERY_RELIABILITY_V1.zip -d MEMEFLOW_DISCOVERY_RELIABILITY_V1
node MEMEFLOW_DISCOVERY_RELIABILITY_V1/install.mjs
node MEMEFLOW_DISCOVERY_RELIABILITY_V1/self-test.mjs

Then:
Stop -> Run

VERIFY AFTER RESTART

Open:
/api/discovery/status

Within normal live operation you want to see:
connected: true
createEventsAccepted: increasing
signaturesProcessed: increasing close to signaturesQueued
staleSignaturesDropped: no longer rapidly increasing
holderSucceeded: increasing
liveEvaluationsPerformed: increasing
liveEvaluationBatchErrors: 0
decisionsInMemoryByActiveUsers: > 0

The counters are lifetime-since-process-start, so after restart they start near zero.

IMPORTANT
A public Solana RPC can still return rate limits or network errors. No code can guarantee an external
public endpoint will return zero 429/timeouts forever. This patch removes the self-inflicted request storm,
uses native RPC pacing/retries, preserves creates much longer, and makes failures observable instead of hidden.

ROLLBACK

node MEMEFLOW_DISCOVERY_RELIABILITY_V1/rollback.mjs