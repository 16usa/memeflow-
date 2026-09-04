#!/usr/bin/env bash
set -euo pipefail

PATCH_NAME="MEMEFLOW token avatar row-fit v1"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_BRANCH="backup/token-avatar-fit-v1-${STAMP}"

CSS="memeflow-app/trading.css"
HTML="memeflow-app/trading.html"

echo "==> ${PATCH_NAME}"
echo "==> Checking repository..."
git rev-parse --is-inside-work-tree >/dev/null
test -f "$CSS"
test -f "$HTML"

CURRENT_BRANCH="$(git branch --show-current)"
if [ -z "$CURRENT_BRANCH" ]; then
  echo "ERROR: detached HEAD. Stop."
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: working tree has uncommitted changes."
  echo "Commit/stash them first so the backup is an exact restore point."
  exit 1
fi

echo "==> Current branch: $CURRENT_BRANCH"
echo "==> Creating remote backup branch: $BACKUP_BRANCH"
git branch "$BACKUP_BRANCH" HEAD
if ! git push origin "$BACKUP_BRANCH"; then
  git branch -D "$BACKUP_BRANCH" >/dev/null 2>&1 || true
  echo "ERROR: backup branch could not be pushed. Nothing was changed."
  exit 1
fi

echo "==> Backup pushed successfully."
echo "==> Applying scoped CSS patch..."

python3 - <<'PY'
from pathlib import Path
import re
import sys

css_path = Path("memeflow-app/trading.css")
html_path = Path("memeflow-app/trading.html")

css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

MARKER = "MEMEFLOW_TOKEN_AVATAR_ROW_FIT_V1"

if MARKER in css:
    print("Patch marker already exists; refusing to double-apply.")
    sys.exit(2)

old = "grid-template-columns: 28px minmax(0, 1fr);"
if css.count(old) != 2:
    raise SystemExit(f"Safety check failed: expected 2 occurrences of {old!r}, found {css.count(old)}")
css = css.replace(old, "grid-template-columns: 42px minmax(0, 1fr);", 2)

old_pos = "grid-template-columns: 28px minmax(0, 1fr) auto;"
if css.count(old_pos) < 1:
    raise SystemExit("Safety check failed: canonical position grid not found")
css = css.replace(old_pos, "grid-template-columns: 42px minmax(0, 1fr) auto;", 1)

avatar_block_old = '''.trade-token-avatar {
  position: relative;
  width: 28px;
  height: 28px;'''
avatar_block_new = '''.trade-token-avatar {
  position: relative;
  width: 42px;
  height: 42px;'''
if css.count(avatar_block_old) != 1:
    raise SystemExit("Safety check failed: canonical trade-token-avatar block not found exactly once")
css = css.replace(avatar_block_old, avatar_block_new, 1)

chart_avatar_old = '''.token-avatar {
  width: 38px;
  height: 38px;'''
chart_avatar_new = '''.token-avatar {
  width: 48px;
  height: 48px;'''
if css.count(chart_avatar_old) != 1:
    raise SystemExit("Safety check failed: canonical chart token-avatar block not found exactly once")
css = css.replace(chart_avatar_old, chart_avatar_new, 1)

responsive = '''

/* ===== MEMEFLOW_TOKEN_AVATAR_ROW_FIT_V1 =====
   Images fill the existing row/header height without increasing container height.
   Open positions, Candidates and Recent trades share one mobile avatar size.
   Trading/chart logic is untouched.
*/
@media (max-width: 820px) {
  .candidate {
    grid-template-columns: 46px minmax(0, 1fr);
  }

  .position-row {
    grid-template-columns: 46px minmax(0, 1fr) auto;
  }

  .bottom-history-panel .trade-row.trade-log-row {
    grid-template-columns: 46px minmax(0, 1fr);
  }

  .trade-token-avatar {
    width: 46px;
    height: 46px;
    border-radius: 11px;
  }

  .chart-head .token-avatar {
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    border-radius: 10px;
  }
}
/* ===== /MEMEFLOW_TOKEN_AVATAR_ROW_FIT_V1 ===== */
'''
css = css.rstrip() + responsive + "\n"

new_html, n = re.subn(
    r'(<link\s+rel="stylesheet"\s+href="/trading\.css\?v=)[^"]+(">)',
    r'\1token-avatar-row-fit-v1-20260903\2',
    html,
    count=1,
)
if n != 1:
    raise SystemExit(f"Safety check failed: trading.css cache-bust link expected once, changed {n}")

required = [
    "min-height: 64px;",
    "min-height: 58px;",
    "height: 64px;",
    ".chart-head {",
]
for token in required:
    if token not in css:
        raise SystemExit(f"Invariant check failed: missing {token!r}")

css_path.write_text(css, encoding="utf-8")
html_path.write_text(new_html, encoding="utf-8")

print("CSS/HTML patched.")
PY

echo "==> Validating diff..."
git diff --check

echo
git diff -- "$CSS" "$HTML"
echo

echo "==> Committing..."
git add "$CSS" "$HTML"
git commit -m "style(trading): fit token images to compact rows"

COMMIT_SHA="$(git rev-parse HEAD)"

echo "==> Pushing $CURRENT_BRANCH..."
git push origin "$CURRENT_BRANCH"

echo
echo "DONE"
echo "Commit: $COMMIT_SHA"
echo "Backup branch: $BACKUP_BRANCH"
echo
echo "Rollback options:"
echo "  1) git revert $COMMIT_SHA && git push origin $CURRENT_BRANCH"
echo "  2) restore exact pre-patch files from $BACKUP_BRANCH"
