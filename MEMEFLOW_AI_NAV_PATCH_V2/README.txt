MEMEFLOW — AI Bottom Navigation Patch v2

What changed vs v1:
- Lowers the center AI button so it stays inside the bottom navigation.
- Prevents the AI button from overlapping the Manual AI Scan / content cards.
- Keeps the premium centered AI design.
- Keeps Home / Candidates / AI / Positions / Wallet.
- Keeps More available through the top-right three-dot button.
- UI only: no trading, AI evaluator, wallet, chart, candidate, scan, or API logic changes.

SHELL INSTALL / UPDATE
1) Upload MEMEFLOW_AI_BOTTOM_NAV_PATCH_v2.zip to ~/workspace
2) In Shell, from ~/workspace run:
   unzip -o MEMEFLOW_AI_BOTTOM_NAV_PATCH_v2.zip
   node MEMEFLOW_AI_NAV_PATCH_V2/apply-ai-nav-patch.mjs
3) Restart the app / Run, then hard-refresh Safari.

The installer overwrites the existing ai-bottom-nav-patch.js with v2.
It does not add a duplicate script tag if v1 is already installed.
