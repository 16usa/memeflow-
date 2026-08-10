MEMEFLOW GITHUB NATIVE WALLET FIX V33

BUILT FROM THE ACTUAL GITHUB SOURCE
===================================
Repository:
  16usa/memeflow-
Branch:
  main
Production file:
  memeflow-app/index.html

The GitHub production source already contains:
  1) Native top Wallet: #walletConnectTop
  2) Native mobile Wallet route: .mobile-nav [data-sheet="wallet"]
  3) Native desktop sidebar Wallet: a[href="#wallet"]

Therefore the circled second Wallet is definitely an injected patch control,
not a required application control.

ROOT CAUSE FOUND
================
The current local AI runtime V24/V30 creates:
  #mf-header-wallet-v24
through:
  ensureHeaderWalletButton();

That is the extra Wallet shown in the phone header.

V33 FIXES THE SOURCE, NOT THE SYMPTOM
=====================================
1) Removes every ensureHeaderWalletButton(); invocation from local
   ai-direct-evaluator-v*.js runtimes.
2) Future startup retries now REMOVE injected mf-header-wallet-v* nodes
   instead of creating them.
3) Folds the desired responsive Wallet layout directly into V26:
   PHONE:
     Home | Candidates | ✦ | Positions | More
     Native #walletConnectTop remains in header.
   TABLET:
     Home | Candidates | ✦ AI | Positions | Wallet | More
   DESKTOP:
     Native GitHub sidebar Wallet remains where it was.
4) Removes obsolete V27/V31 wallet helper layers after the root fix.
5) node --check validates every changed runtime.
6) Automatic rollback restores backups on any validation failure.

NOT CHANGED
===========
- Wallet connection code
- #walletConnectTop
- mobile #sheet-wallet
- evaluator config/API endpoint
- OpenAI analysis logic
- Manual AI Scan
- Candidates / Positions
- trading logic

INSTALL
=======
cd ~/workspace
unzip -o MEMEFLOW_GITHUB_NATIVE_WALLET_FIX_V33.zip
node MEMEFLOW_GITHUB_NATIVE_WALLET_FIX_V33/apply-github-native-wallet-v33.mjs
node MEMEFLOW_GITHUB_NATIVE_WALLET_FIX_V33/verify-github-native-wallet-v33.mjs

Expected:
  V33 INSTALL OK: 9/9
  V33 VERIFY OK: 11/11

Then:
  Stop -> Run -> hard refresh Safari.

ROLLBACK
========
cd ~/workspace
node MEMEFLOW_GITHUB_NATIVE_WALLET_FIX_V33/rollback-github-native-wallet-v33.mjs
