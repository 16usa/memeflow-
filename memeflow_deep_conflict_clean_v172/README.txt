MEMEFLOW DEEP CONFLICT CLEAN V172

Built from the ACTUAL current GitHub main state (V169).

This is not another stacked visual patch.

V172:
- normalizes active/default dark CSS at source level
- normalizes embedded <style> blocks, including the 27 legacy blocks in index.html
- preserves explicit Light-mode selector blocks
- preserves semantic red/green/blue/yellow/purple state colors
- merges V169 guardrails + structural compatibility + canonical into ONE file
- physically deletes all three V169 global CSS files
- installs exactly ONE global V172 stylesheet, LAST, on every production page
- scans all 40 top-level HTML pages for stale visual-layer links
- audits 11 production pages
- enforces dark background/module surface #000000
- enforces neutral frames/dividers 1px solid #2F3336
- enforces transparent dark header with no blur/shadow
- keeps X text hierarchy and X blue focus

No server/system restart is performed.

Install:
  unzip -o Memflow-Deep-Conflict-Clean-V172.zip && bash memeflow_deep_conflict_clean_v172/install.sh

Audit again:
  bash memeflow_deep_conflict_clean_v172/audit.sh

Rollback:
  bash memeflow_deep_conflict_clean_v172/rollback.sh
