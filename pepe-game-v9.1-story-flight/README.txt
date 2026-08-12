
MEMEFLOW PEPE GAME V9.1 — Story Flight Logic Animation

What this patch changes
- Keeps the 2.5D WebGL background.
- Brings the DOM Pepe rocket back as the main hero so it stays readable on mobile.
- Links the scene to live game logic:
  * higher multiplier => rocket travels farther from Earth toward the Moon;
  * positive movement => greener flame and happier Pepe mood;
  * negative movement / danger => sad or danger mood;
  * moon / deep-space stages => Moon beacon and lunar push feeling.
- Adds a compact Pepe mood chip near the rocket.
- Leaves trading / server logic untouched.

Install
1. Upload this folder into your Replit workspace.
2. Run: node update-pepe-game-v910.mjs
3. Refresh the app.

Rollback
- node rollback-pepe-game-v910.mjs

Baseline required
- This updater expects the exact V9.0 WebGL package payload already installed.
