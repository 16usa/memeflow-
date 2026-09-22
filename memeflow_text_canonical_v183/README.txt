MEMEFLOW DEEP TEXT CANONICAL V183

V183 fixes the real remaining conflicts caught by V182.

- Same logical @media/@supports context is deduped globally, even when it is
  split into separate physical blocks.
- Runtime element.style.color writes are converted to data-mf-tone.
- Canonical CSS owns all semantic runtime colors.
- Runtime fontSize/fontWeight/lineHeight/letterSpacing writes are removed.
- Runtime typography custom properties are removed.
- Primary Meta, AI score caption and fallback token-logo text roles are fixed
  in canonical CSS.
- Inline style="" text declarations are moved to canonical while geometry
  such as margin remains inline.
- V179 grayscale text system is preserved.
- V180 exact type scale is preserved:
  11 / 12 / 13 / 14 / 15 / 17 / 24 / 36 px.

The install is transactional. memeflow-app is unchanged unless the full V183
audit passes.

Install:
unzip -o Memflow-Deep-Text-Canonical-V183.zip && bash memeflow_text_canonical_v183/install.sh

Audit:
bash memeflow_text_canonical_v183/audit.sh

Rollback:
bash memeflow_text_canonical_v183/rollback.sh

No automatic server/system restart.
