MEMEFLOW V153 — Light White Modules

Light mode only:
- Chart -> white
- Trade strategy -> white
- Open positions -> white
- Candidates -> white
- Recent trades -> white

Preserved:
- Dark mode
- module geometry/outlines
- typography
- status/P&L colors
- selected-row feedback
- trading/backend logic

Install:
  bash memeflow_v153_install_and_push.sh

The installer verifies the two target files, makes a timestamped backup,
applies the scoped CSS change, cache-busts the stylesheet URL, validates
with git diff --check, commits only the two target files, pushes, and prints
an exact rollback command.
