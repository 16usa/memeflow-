MEMEFLOW PEPE ROCKET — GAME GRAPHICS V2

1) Upload this ZIP into /home/runner/workspace in Replit.
2) In Shell run:

cd /home/runner/workspace
unzip -o pepe-game-v2.zip
node ./install-pepe-game-v2.mjs

3) Restart MEMEFLOW:

cd /home/runner/workspace/memeflow-app
npm start

4) Open /game

V2 adds:
- animated Pepe rocket SVG
- changing launchpad / sky / space / deep-space stages
- Canvas starfield and speed effects
- live trajectory line
- boost / danger motion
- 1.20x / 1.50x / 2x / 3x / 5x milestone effects
- countdown animation
- synthesized sound effects + sound toggle
- improved result / cashout / stop-loss effects
- desktop + mobile responsive layout
- keeps the existing server-authoritative PAPER Game Engine

The installer is idempotent and creates frontend backups ending in .before-graphics-v2.
