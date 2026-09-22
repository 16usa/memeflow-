MEMEFLOW DEEP TEXT CANONICAL V182

V182 fixes the V181 transactional stop on inline style="" text declarations.
It now moves those text declarations into the canonical stylesheet using unique
ID selectors, while preserving non-text inline geometry such as margin/width.

V182 also audits every active production JavaScript file and inline script for
direct runtime text-style mutation.

MEMEFLOW DEEP TEXT CANONICAL V182

Purpose
-------
Remove old text-style ownership and historical cascade conflicts instead of
adding another visual layer.

V182:
- scans all 11 production pages;
- discovers every active linked CSS file;
- physically removes text appearance declarations from active external CSS;
- physically removes text appearance declarations from inline <style> blocks;
- moves those declarations into the single final canonical stylesheet;
- preserves original CSS order by placing external declarations before the
  existing canonical rules;
- page-scopes moved generic selectors using :where(...) so specificity is not
  artificially increased;
- preserves @media/@supports context;
- context-aware dedupes repeated exact selector/property text declarations;
- keeps the true CSS winner (!important beats normal, then later source order);
- preserves V179 pure grayscale text palette;
- preserves V180 exact 8-size type scale;
- keeps semantic colored states, link states and special text shadows;
- does not touch server/backend/JS behavior.

Canonical text-owned properties include:
font family/size/weight/style/variant/features,
line-height, letter/word spacing,
text-transform, decoration, shadow/rendering/smoothing,
text-size-adjust and color.

Audit passes only when:
- canonical V182 is last on every production page;
- no active external CSS owns a text appearance property;
- no inline <style> or style="" owns text appearance;
- no exact selector/property duplicate exists inside the same CSS context;
- V174-V180 canonical links are absent;
- the eight-size scale and pure grayscale text system remain intact.

Install
-------
unzip -o Memflow-Deep-Text-Canonical-V182.zip && bash memeflow_text_canonical_v182/install.sh

Audit
-----
bash memeflow_text_canonical_v182/audit.sh

Rollback
--------
bash memeflow_text_canonical_v182/rollback.sh

No automatic server/system restart.
