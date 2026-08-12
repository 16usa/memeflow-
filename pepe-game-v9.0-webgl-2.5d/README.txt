PEPE ROCKET V9.0 — 2.5D WEBGL VISUAL REBUILD

Baseline: exact V7.11.1.

What changes:
- Replaces the old CSS/canvas cinematic scene with a clean raw-WebGL renderer.
- 11 depth/FX groups: sky, deep stars, mid stars, near stars, nebula, celestial bodies, atmosphere/horizon, clouds, Pepe+rocket texture, exhaust/smoke/sparks, foreground speed/bloom.
- Uses the existing /game-assets/pepe-rocket.svg asset as the hero texture.
- READY/SCANNING/LIVE are driven by existing DOM game state and multiplier only.
- Existing HUD, trace, levels and server-authoritative game logic remain DOM/UI.
- If WebGL or the hero texture fails, the old DOM scene remains as fallback.

What does NOT change:
- game.js runtime logic is byte-identical to V7.11.1.
- game-engine.mjs, app-server.mjs, index.html and trading settings are untouched.
