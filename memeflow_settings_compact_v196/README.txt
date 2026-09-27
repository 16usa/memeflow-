MEMEFLOW SYSTEM SETTINGS COMPACT SOFTWARE V196

Scope: System Settings presentation only.
No settings schema, API, backend or trading logic edits.

Important correction:
- V193 visual adapter is removed from settings.html.
- It had re-parented Execution labels and values.
- V196 keeps original Execution DOM intact, so label/value pairs stay together.
- Execution & safety remains always open.

Layout:
- Platform / AI policy / Kill switch / Theme: 4-up desktop, 2x2 mobile.
- Execution statuses: original four paired cells in 2x2 mobile grid.
- Actions: compact 2x2 matrix.
- Technical notes: compact 11px.
- Logic / Trading / Copy trading / Entry filters / Pre-open RPC / Risk & exits: compact rows.
- Footer: compact two-column actions.

Typography: 11 / 12 / 13 / 14 / 16 / 20 px only.
Fonts: Inter / Inter Tight / IBM Plex Mono only.

Install:
  unzip -o Memflow-System-Settings-Compact-V196.zip
  bash memeflow_settings_compact_v196/install.sh

Rollback:
  bash memeflow_settings_compact_v196/rollback.sh
