MEMEFLOW LOAD PERFORMANCE V1

What it fixes:
- prevents the raw/unstyled Safari flash while CSS is still arriving;
- stops forcing system-tokens.css and system-tokens.js to be downloaded again
  on every visit when they already have explicit ?v= version identifiers;
- keeps HTML and unversioned live-token assets no-store;
- creates a full backup of both touched files before changing anything;
- validates app-server.mjs with node --check and auto-restores on failure.

Install from the repository root:
  node MEMEFLOW_LOAD_PERF_V1/install.mjs

Rollback:
  node MEMEFLOW_LOAD_PERF_V1/rollback.mjs

Then restart/redeploy the Replit app.
