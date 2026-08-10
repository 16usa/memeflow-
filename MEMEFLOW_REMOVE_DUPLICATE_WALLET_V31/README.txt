MEMEFLOW REMOVE DUPLICATE WALLET V31

EXACT BUG
=========
On the phone header there are two Wallet icons.

The LEFT / circled one is the Wallet injected by the old AI UI runtime:
  mf-header-wallet-v24
(or another mf-header-wallet-v* version).

The RIGHT one is the app's native Wallet control.

V31
===
- removes ONLY IDs starting with mf-header-wallet-v
- preserves native #walletConnectTop
- preserves bottom-nav Wallet DOM
- preserves desktop sidebar Wallet
- changes no AI logic
- changes no Wallet connection logic
- changes no API/evaluator/trading logic
- changes no navigation layout

INSTALL
=======
cd ~/workspace
unzip -o MEMEFLOW_REMOVE_DUPLICATE_WALLET_V31.zip
node MEMEFLOW_REMOVE_DUPLICATE_WALLET_V31/apply-remove-duplicate-wallet-v31.mjs
node MEMEFLOW_REMOVE_DUPLICATE_WALLET_V31/verify-remove-duplicate-wallet-v31.mjs

Expected:
V31 INSTALL OK: 3/3
V31 VERIFY OK: 7/7

Then:
Stop -> Run -> hard refresh Safari.

ROLLBACK
========
cd ~/workspace
node MEMEFLOW_REMOVE_DUPLICATE_WALLET_V31/rollback-remove-duplicate-wallet-v31.mjs
