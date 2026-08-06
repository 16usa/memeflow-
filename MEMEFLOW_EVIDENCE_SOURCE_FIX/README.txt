MEMEFLOW EVIDENCE SOURCE FIX

This edits the real Evidence renderer inside memeflow-app/index.html.

It adds:
- Last updated
- Data freshness
- Data quality
- Data completeness
- Pump.fun
- DexScreener
- Bubble map

It preserves:
- Mint
- Source

It does not change:
- Price
- Market Chart
- Primary Candidate
- Timeline
- Memory
- Pre-trade
- Backend or trading logic

INSTALL:

cd ~/workspace
unzip -o MEMEFLOW_EVIDENCE_SOURCE_FIX.zip -d MEMEFLOW_EVIDENCE_SOURCE_FIX
node MEMEFLOW_EVIDENCE_SOURCE_FIX/install.mjs

Then restart Replit and hard-refresh Safari.

ROLLBACK:

node MEMEFLOW_EVIDENCE_SOURCE_FIX/rollback.mjs