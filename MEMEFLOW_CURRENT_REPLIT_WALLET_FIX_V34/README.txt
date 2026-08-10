MEMEFLOW CURRENT REPLIT WALLET FIX V34

WHY V33 FAILED
==============
Your terminal output says:

  V33: native GitHub #walletConnectTop is missing; refusing to continue.

So CURRENT Replit != GitHub main.
V33 stopped and restored its backups. It did not install.

V34 DOES NOT REQUIRE #walletConnectTop.

WHAT V34 FIXES
==============
The red-circled extra phone Wallet is created by:

  ensureHeaderWalletButton()

inside the AI direct evaluator runtime.

It creates:
  #mf-header-wallet-v24

V34 changes that function so it only removes injected
mf-header-wallet-v* controls and can never create one again.

FINAL LAYOUT
============
PHONE
  Home | Candidates | ✦ | Positions | More
  red-circled duplicate removed

TABLET
  Home | Candidates | ✦ AI | Positions | Wallet | More

DESKTOP
  existing desktop/sidebar Wallet behavior remains unchanged

NOT CHANGED
===========
- AI analysis
- Manual AI Scan
- API configuration
- wallet connect / verify logic
- trading logic
- Candidates
- Positions

INSTALL
=======
cd ~/workspace
unzip -o MEMEFLOW_CURRENT_REPLIT_WALLET_FIX_V34.zip
node MEMEFLOW_CURRENT_REPLIT_WALLET_FIX_V34/apply-current-replit-wallet-v34.mjs
node MEMEFLOW_CURRENT_REPLIT_WALLET_FIX_V34/verify-current-replit-wallet-v34.mjs

Expected:
  V34 INSTALL OK: 9/9
  V34 VERIFY OK: 10/10

Then:
  Stop -> Run -> hard refresh Safari

ROLLBACK
========
cd ~/workspace
node MEMEFLOW_CURRENT_REPLIT_WALLET_FIX_V34/rollback-current-replit-wallet-v34.mjs
