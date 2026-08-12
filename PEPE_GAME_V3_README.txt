MEMEFLOW PEPE ROCKET — GAME V3.0.0

WHAT CHANGED
- New clean V3 game UI (replaces V2 game.css instead of stacking another theme)
- More cinematic rocket stage, target lines, telemetry, mobile action dock
- Fresh BUY READY gate: stale decisions and stale prices are rejected before launch
- Safer paper cashout: server refuses to pretend a stale quote is fresh
- Fixed Cancel race that could hide a server-created live round
- Fixed status polling timer leak after completed rounds
- Lower mobile Canvas load / reduced-motion support / page visibility handling
- Negative/corrupted saved paper balance no longer magically refills
- Server still owns entry, multiplier triggers, payout and paper balance
- No real BUY/SELL execution added

INSTALL IN REPLIT
1. Upload pepe-game-v3.zip to /home/runner/workspace
2. Shell:

cd /home/runner/workspace
unzip -o pepe-game-v3.zip
node ./install-pepe-game-v3.mjs
node ./verify-pepe-game-v3.mjs

3. If verification says PASS, restart:

cd /home/runner/workspace/memeflow-app
npm start

4. Open /game

BACKUPS
The installer saves every replaced Game/core file under:
memeflow-app/.memeflow-patches/pepe-game-v3/<timestamp>/

NOTE ABOUT GITHUB
GitHub was inspected before this build. The latest repository state still does not contain the Replit-installed Game files. The GitHub connector reports push permission in repository metadata but its Contents API write call returns HTTP 403, so V3 is delivered as a Replit installer rather than pretending the repository was modified.
