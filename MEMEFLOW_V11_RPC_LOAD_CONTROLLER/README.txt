MEMEFLOW V11 — RPC LOAD CONTROLLER

V10.1 proved the bottleneck: holder scans and price polling are hitting Solana RPC connection/rate limits.

V11:
- slows global RPC pacing safely;
- treats "Connection rate limits exceeded" as retryable;
- adds provider-wide cooldown after rate limiting;
- uses exponential holder retry backoff + jitter;
- reduces background price polling to about 12s / 30s / 90s by token age;
- gives queued holder scans priority over background price polling;
- still permits periodic price snapshots so anti-rug confirmation can progress.

It does NOT change user filters, AI thresholds, position sizing, stops, take-profit rules, Pump filtering, wallet logic, or owner access.

INSTALL
cd ~/workspace
unzip -o MEMEFLOW_V11_RPC_LOAD_CONTROLLER.zip -d MEMEFLOW_V11_RPC_LOAD_CONTROLLER
node MEMEFLOW_V11_RPC_LOAD_CONTROLLER/install.mjs
node MEMEFLOW_V11_RPC_LOAD_CONTROLLER/self-test.mjs

Required:
ALL V11 SELF-TESTS PASSED

Then Stop -> Run. Do NOT republish yet.

LIVE CHECK
1. Wait for a fresh token.
2. Get a mint from /api/debug/filter-pipeline
3. Open /api/debug/token-lifecycle?mint=THE_MINT

Healthy result after 1–3 minutes:
holderQueue.lastSuccessAt != null
token.holderFresh = true
holderCount is numeric
top10Pct is numeric
pricePolling.snapshotCount grows, but pollAttempts grows much more slowly
rate-limit errors stop climbing continuously

LIMIT:
A public Solana RPC can still refuse expensive getProgramAccounts calls even after proper throttling. If holder scans remain rate-limited with V11, the next step is a second capable Solana RPC endpoint or an indexed holder-data provider.

ROLLBACK
node MEMEFLOW_V11_RPC_LOAD_CONTROLLER/rollback.mjs
