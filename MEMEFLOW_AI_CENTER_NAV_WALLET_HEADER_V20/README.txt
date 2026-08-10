MEMEFLOW AI CENTER NAV + HEADER WALLET V20

WHAT CHANGES ON MOBILE
----------------------
Bottom menu becomes:
Home | Candidates | ✦ | Positions | More

- The center ✦ opens the SAME existing MEMEFLOW OpenAI sheet.
- The large "Open AI assistant" button inside MANUAL AI SCAN is hidden on mobile.
- Wallet is removed from the bottom menu.
- Wallet is added to the top-right control row as an icon only.
- The top Wallet icon opens the SAME existing Wallet sheet.
- V19 direct evaluator config is preserved exactly; V20 does not change the analysis endpoint.

IMPORTANT
---------
V20 replaces the V19 runtime instead of stacking another AI/modal patch on top.
It reuses the V19 evaluator config, so the token-analysis logic stays unchanged.

INSTALL
-------
cd ~/workspace
unzip -o MEMEFLOW_AI_CENTER_NAV_WALLET_HEADER_V20.zip
node MEMEFLOW_AI_CENTER_NAV_WALLET_HEADER_V20/apply-ai-ui-v20.mjs

Then:
Stop -> Run -> refresh Safari.

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_AI_CENTER_NAV_WALLET_HEADER_V20/rollback-ai-ui-v20.mjs
