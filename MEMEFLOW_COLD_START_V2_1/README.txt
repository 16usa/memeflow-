MEMEFLOW COLD START V2.1

This replaces V2 installer. V2 failed because its recovery anchor required an
exact local source layout. V2.1 uses flexible source-location matching.

Run from ~/workspace:

  unzip -o MEMEFLOW_COLD_START_V2_1.zip && node MEMEFLOW_COLD_START_V2_1/install.mjs

Then:
  Stop -> Run -> Redeploy

Rollback:
  node MEMEFLOW_COLD_START_V2_1/rollback.mjs

The installer backs up both touched files and automatically restores them if
any anchor or syntax validation fails.
