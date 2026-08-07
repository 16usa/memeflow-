MEMEFLOW V11.1 RPC LOAD CONTROLLER REPAIR

Use this AFTER the V11 installer printed:

ABORT holder reschedule anchor missing

That means V11 changed solana.mjs, then stopped before enrich.mjs/app-server.mjs.
V11.1 is intentionally idempotent and repairs this partial state.

INSTALL

cd ~/workspace

unzip -o MEMEFLOW_V11_1_RPC_LOAD_CONTROLLER_REPAIR.zip   -d MEMEFLOW_V11_1_RPC_LOAD_CONTROLLER_REPAIR

node MEMEFLOW_V11_1_RPC_LOAD_CONTROLLER_REPAIR/install.mjs

node MEMEFLOW_V11_1_RPC_LOAD_CONTROLLER_REPAIR/self-test.mjs

Required:
ALL V11.1 SELF-TESTS PASSED

Then:
Stop -> Run

Do NOT Republish yet.

After 2-3 minutes:
1. /api/debug/filter-pipeline
2. Copy first fresh mint
3. /api/debug/token-lifecycle?mint=THE_MINT

We want:
- holderQueue attempts occurring
- holderQueue.lastSuccessAt becoming non-null
- holderFresh true
- holderCount numeric
- rate-limit errors no longer climbing continuously
- price pollAttempts growing much more slowly
