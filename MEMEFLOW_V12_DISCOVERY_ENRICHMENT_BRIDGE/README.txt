MEMEFLOW V12 — DISCOVERY → ENRICHMENT BRIDGE

DIAGNOSIS
V10.2 showed fresh Pump-create tokens already present in store.tokens but with:
- holderQueue.status = unknown
- holderQueue.pending = false
- holderQueue.attempts = 0
- pricePolling = null
- decision = null

That means some fresh tokens reached storage but missed the enrichment pipeline.

V12 FIX
A bounded self-healing bridge watches only very recent Pump tokens already in
the current process and guarantees that missing pipeline stages are repaired:

1. Raw Pump token missing Phase A -> calls enrich(mint, curve)
2. enrich() performs supply/curve enrichment and evaluation
3. enrich() starts price lifecycle
4. enrich() enqueues holder Phase B
5. If Phase A exists but holder queue is missing -> holderQueue.enqueue(mint)
6. If Phase A exists but price timer is missing -> ensurePriceTimer(mint, curve)
7. If enriched token has no decision -> one bounded evaluation rescue

SAFETY / LOAD CONTROL
- only tokens <= 5 minutes old by default
- serial repair (no parallel RPC burst)
- full enrichment max 3 attempts per mint
- 20 sec spacing between full retries
- 45 sec spacing between holder rescue attempts
- normal queue deduplication remains active
- V11/V11.1 RPC cooldown/backoff remains authoritative

V12 DOES NOT CHANGE
- minHolders
- maxTop10Pct
- maxDeveloperPct
- minBuyPressure
- AI thresholds
- token filter semantics
- position sizing
- entry/exit rules
- owner/wallet/billing logic

INSTALL
cd ~/workspace

unzip -o MEMEFLOW_V12_DISCOVERY_ENRICHMENT_BRIDGE.zip   -d MEMEFLOW_V12_DISCOVERY_ENRICHMENT_BRIDGE

node MEMEFLOW_V12_DISCOVERY_ENRICHMENT_BRIDGE/install.mjs

node MEMEFLOW_V12_DISCOVERY_ENRICHMENT_BRIDGE/self-test.mjs

REQUIRED:
ALL V12 SELF-TESTS PASSED

Then:
Stop -> Run

DO NOT REPUBLISH YET.

LIVE TEST
Wait 60-120 seconds, then open on replit.dev:

/api/debug/filter-pipeline-lifecycle?limit=10

GOOD SIGNS
Fresh tokens should no longer remain:
  holderQueue.status = unknown
  pricePolling = null
  decision = null

Instead, within the normal delays you should see:
- holderQueue.status = queued/running/retry_wait/success
- holderQueue.attempts >= 1
- pricePolling object exists for tokens with a curve
- pricePolling.pollAttempts begins increasing slowly
- decision becomes non-null after evaluation
- holderFresh eventually true when holder RPC succeeds

Also open:
/api/discovery/status

If installed in the current server, bridgeMetrics reports:
- fullEnrichStarted / fullEnrichSucceeded
- holderRescued
- priceTimerRescued
- evaluationRescued
- lastError

ROLLBACK
node MEMEFLOW_V12_DISCOVERY_ENRICHMENT_BRIDGE/rollback.mjs
