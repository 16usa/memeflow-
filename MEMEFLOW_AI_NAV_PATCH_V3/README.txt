MEMEFLOW AI BOTTOM NAV PATCH v3

Fixes the remaining vertical-position bug visible on iPhone/Safari:
- the AI button is actually centered inside the bottom nav
- legacy floating-button top/right/bottom/left offsets are neutralized
- only a tiny 3px visual lift remains
- old v1/v2 script tags are replaced with a cache-busted v3 URL
- More remains available from the top ••• button
- no trading, AI evaluation, Manual AI Scan, wallet, chart, or candidate logic is changed

INSTALL FROM ~/workspace:
  unzip -o MEMEFLOW_AI_BOTTOM_NAV_PATCH_v3.zip
  node MEMEFLOW_AI_NAV_PATCH_V3/apply-ai-nav-patch.mjs

Then Stop/Run and reload Safari.
