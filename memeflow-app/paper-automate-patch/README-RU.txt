MEMEFLOW PAPER AUTOMATE — REPLIT INSTALLATION

This package adds:
- Free PAPER Automate without wallet or Pro
- Assist proposals
- Persistent simulated positions and trades
- TP1, TP2, hard stop, trailing stop, max hold, buy-pressure exit
- Per-user PAPER APIs
- Positions UI
- Server validation for paper/live environment
- LIVE remains Pro ($49.99/month) or Owner only

INSTALL IN REPLIT SHELL

1. Upload MEMEFLOW_PAPER_AUTOMATE_INSTALLER.zip into:
   /home/runner/workspace/memeflow-app

2. In Shell:

   cd ~/workspace/memeflow-app
   unzip -o MEMEFLOW_PAPER_AUTOMATE_INSTALLER.zip -d paper-automate-patch
   node paper-automate-patch/install.mjs
   node paper-automate-patch/self-test.mjs

3. Restart using Replit:
   Stop → Run

Do not run npm start in a second Shell if port 3000 is already occupied.

ROLLBACK

The installer prints the backup folder it created:
backup-before-paper-automate-<timestamp>

To roll back, copy these files back:
- app-server.mjs
- src/store.mjs
- index.html

Then remove:
- src/paper-engine.mjs
- paper-automation-ui.js
- paper-automation-ui.css

IMPORTANT

The included self-test validates the standalone PAPER engine and installer integration points.
A live end-to-end test still requires the Replit server, its current data, and a controlled BUY READY token.
