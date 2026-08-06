MEMEFLOW EVIDENCE FIX V2

Purpose:
Fix the Evidence tab only.

Adds:
- Last updated
- Data freshness
- Data quality
- Data completeness
- Pump.fun
- DexScreener
- Bubble map

The installer disables only two earlier conflicting Evidence writers.
It does not disable the original dedup/responsibility patch.

It does not change:
- Price inside AI Analysis
- Market Chart subtitle/source
- Primary Candidate
- Timeline
- Memory
- Pre-trade checks
- Backend or trading logic

INSTALL:

cd ~/workspace
unzip -o MEMEFLOW_EVIDENCE_FIX_V2.zip -d MEMEFLOW_EVIDENCE_FIX_V2
node MEMEFLOW_EVIDENCE_FIX_V2/install.mjs

Then restart Replit and hard-refresh Safari.

ROLLBACK:

node MEMEFLOW_EVIDENCE_FIX_V2/rollback.mjs