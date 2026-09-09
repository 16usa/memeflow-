MEMEFLOW V154 FINAL — Trading Terminal white module surfaces

Fixes light mode only:
- Chart
- Trade strategy
- Open positions
- Candidates
- Recent trades

Important architectural change:
V154 is a NEW dedicated stylesheet loaded as the LAST stylesheet in trading.html.
That prevents older V61/V117/V121/V127 !important rules from winning the cascade.

Install from ~/workspace:
  bash memeflow_v154_white_modules_FINAL_install_and_push.sh

The installer creates a timestamped backup, modifies only:
  memeflow-app/trading.html
  memeflow-app/memeflow-trading-white-surfaces-v154.css

It validates selector coverage, confirms V154 is the final stylesheet in <head>,
runs git diff --check, commits only those two files, pushes, and prints rollback.
