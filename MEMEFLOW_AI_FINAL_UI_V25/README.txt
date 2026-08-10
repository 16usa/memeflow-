MEMEFLOW FINAL UI V25

FINAL REQUEST IMPLEMENTED
=========================
PHONE
  Home | Candidates | ✦ | Positions | More
  - AI = star only, no box/border/background.
  - Wallet is not in bottom nav.
  - Wallet icon is top-right.

TABLET
  Home | Candidates | ✦ AI | Positions | More
  - Same five-slot compact navigation.
  - iPad/tablet landscape is detected by coarse touch pointer up to 1366px.
  - Wallet icon is top-right.

DESKTOP
  - Bottom mobile navigation is NOT forced onto desktop.
  - AI is added to the left sidebar, immediately after Wallet (or Positions if Wallet is absent).
  - Label: ✦ AI.
  - Existing desktop Wallet remains intact.

MANUAL AI SCAN
  - "Open AI assistant" is removed completely.
  - It is not hidden as a proxy.
  - The center/sidebar AI entries open MEMEFLOW OpenAI directly.
  - Installer removes old V7–V24 UI patch script layers so they cannot recreate the old button.

AI / ANALYSIS LOGIC
  - The existing direct evaluator config is copied exactly from V18–V24.
  - V25 refuses to install if no existing direct evaluator config is found.
  - No endpoint is guessed or changed.

INSTALL
=======
cd ~/workspace
unzip -o MEMEFLOW_AI_FINAL_UI_V25.zip
node MEMEFLOW_AI_FINAL_UI_V25/apply-ai-final-ui-v25.mjs
node MEMEFLOW_AI_FINAL_UI_V25/verify-ai-final-ui-v25.mjs

Then:
Stop -> Run -> hard refresh Safari/browser.

ROLLBACK
========
cd ~/workspace
node MEMEFLOW_AI_FINAL_UI_V25/rollback-ai-final-ui-v25.mjs
