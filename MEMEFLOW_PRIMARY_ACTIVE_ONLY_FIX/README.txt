MEMEFLOW PRIMARY ACTIVE-ONLY FIX

Purpose:
- Never show EXPIRED, BLOCKED, REJECTED, CLOSED, IGNORED, terminal=true,
  or lifecycle=closed decisions as Primary Candidate.
- Automatically choose the next active BUY READY, WATCH, or WAITING token.
- If no active token exists, show the empty Primary Candidate state.
- Clear/switch Market Chart when the selected active token changes.

Install:

cd ~/workspace
unzip -o MEMEFLOW_PRIMARY_ACTIVE_ONLY_FIX.zip -d MEMEFLOW_PRIMARY_ACTIVE_ONLY_FIX
node MEMEFLOW_PRIMARY_ACTIVE_ONLY_FIX/install.mjs
node MEMEFLOW_PRIMARY_ACTIVE_ONLY_FIX/self-test.mjs

Then restart Replit and hard-refresh Safari.

Rollback:

node MEMEFLOW_PRIMARY_ACTIVE_ONLY_FIX/rollback.mjs
