MEMEFLOW COLD START V2

Purpose
-------
Moves expensive startup work off the Replit autoscale critical path.

What changes
------------
1. TokenRegistry cold warm restore default: 5000 -> 750 tokens.
   The permanent SQLite registry is NOT deleted or truncated. Older tokens
   remain available through existing lazy hydration.

2. Platform analytics historical backfill no longer runs before HTTP listen.
   It starts about 3.5 seconds after listen.

3. Discovery bridge no longer runs before HTTP listen.
   It starts about 1.2 seconds after listen.

4. History backfill starts about 5 seconds after listen.

5. Decision recovery starts about 7 seconds after listen.

6. Primary Pump live discovery still starts immediately after server.listen().
   Trading/risk/evaluation code is not modified.

Install
-------
From ~/workspace:

  unzip -o MEMEFLOW_COLD_START_V2.zip
  node MEMEFLOW_COLD_START_V2/install.mjs

Then restart/redeploy Replit.

Rollback
--------
  node MEMEFLOW_COLD_START_V2/rollback.mjs

Safety
------
The installer creates a timestamped backup before changing files, validates
both modified .mjs files with node --check, and automatically restores the
originals if syntax validation fails.
