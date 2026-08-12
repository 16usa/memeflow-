PEPE REAL RIG V16.2 — CANVAS FIX

This fixes the actual Canvas/viewport problem on iPhone Safari.

Canvas is now restricted to the center game area:
- below HUD
- above UP / IDLE / DOWN controls

It sizes from #stage.getBoundingClientRect()
and uses ResizeObserver + visualViewport.

INSTALL:
cd ~/workspace
unzip -o PEPE_REAL_RIG_V16_2_CANVAS_FIX.zip
bash PEPE_REAL_RIG_V16_2_CANVAS_FIX/install.sh

OPEN:
/character-real-test-v16.html?refresh=1620
