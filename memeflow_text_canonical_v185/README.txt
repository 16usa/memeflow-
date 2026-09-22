MEMEFLOW DEEP TEXT CANONICAL V185

V184 completed the CSS/HTML cleanup but its final live audit found two active
JavaScript text owners: market-chart-final-v5.js and trading.js.

V185 removes those runtime text owners. The Market Chart no longer uses Shadow
DOM or an embedded <style> block; its full component CSS is hard-scoped under
#mf-final-chart-host inside the shared canonical stylesheet. All chart text uses
the shared pure grayscale/semantic colors and the exact 8-size type scale.
Canvas axis text reads the shared 11px/font-family/grayscale tokens.

trading.js no longer writes allocationBadge.style.color. It writes semantic
data-mf-tone and canonical CSS owns the exact original green/red colors.

The candidate worktree now includes ALL top-level JS before the first audit, so
a JS failure happens before live files are replaced.

Install:
unzip -o Memflow-Deep-Text-Canonical-V185.zip && bash memeflow_text_canonical_v185/install.sh

Audit:
bash memeflow_text_canonical_v185/audit.sh

Rollback:
bash memeflow_text_canonical_v185/rollback.sh

No automatic server/system restart.
