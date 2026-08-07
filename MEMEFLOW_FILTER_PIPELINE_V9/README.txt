MEMEFLOW FILTER PIPELINE V9

Fixes the three verified pipeline problems:

1) OPTIONAL FILTER VALUE 0 = OFF
   Example: minLiquidityUsd=0 no longer produces
   "Waiting: Liquidity USD data pending".
   The same rule applies to optional numeric min/max filters.

2) PUMP.FUN IDENTITY IS AUTHORITATIVE
   A successfully decoded Pump.fun Create instruction is stored with:
   launchPlatform='pump'
   protocol='pump'
   Later RPC/bonding-curve updates preserve these fields even though
   the descriptive source may become "Solana bonding curve" or "Solana RPC".

3) SETTINGS SAVE FORCES FRESH RE-EVALUATION
   Every cached token is re-evaluated for that exact user after settings change.
   Each resulting decision receives:
   settingsVersion
   reevaluatedAt
   The existing decision for the same mint is overwritten by the fresh result.

Diagnostic endpoint after restart:
  /api/debug/filter-pipeline

It shows the effective minLiquidityUsd, minHolders, launchPlatforms,
recent Pump-tagged token count, decision states, and a small safe token sample.

INSTALL
cd ~/workspace
unzip -o MEMEFLOW_FILTER_PIPELINE_V9.zip -d MEMEFLOW_FILTER_PIPELINE_V9
node MEMEFLOW_FILTER_PIPELINE_V9/install.mjs
node MEMEFLOW_FILTER_PIPELINE_V9/self-test.mjs

Do NOT restart unless:
ALL V9 SELF-TESTS PASSED

Then:
Stop -> Run

LIVE VERIFICATION
1. Open /api/settings and confirm your minHolders (50 is fine).
2. Open /api/debug/filter-pipeline.
3. Open /api/ai/decisions?scope=filtered&limit=20.
Expected:
- with minLiquidityUsd=0 there is no "Liquidity USD data pending" reason;
- decoded Pump creates have launchPlatform "pump";
- changing minHolders and pressing Save causes fresh decisions immediately.

ROLLBACK
node MEMEFLOW_FILTER_PIPELINE_V9/rollback.mjs
