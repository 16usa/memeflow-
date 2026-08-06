MEMEFLOW FINAL CLEANUP PATCH

Install from ~/workspace:

unzip -o MEMEFLOW_FINAL_CLEANUP_PATCH.zip -d MEMEFLOW_FINAL_CLEANUP_PATCH
node MEMEFLOW_FINAL_CLEANUP_PATCH/install.mjs

Then restart the Replit app and hard-refresh Safari.

Changes:
- Removes Price from AI Analysis & Market Data.
- Keeps current price only in Market Chart.
- Replaces chart token subtitle/source with “Live Solana price stream”.
- Keeps actual Source only in Evidence.
- Evidence shows Mint, Source, Last updated, Data freshness,
  Data quality, Data completeness and available external links.
- Does not change backend, API, trading logic, chart logic, Timeline or Memory.

Rollback:

node MEMEFLOW_FINAL_CLEANUP_PATCH/rollback.mjs