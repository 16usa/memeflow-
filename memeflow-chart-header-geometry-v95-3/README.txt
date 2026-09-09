MEMEFLOW CHART HEADER GEOMETRY V95.3
====================================

Why V95.2 stopped
-----------------
V95.2 used `git status --porcelain` and treated every untracked workspace
artifact as unrelated work.

Your workspace intentionally contains many untracked items:
- patch ZIP files;
- extracted patch folders;
- .memeflow-*-last-backup pointers;
- .memeflow reports / rollback-source pointers.

Those files are not part of the app patch and are harmless because the
installer stages exact paths only.

V95.3 correction
----------------
V95.3 guards only TRACKED modifications:

  git diff --name-only
  git diff --cached --name-only

Untracked workspace artifacts are ignored.

The installer then stages only these exact files:
- memeflow-app/trading.css
- memeflow-app/trading-visual-hierarchy-v67.css
- memeflow-app/trading.html
- memeflow-app/chart-header-geometry-v95-1.css
- memeflow-app/tests/chart-header-geometry-v95-1.mjs

It never uses `git add -A`.

It also:
- fixes the single extra EOF blank line;
- reruns V95.1/V93/V89 tests;
- runs git diff --check;
- re-checks that chart/canvas/timeframe/legend selectors are absent;
- commits and pushes.

No new visual CSS is introduced by V95.3.

Final selected-token header geometry:
- avatar: 36x36
- header: 64px
- left/right: 9px
- top/bottom around avatar: 14px
- avatar edge -> text: 17px

THE CHART ITSELF IS NOT TOUCHED.

Install
-------
  unzip -o memeflow-chart-header-geometry-v95-3.zip
  bash memeflow-chart-header-geometry-v95-3/install.sh

Rollback finalizer
------------------
  bash memeflow-chart-header-geometry-v95-3/rollback.sh

Full pre-V95 rollback
---------------------
  bash memeflow-chart-header-geometry-v95-1/rollback.sh
