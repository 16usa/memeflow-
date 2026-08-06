MEMEFLOW DEAD CANDIDATE FIX

Fixes:
- Old candidates become EXPIRED instead of waiting forever.
- Tokens down 45%+ from their tracked local peak with weak buy pressure become BLOCKED.
- Stale price feeds and inactive waiting candidates expire.
- Price peak, last price change, and last market activity are tracked in the store.
- Active decisions are sorted ahead of BLOCKED/EXPIRED decisions, so Primary Candidate moves on.

Install:
cd ~/workspace
unzip -o MEMEFLOW_DEAD_CANDIDATE_FIX.zip -d MEMEFLOW_DEAD_CANDIDATE_FIX
node MEMEFLOW_DEAD_CANDIDATE_FIX/install.mjs
node MEMEFLOW_DEAD_CANDIDATE_FIX/self-test.mjs

Then restart Replit and hard-refresh Safari.

Rollback:
node MEMEFLOW_DEAD_CANDIDATE_FIX/rollback.mjs
