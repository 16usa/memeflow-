MEMEFLOW V10.2 — SAME-INSTANCE LIFECYCLE DIAGNOSTICS

WHY
With Replit Autoscale, /api/debug/filter-pipeline may hit one process and
/api/debug/token-lifecycle may hit another. That can produce found:false even
for a mint that was visible one second earlier.

V10.2 fixes the diagnostic method, not trading logic.

NEW ENDPOINT
/api/debug/filter-pipeline-lifecycle?limit=10

It returns, in ONE request from ONE process:
- recent Pump tokens present in that exact process
- holderFresh / holderCount / Top-10 / developer
- holder queue attempts/status/errors/retry timing
- price poll attempts/snapshot count/errors
- current decision for the authenticated user
- effective server settings
- process identity

INSTALL

cd ~/workspace

unzip -o MEMEFLOW_V10_2_SAME_INSTANCE_LIFECYCLE.zip   -d MEMEFLOW_V10_2_SAME_INSTANCE_LIFECYCLE

node MEMEFLOW_V10_2_SAME_INSTANCE_LIFECYCLE/install.mjs

node MEMEFLOW_V10_2_SAME_INSTANCE_LIFECYCLE/self-test.mjs

Required:
ALL V10.2 SELF-TESTS PASSED

Then:
Stop -> Run

DO NOT REPUBLISH YET.

TEST
Open on the current replit.dev address:

/api/debug/filter-pipeline-lifecycle?limit=10

No mint copying is required.

WHAT TO SEND BACK
A screenshot containing the first 2-3 objects in "sample".

HEALTHY AFTER V11/V11.1
- holderQueue.attempts >= 1
- holderQueue.lastSuccessAt != null for at least some fresh tokens
- holder.fresh = true
- holder.count numeric
- pricePolling.snapshotCount increases
- rate-limit errors are occasional rather than continuous

This patch does NOT alter:
- Settings
- RPC pacing
- V11 scheduler/backoff
- AI rules
- BUY/BLOCK/WATCH logic
- positions or execution
