MEMEFLOW WALLET LAYOUT FIX V27

EXACT FIX
=========
PHONE
- Removes every injected mf-header-wallet-v* duplicate.
- Keeps the app's original #walletConnectTop control.
- Bottom nav remains:
  Home | Candidates | ✦ | Positions | More

TABLET
- Wallet returns to its original bottom navigation.
- AI stays in the bottom navigation.
- Layout:
  Home | Candidates | ✦ AI | Positions | Wallet | More
- No injected duplicate wallet in the header.

DESKTOP
- Wallet stays in the original left sidebar.
- AI stays in the left sidebar from V26.
- No injected duplicate wallet in the header.

IMPORTANT
=========
V27 does NOT touch the AI evaluator, API endpoint, Manual AI Scan logic,
positions, candidates, wallet connection code, or core application code.
It only adds one small responsive layout runtime on top of V26.

INSTALL
=======
cd ~/workspace
unzip -o MEMEFLOW_WALLET_LAYOUT_FIX_V27.zip
node MEMEFLOW_WALLET_LAYOUT_FIX_V27/apply-wallet-layout-v27.mjs
node MEMEFLOW_WALLET_LAYOUT_FIX_V27/verify-wallet-layout-v27.mjs

Expected:
V27 INSTALL OK: 5/5
V27 VERIFY OK: 10/10

Then:
Stop -> Run -> hard refresh Safari/browser.

ROLLBACK
========
cd ~/workspace
node MEMEFLOW_WALLET_LAYOUT_FIX_V27/rollback-wallet-layout-v27.mjs
