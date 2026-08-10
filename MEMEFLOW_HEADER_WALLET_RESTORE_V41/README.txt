MEMEFLOW Header Wallet Restore V41

Purpose:
Restore the wallet placement after the AI icon centering patches.

Expected behavior after install:
- Phone: one wallet button in the header, no Wallet in bottom nav.
- Tablet: Wallet appears in bottom nav, hidden from top header.
- Desktop: Wallet stays in the original desktop location, hidden from mobile header.

Install:
1) cd ~/workspace
2) unzip -o MEMEFLOW_HEADER_WALLET_RESTORE_V41.zip
3) node MEMEFLOW_HEADER_WALLET_RESTORE_V41/apply-header-wallet-restore-v41.mjs
4) node MEMEFLOW_HEADER_WALLET_RESTORE_V41/verify-header-wallet-restore-v41.mjs

Then Stop -> Run and hard refresh Safari.
