MEMEFLOW ANTI-RUG CONFIRMATION V6

PURPOSE
Reduce entries into tokens launched only to be dumped/rugged within the first
1-3 minutes WITHOUT imposing a blind 3-minute delay on every good launch.

DESIGN
The AI must see more than one independent market snapshot before BUY READY.

FAST / NORMAL / RISKY LANES
- Strong stable launch: earliest BUY READY at 45 seconds.
- Normal launch: earliest BUY READY at 90 seconds.
- Suspicious but not yet failed: held until at least 180 seconds.
- Hard deterioration: BLOCK immediately; no waiting.

IMMEDIATE BLOCK CONDITIONS
- >=35% drawdown from local peak + weak buy pressure.
- >=35% liquidity loss during confirmation.
- >=25% holder-count loss (when baseline >=10 holders).
- Top-10 concentration increases >=12 percentage points.

STRONG 45-SECOND CONFIRMATION REQUIRES
- >=2 independent snapshots spanning >=10 seconds.
- Fresh holder snapshot.
- Holder count meets configured threshold and is not falling.
- Liquidity loss <15%.
- Top-10 increase <5 percentage points.
- Buy pressure >= max(configured threshold, 1.5x).
- Price drawdown <20%.

NORMAL
If the token is healthy but not strong enough, it waits until 90 seconds.

SUSPICIOUS
Two or more warning signals hold the token until 180 seconds.

IMPORTANT
This is not a promise that every rug can be predicted. A creator can behave
normally for several minutes and rug later. V6 reduces early-rug exposure by
requiring time-series confirmation and keeps existing stop/exit protections.

INSTALL
cd ~/workspace
unzip -o MEMEFLOW_ANTI_RUG_CONFIRMATION_V6.zip -d MEMEFLOW_ANTI_RUG_CONFIRMATION_V6
node MEMEFLOW_ANTI_RUG_CONFIRMATION_V6/install.mjs
node MEMEFLOW_ANTI_RUG_CONFIRMATION_V6/self-test.mjs

Only after:
ALL V6 SELF-TESTS PASSED

do:
Stop -> Run

EXPECTED UI / DECISION BEHAVIOR
New tokens initially remain WAITING with a reason such as:
  Anti-rug confirmation: waiting for a second independent market snapshot
or:
  Anti-rug confirmation: 37 sec remaining

A strong token can become BUY READY after ~45s.
An ordinary healthy token can become BUY READY after ~90s.
A suspicious token remains WAITING until ~180s or becomes BLOCKED immediately
if its market structure deteriorates.

ROLLBACK
node MEMEFLOW_ANTI_RUG_CONFIRMATION_V6/rollback.mjs