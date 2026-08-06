MEMEFLOW EVIDENCE-ONLY PATCH

This patch changes ONLY the Evidence tab.

It adds:
- Last updated
- Data freshness
- Data quality
- Data completeness
- Pump.fun link
- DexScreener link
- Bubble map link

It does NOT change:
- Price inside AI Analysis
- Market Chart subtitle/source
- Primary Candidate
- Timeline
- Memory
- Pre-trade checks
- Backend or trading logic

Install:

cd ~/workspace
unzip -o MEMEFLOW_EVIDENCE_ONLY_PATCH.zip -d MEMEFLOW_EVIDENCE_ONLY_PATCH
node MEMEFLOW_EVIDENCE_ONLY_PATCH/install.mjs

Restart the Replit app and hard-refresh Safari.

Rollback:

node MEMEFLOW_EVIDENCE_ONLY_PATCH/rollback.mjs