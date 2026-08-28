MEMEFLOW Live Token States Fix v5

Fixes the separate Live token states page showing zero counts.

Changes:
- Adds GET /api/system/live-token-states.
- Reuses existing per-user decisions.
- Reconstructs missing in-memory decisions from persisted tokens using the existing canonical evaluate() and current user settings.
- Changes system-tokens.js to the dedicated endpoint.
- Restores real discovery status refresh.
- Cache-busts system-tokens.js so Safari cannot keep an old candidate-only build.
- Does not change evaluator thresholds, trading settings, BUY/SELL rules, or execution logic.
- Creates a backup, checks Node syntax, runs git diff --check, commits and pushes.

Install:
rm -rf .memeflow-patch-v5 && unzip -o memeflow-live-token-states-v5.zip -d .memeflow-patch-v5 && bash .memeflow-patch-v5/memeflow_live_token_states_v5/install.sh

Expected:
[PATCH] patched syntax OK
[PATCH] Live Token States contract OK
[PATCH] git diff --check OK
[PATCH] SUCCESS
[PATCH] INSTALL COMPLETE

Then restart/redeploy Replit and hard-refresh Safari.
