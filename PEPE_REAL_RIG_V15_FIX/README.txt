PEPE REAL RIG V15 FIX 1502

This replaces the broken V15 files using V14 as the clean source.

INSTALL:
cd ~/workspace
unzip -o PEPE_REAL_RIG_V15_FIX.zip
node PEPE_REAL_RIG_V15_FIX/apply-v15-fix.mjs

OPEN:
/character-real-test-v15.html?refresh=1502

IMPORTANT:
The installer runs `node --check` on both generated JS files.
If it prints "JavaScript syntax check passed", the previous blank-page
syntax failure has been removed.

ROLLBACK:
node PEPE_REAL_RIG_V15_FIX/rollback-v15.mjs
