MEMEFLOW COLD START V3

This version deliberately avoids rewriting the history-backfill and
decision-recovery expressions that caused V2.1 to fail syntax verification.

V3 changes only the confirmed PRE-LISTEN blockers:
- synchronous token warm restore default: 5000 -> 750;
- platform analytics backfill moves from module load to ~3.5s after listen;
- discovery bridge moves from module load to ~1.2s after listen.

Primary Pump discovery remains immediate after server.listen().
Permanent SQLite registry is not deleted/truncated.

Install from ~/workspace:
  unzip -o MEMEFLOW_COLD_START_V3.zip && node MEMEFLOW_COLD_START_V3/install.mjs

Then:
  Stop -> Run -> Redeploy

Rollback:
  node MEMEFLOW_COLD_START_V3/rollback.mjs

Safety:
- timestamped backup before edits;
- exact-source anchors;
- node --check on BOTH modified .mjs files;
- automatic rollback on any mismatch or syntax failure.
