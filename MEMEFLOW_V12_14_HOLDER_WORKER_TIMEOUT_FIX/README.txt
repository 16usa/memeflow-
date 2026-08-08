MEMEFLOW V12.14 — HOLDER WORKER TIMEOUT / HEAD-OF-LINE FIX

Fixes holder queue items stuck at pending=true, attempts=0, nextDueInMs=0.

Changes:
- getProgramAccounts default timeout: 9s and method-specific AbortController timeout.
- Holder queue safety timeout: 11s, then existing retry/backoff.
- Holder queue default concurrency: 2 (RPC pacing remains active).
- Adds holderWorkerTimeouts diagnostics.
- Does NOT change user filters/settings or evaluateAll decision logic.

Install from ~/workspace:
  node MEMEFLOW_V12_14_HOLDER_WORKER_TIMEOUT_FIX/install-v12-14.mjs
  node MEMEFLOW_V12_14_HOLDER_WORKER_TIMEOUT_FIX/self-test-v12-14.mjs
  cd memeflow-app && npm start

Rollback:
  node MEMEFLOW_V12_14_HOLDER_WORKER_TIMEOUT_FIX/rollback-v12-14.mjs
