MEMEFLOW GITHUB NAV RESTORE V42

Ground truth checked in GitHub main:
Repository: 16usa/memeflow-
File: memeflow-app/index.html

GitHub has:
- #walletConnectTop inside .topbar .top-actions
- .mobile-nav [data-sheet="wallet"]
- .sidebar .nav a[href="#wallet"]
- phone CSS explicitly shows #walletConnectTop
- wallet code binds #walletConnectTop and exposes window.MEMEFLOW_WALLET.open
- canonical phone mobile-nav height is 76px / five slots

Your current Replit screenshot differs from GitHub:
- header Wallet is missing
- old stacked AI icon patches have stretched/shifted the bottom nav

V42 fixes both in ONE final UI layer and removes V35/V36/V37/V38/V39/V40/V41 script tags.
It keeps the functional AI evaluator runtime.

INSTALL
cd ~/workspace
unzip -o MEMEFLOW_GITHUB_NAV_RESTORE_V42.zip
node MEMEFLOW_GITHUB_NAV_RESTORE_V42/apply-github-nav-restore-v42.mjs
node MEMEFLOW_GITHUB_NAV_RESTORE_V42/verify-github-nav-restore-v42.mjs

Expected:
V42 INSTALL OK: 5/5
V42 VERIFY OK: 12/12

Then Stop -> Run -> hard refresh Safari.
