MEMEFLOW LIVE DECISION SYNCHRONIZATION FIX

Fixes:
- API age and AI reason now use the same live age from discoveredAt.
- quoteAgeMs now measures the last successful price quote, not generic updatedAt.
- Successful price polling re-evaluates the current AI decision.
- RPC polling errors re-evaluate stale tokens into EXPIRED.

Install:
cd ~/workspace
unzip -o MEMEFLOW_LIVE_DECISION_SYNC_FIX.zip -d MEMEFLOW_LIVE_DECISION_SYNC_FIX
node MEMEFLOW_LIVE_DECISION_SYNC_FIX/install.mjs
node MEMEFLOW_LIVE_DECISION_SYNC_FIX/self-test.mjs

Then Stop -> Run in Replit.

Rollback:
node MEMEFLOW_LIVE_DECISION_SYNC_FIX/rollback.mjs
