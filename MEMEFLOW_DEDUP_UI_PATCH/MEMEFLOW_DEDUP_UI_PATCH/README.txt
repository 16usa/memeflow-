MEMEFLOW DEDUP UI PATCH

Install from ~/workspace:

unzip -o MEMEFLOW_DEDUP_UI_PATCH.zip -d MEMEFLOW_DEDUP_UI_PATCH
node MEMEFLOW_DEDUP_UI_PATCH/install.mjs

Then restart the Replit app and hard-refresh Safari.

Rollback:

node MEMEFLOW_DEDUP_UI_PATCH/rollback.mjs

What changes:
- Primary Candidate keeps AI summary, Score, Confidence, Risk, Expected RR and Momentum.
- Detailed token metrics remain in AI Analysis & Market Data.
- Evidence keeps source/reference information and removes repeated metric rows.
- Pre-trade Why locked shows execution readiness only.
- Market Chart, Timeline, Memory, APIs and trading logic are not changed.