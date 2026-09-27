MEMEFLOW SYSTEM SETTINGS COMPACT V208

Purpose:
Turn the long Settings page into a compact software configuration screen
without deleting or hiding any information.

Changes:
- removes card-inside-card treatment
- outer panel becomes flat
- meta area becomes a compact 2x2 mobile data strip
- settings groups use separators instead of rounded frames
- open groups get one faint surface instead of nested boxes
- each normal setting becomes a compact label/control row
- inputs/selects are 25-27px high
- switches shrink to 30x16
- Execution/account statuses become a compact 2-column matrix
- action buttons use compact 28-30px geometry
- notes become plain text with separators instead of framed cards
- footer becomes one quiet action bar
- long labels/descriptions wrap fully

Preserved:
- every field and description
- every toggle/input/select/button
- settings-page.js behavior
- account-wallet-settings.js behavior
- /api/settings
- execution controls
- semantic colors
- global IBM Plex Mono font

Typography sizes:
8 / 9 / 10 / 11 / 13 / 15 px only.

Install:
  unzip -o Memflow-System-Settings-Compact-V208.zip
  bash memeflow_settings_compact_v208/install.sh

Rollback:
  bash memeflow_settings_compact_v208/rollback.sh
