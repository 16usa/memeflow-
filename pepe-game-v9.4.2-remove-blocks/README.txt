PEPE GAME V9.4.2 — REMOVE BLOCKS

This fixes the black-screen regression by rebuilding from the known-working V9.2 shell.

What changed:
- V9.2 game runtime restored exactly.
- V9.2 WebGL scene renderer restored.
- New Pepe + new rocket are inline SVG; old pepe-rocket.svg is gone.
- Existing story-flight / multiplier logic remains V9.2.
- Pepe reacts to mood via vector head/eyes/arms/mouth animation.
- Preflight text overlay, big stage overlay, MOON text, and emoji status chip are hidden.
- A rich CSS fallback scene is always visible if Safari/WebGL fails.
- Fresh cache keys force Safari to load V9.4 files.

Installer accepts V9.2 or V9.3.

V9.4.1 fixes the installer verification script itself; visual payload is the V9.4 stable rebuild.


V9.4.2 removes/hides these blocks by request:
- Selector ready
- LAUNCHPAD side block (flight altimeter)
- FLIGHT VECTOR block

Implementation is visual-safe: DOM ids remain for JS stability, but the blocks are removed from view with clean CSS so no layout or runtime conflict appears.
