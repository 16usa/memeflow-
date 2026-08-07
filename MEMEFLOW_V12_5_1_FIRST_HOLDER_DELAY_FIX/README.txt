MEMEFLOW V12.5.1 — FIRST HOLDER DELAY FIX

This patch is built against the CURRENT code shown in your Replit shell.

Confirmed current wiring:
- app-server.mjs imports makeHolderQueue from ./src/enrich.mjs
- HOLDER_INITIAL_DELAY_MS default = 8000 ms
- HOLDER_RETRY_DELAY_MS default = 30000 ms
- HOLDER_MAX_RETRIES default = 8
- holder queue gets:
    initialDelayMs:HOLDER_INITIAL_DELAY_MS
    retryDelayMs:HOLDER_RETRY_DELAY_MS
    maxRetries:HOLDER_MAX_RETRIES

V12.5.1 changes ONLY:
    HOLDER_INITIAL_DELAY_MS default 8000 -> 750 ms

It DOES NOT change:
- retry delay
- max retries
- holder RPC concurrency
- queue max
- backoff
- rate-limit/circuit-breaker protection
- V12.4 fast Phase-A

INSTALL

cd ~/workspace

unzip -o MEMEFLOW_V12_5_1_FIRST_HOLDER_DELAY_FIX.zip   -d MEMEFLOW_V12_5_1_FIRST_HOLDER_DELAY_FIX

node MEMEFLOW_V12_5_1_FIRST_HOLDER_DELAY_FIX/install.mjs

node MEMEFLOW_V12_5_1_FIRST_HOLDER_DELAY_FIX/self-test.mjs

Required:
ALL V12.5.1 SELF-TESTS PASSED

Then:
Stop -> Run

Do NOT Republish yet.

After 2–3 minutes:
open /api/debug/filter-pipeline-lifecycle?limit=10

Expected for new tokens:
- pipelineStarted: true
- fastPhaseReady: true
- holderQueue status: queued/active
- attempts should move from 0 to 1 much earlier
- nextDueInMs should no longer start near 8000–10000 ms
- retry behavior after errors remains slow/protected (30s default)

IMPORTANT ABOUT ENV VARS
If Replit Secrets/Environment explicitly defines HOLDER_INITIAL_DELAY_MS,
that environment value overrides the 750 ms code default. If diagnostics still
show ~8–10 seconds after restart, check whether HOLDER_INITIAL_DELAY_MS is
explicitly set in the deployment/runtime environment.

ROLLBACK

node MEMEFLOW_V12_5_1_FIRST_HOLDER_DELAY_FIX/rollback.mjs
