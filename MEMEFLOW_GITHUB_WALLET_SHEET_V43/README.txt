MEMEFLOW GITHUB WALLET SHEET V43

ROOT CAUSE CONFIRMED IN GITHUB main (16usa/memeflow- / memeflow-app/index.html):
- #walletConnectTop is wired directly to openModal -> this is the "Connect Solana wallet" provider dialog.
- #sheet-wallet is the separate full Wallet page shown in your second screenshot.
- On phone, the header Wallet icon should now open #sheet-wallet first.
- Inside that page, its Connect Wallet button can still open the provider dialog.

V43 replaces V42 (one layer, not stacked).

INSTALL:
cd ~/workspace
unzip -o MEMEFLOW_GITHUB_WALLET_SHEET_V43.zip
node MEMEFLOW_GITHUB_WALLET_SHEET_V43/apply-github-wallet-sheet-v43.mjs
node MEMEFLOW_GITHUB_WALLET_SHEET_V43/verify-github-wallet-sheet-v43.mjs

Expected:
V43 INSTALL OK: 5/5
V43 VERIFY OK: 12/12

Then Stop -> Run -> fully reload Safari.
