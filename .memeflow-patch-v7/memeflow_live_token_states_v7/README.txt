MEMEFLOW — Live Token States Fix v7

Why v7 exists
-------------
The Replit workspace system-tokens.js differs from the GitHub copy, so v5's
exact old URL matcher could not find its anchor and safely rolled back.

v7 does NOT search for the old decisions URL.
It finds async function loadTokens() by JavaScript structure, balances its braces,
and replaces that function as a unit.

What v7 changes
---------------
- Adds read-only GET /api/system/live-token-states.
- Reads the newest persisted tokens from the existing JsonStore.
- Reuses/reindexes current per-user decisions when present.
- Reconstructs only missing decisions with the EXISTING canonical evaluate()
  function and the user's EXISTING settings.
- Returns all states to this monitoring page.
- Replaces only system-tokens.js loadTokens().
- Cache-busts system-tokens.js for Safari.
- Does not change thresholds, settings, BUY/SELL rules or execution behavior.
- Makes backups and rolls back automatically on any failed validation.
- Runs node --check and git diff --check.
- Commits/pushes only the three target files.

Install from ~/workspace
------------------------
rm -rf .memeflow-patch-v7 && unzip -o memeflow-live-token-states-v7.zip -d .memeflow-patch-v7 && bash .memeflow-patch-v7/memeflow_live_token_states_v7/install.sh

Expected success
----------------
[PATCH] baseline syntax OK
[PATCH] patched syntax OK
[PATCH] Live Token States contract OK
[PATCH] git diff --check OK
[PATCH] SUCCESS
[PATCH] git push OK
[PATCH] INSTALL COMPLETE
