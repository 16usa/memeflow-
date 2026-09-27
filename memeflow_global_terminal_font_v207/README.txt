MEMEFLOW GLOBAL TERMINAL FONT V207

Changes the FONT FAMILY across the ENTIRE Memflow site to IBM Plex Mono.

Font family only. It does NOT change sizes, weights, line heights, colors,
spacing, borders, cards, layout, responsive geometry, scanner, APIs or
trading logic.

Safety:
- scans every top-level HTML page
- follows the local CSS used by those pages
- changes live text families to IBM Plex Mono
- preserves known icon-font families
- protects @font-face blocks
- updates explicit JS fontFamily presentation values only
- no universal * selector
- no pseudo-element override
- shadow test before real apply
- exact backup
- strict diff guard ensures existing-file changes are font-only
- automatic rollback on real-apply error
- no restart
- no git push

Font loading:
- existing local IBM Plex Mono .woff2 is used if available
- otherwise Google Fonts is used
- monospace system fallbacks remain

Install:
  unzip -o Memflow-Global-Terminal-Font-V207.zip
  bash memeflow_global_terminal_font_v207/install.sh

Rollback:
  bash memeflow_global_terminal_font_v207/rollback.sh
