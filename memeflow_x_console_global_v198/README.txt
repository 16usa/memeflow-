MEMEFLOW X-CONSOLE GLOBAL UI V198

Goal:
Use the visual system of X Developer Console across Memflow while keeping Memflow logic untouched.

Important:
X's proprietary Chirp font is NOT bundled. Inter is used as the single active font family.

Active type:
11 / 12 / 13 / 14 / 16 / 20 px
400 / 500 / 700
Inter only

Conflict cleanup:
- V192 stylesheet is unlinked from active HTML.
- V192 Inter + Inter Tight + IBM Plex Mono font block is removed from active HTML.
- mf-pixel-type-v192 scope is removed.
- V198 is inserted as the FINAL stylesheet on every top-level app page.
- Older page-local compact CSS can remain for geometry, while V198 owns typography/palette/common controls.

No changes:
backend / API / trading JS / analytics logic / wallet logic / server startup.

Install:
  unzip -o Memflow-X-Console-Global-UI-V198.zip
  bash memeflow_x_console_global_v198/install.sh

Rollback:
  bash memeflow_x_console_global_v198/rollback.sh
