PEPE REAL RIG V16.3 — SWAP LEFT/RIGHT LEGS

This patch is for the CURRENT V16.2 character/canvas setup.

It changes ONLY:
- left screen leg uses leg_right.png
- right screen leg uses leg_left.png

It DOES NOT change:
- Canvas / viewport
- arm pose
- hands
- head
- body
- UP / IDLE / DOWN behavior

INSTALL:
cd ~/workspace
unzip -o PEPE_REAL_RIG_V16_3_SWAP_LEGS.zip
node PEPE_REAL_RIG_V16_3_SWAP_LEGS/apply-v16-3-swap-legs.mjs

OPEN:
/character-real-test-v16.html?refresh=1630
