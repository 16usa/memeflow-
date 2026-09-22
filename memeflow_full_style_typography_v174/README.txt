MEMEFLOW FULL STYLE + TYPOGRAPHY CLEAN V174

Purpose
-------
Finish the cleanup after V173 by eliminating typography cascade conflicts.

V174 makes ONE file the sole typography owner:
  memeflow-x-canonical-v174.css

It captures the current effective typography cascade page-by-page BEFORE
stripping it, then removes direct typography declarations from every active
stylesheet and production inline <style> block.

Canonicalized:
- font family
- font size
- font weight/style/stretch/variant/features
- line height
- letter spacing
- text transform/rendering
- typography custom variables

One font family:
Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
"Segoe UI", sans-serif

Physically removed helper layers:
- memeflow-typography-rhythm-v51.css
- memeflow-type-scale-hierarchy-v52.css
- memeflow-optical-balance-v53.css
- trading-typography-v66.css
- old V169-V173 canonical files

Preserved:
- current responsive/component typography hierarchy
- Light/Dark typography conditions
- dark #000000 surfaces
- #2F3336 X neutral frames/dividers
- X neutral text colors
- semantic state colors
- geometry, 3D, responsive behavior, JS/backend logic

Transactional:
The patch transforms and audits a temporary copy first. The live app files are
replaced only after the temporary copy passes V174 audit.

Install:
  unzip -o Memflow-Full-Style-Typography-Clean-V174.zip && bash memeflow_full_style_typography_v174/install.sh

Audit:
  bash memeflow_full_style_typography_v174/audit.sh

Rollback:
  bash memeflow_full_style_typography_v174/rollback.sh

No server/system restart is performed.
