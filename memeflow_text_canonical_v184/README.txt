MEMEFLOW DEEP TEXT CANONICAL V184

V184 is the corrected V183 package.

The V183 transform completed the deep cleanup but its generated canonical CSS
still used the legacy comment marker:
  MEMEFLOW_TEXT_CANONICAL_V182_START

while the V183 audit correctly expected:
  MEMEFLOW_TEXT_CANONICAL_V183_START

That marker-name mismatch caused the final FAIL. Because installation is
transactional, the live memeflow-app remained on V180.

V184 fixes the marker/version consistency throughout the transform, audit,
generated canonical filename, links, runtime helper labels and generated IDs.

The deep cleanup from V183 remains:
- runtime style.color -> data-mf-tone;
- runtime fontSize/fontWeight/lineHeight/letterSpacing ownership removed;
- runtime typography custom-property writes removed;
- same logical @media/@supports contexts deduped globally;
- inline style="" text ownership moved into canonical;
- external CSS text ownership moved into one canonical;
- V179 grayscale text system preserved;
- V180 exact type scale preserved:
  11 / 12 / 13 / 14 / 15 / 17 / 24 / 36 px.

Install:
unzip -o Memflow-Deep-Text-Canonical-V184.zip && bash memeflow_text_canonical_v184/install.sh

Audit:
bash memeflow_text_canonical_v184/audit.sh

Rollback:
bash memeflow_text_canonical_v184/rollback.sh

No automatic server/system restart.
