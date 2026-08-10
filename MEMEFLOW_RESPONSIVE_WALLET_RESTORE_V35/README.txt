MEMEFLOW RESPONSIVE WALLET RESTORE V35

Checked against GitHub repository 16usa/memeflow-, branch main, memeflow-app/index.html.

GitHub source has:
- top Wallet: #walletConnectTop
- tablet/mobile menu Wallet: .mobile-nav [data-sheet="wallet"]
- desktop sidebar Wallet: .sidebar .nav a[href="#wallet"]

V35 restores the responsibility by breakpoint instead of moving/cloning Wallet DOM.

PHONE <=820
- keep one header Wallet
- hide bottom Wallet
- Home | Candidates | AI | Positions | More

TABLET
- hide top Wallet
- show existing bottom-menu Wallet
- Home | Candidates | AI | Positions | Wallet | More

DESKTOP
- hide top Wallet
- use existing sidebar Wallet

INSTALL
cd ~/workspace
unzip -o MEMEFLOW_RESPONSIVE_WALLET_RESTORE_V35.zip
node MEMEFLOW_RESPONSIVE_WALLET_RESTORE_V35/apply-responsive-wallet-v35.mjs
node MEMEFLOW_RESPONSIVE_WALLET_RESTORE_V35/verify-responsive-wallet-v35.mjs

Expected:
V35 INSTALL OK: 3/3
V35 VERIFY OK: 11/11

Then Stop -> Run -> hard refresh Safari.
