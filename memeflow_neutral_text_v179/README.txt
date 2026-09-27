MEMEFLOW PURE NEUTRAL TEXT V179

V179 fixes the V178 final-audit/classification issue:
- generic words like `status` and `chart` no longer make an entire selector semantic;
- only concrete state selectors such as `.is-ready`, buy/sell, positive/negative,
  error/success, etc. preserve moderate-saturation semantic colors;
- neutral text inside chart/status blocks is converted to the 4-level grayscale;
- inline <style> blocks are audited selector-by-selector instead of blindly;
- neutral text custom variables are audited too.

MEMEFLOW PURE NEUTRAL TEXT V179

V179 fixes the false V175 audit failure seen in V177.
The old audit incorrectly treated a generic `.glass { backdrop-filter: blur(20px) }`
rule as a Settings conflict. V179 checks stale blur/background values only inside
actual Settings selectors.

MEMEFLOW PURE NEUTRAL TEXT V179

Neutral text uses ONLY four pure grayscale levels per theme.

DARK
----
1  #FFFFFF  strong headings / key values
2  #D6D6D6  primary body text
3  #A3A3A3  secondary / metadata
4  #737373  faint / tertiary

LIGHT
-----
1  #000000  strong headings / key values
2  #303030  primary body text
3  #606060  secondary / metadata
4  #8A8A8A  faint / tertiary

Every color above has R=G=B. No blue/cyan/red/green cast exists in neutral text.

Semantic colored UI is preserved:
ready/watch/status, P&L, buy/sell, errors/success, charts, links/accent states.

V179 is self-contained from local V174/V175/V176.
It replaces the current canonical file; it does not add another style layer.

Install:
unzip -o Memflow-Pure-Neutral-Text-V179.zip && bash memeflow_neutral_text_v179/install.sh

Audit:
bash memeflow_neutral_text_v179/audit.sh

Rollback:
bash memeflow_neutral_text_v179/rollback.sh

No server/system restart is performed.
