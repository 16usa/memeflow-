#!/usr/bin/env bash
set -euo pipefail

PATCH_NAME="MEMEFLOW Token Flow left-media cards v29"
CSS="memeflow-app/system-tokens.css"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_BRANCH="backup/token-flow-left-media-v29-${STAMP}"

echo "==> ${PATCH_NAME}"
git rev-parse --is-inside-work-tree >/dev/null
test -f "$CSS"

CURRENT_BRANCH="$(git branch --show-current)"
if [ -z "$CURRENT_BRANCH" ]; then
  echo "ERROR: detached HEAD."
  exit 1
fi

if ! git diff --quiet -- "$CSS" || ! git diff --cached --quiet -- "$CSS"; then
  echo "ERROR: $CSS already has local changes."
  echo "Nothing was changed."
  echo "Run: git status --short -- $CSS"
  exit 1
fi

echo "==> Current branch: $CURRENT_BRANCH"
echo "==> Creating exact pre-patch backup branch..."

TMP_INDEX="$(mktemp)"
trap 'rm -f "$TMP_INDEX"' EXIT
rm -f "$TMP_INDEX"
GIT_INDEX_FILE="$TMP_INDEX" git read-tree HEAD
GIT_INDEX_FILE="$TMP_INDEX" git add -- "$CSS"
TREE_SHA="$(GIT_INDEX_FILE="$TMP_INDEX" git write-tree)"
PARENT_SHA="$(git rev-parse HEAD)"
BACKUP_COMMIT="$(
  printf '%s\n' "backup: exact Token Flow CSS before left-media v29" |
  git commit-tree "$TREE_SHA" -p "$PARENT_SHA"
)"
git branch "$BACKUP_BRANCH" "$BACKUP_COMMIT"

if ! git push origin "$BACKUP_BRANCH"; then
  git branch -D "$BACKUP_BRANCH" >/dev/null 2>&1 || true
  echo "ERROR: backup branch push failed. Nothing was changed."
  exit 1
fi

echo "==> Backup pushed: $BACKUP_BRANCH"
echo "==> Applying scoped CSS override..."

python3 - <<'PY'
from pathlib import Path

path = Path("memeflow-app/system-tokens.css")
css = path.read_text(encoding="utf-8")

marker = "MEMEFLOW_TOKEN_FLOW_LEFT_MEDIA_V29"
if marker in css:
    raise SystemExit("ERROR: V29 marker already exists; refusing to double-apply.")

patch = r'''

/* ===== MEMEFLOW_TOKEN_FLOW_LEFT_MEDIA_V29 =====
   Mobile Token Flow card polish only:
   - keep the existing collapsed card height;
   - use the existing vertical room for a much larger token image on the left;
   - keep all card information to the right of the image;
   - compact state badges;
   - replace only the Pump.fun logo visual with an external-link arrow.
   No token/state/trading/data logic is changed.
*/
@media (max-width: 760px) {
  .flow-token {
    min-height: 82px !important;
    padding-left: 86px !important;
  }

  .flow-token .token-avatar {
    position: absolute !important;
    left: 10px !important;
    top: 7px !important;

    width: 68px !important;
    height: 68px !important;
    min-width: 68px !important;
    min-height: 68px !important;
    max-width: 68px !important;
    max-height: 68px !important;
    flex: 0 0 68px !important;

    margin: 0 !important;
    border-radius: 12px !important;
    overflow: hidden !important;
  }

  .flow-token .token-avatar img {
    width: 100% !important;
    height: 100% !important;
    display: block !important;
    object-fit: cover !important;
    border-radius: inherit !important;
  }

  .flow-token .token-head {
    gap: 0 !important;
  }

  .flow-token .token-meta,
  .flow-token .token-top {
    min-width: 0 !important;
    width: 100% !important;
  }

  .flow-token .token-state {
    height: 14px !important;
    min-height: 14px !important;
    padding: 0 4px !important;
    border-radius: 4px !important;

    font-size: 6px !important;
    line-height: 12px !important;
    letter-spacing: .045em !important;
    white-space: nowrap !important;
  }

  .token-source-link.pump.mf-pump-logo-link {
    width: 15px !important;
    height: 15px !important;
    min-width: 15px !important;

    display: inline-grid !important;
    place-items: center !important;

    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;

    color: #81949f !important;
    text-decoration: none !important;
  }

  .token-source-link.pump.mf-pump-logo-link .mf-pump-logo {
    display: none !important;
  }

  .token-source-link.pump.mf-pump-logo-link::before {
    content: "↗";
    display: block;
    font-size: 12px;
    font-weight: 760;
    line-height: 1;
    color: currentColor;
    transform: translateY(-.5px);
  }

  .token-source-link.pump.mf-pump-logo-link:active {
    transform: scale(.90) !important;
  }
}

@media (max-width: 390px) {
  .flow-token {
    padding-left: 84px !important;
  }

  .flow-token .token-avatar {
    left: 9px !important;
    width: 68px !important;
    height: 68px !important;
    min-width: 68px !important;
    min-height: 68px !important;
    max-width: 68px !important;
    max-height: 68px !important;
  }

  .flow-token .token-state {
    height: 14px !important;
    min-height: 14px !important;
    padding-left: 3px !important;
    padding-right: 3px !important;
    font-size: 5.8px !important;
  }
}
/* ===== /MEMEFLOW_TOKEN_FLOW_LEFT_MEDIA_V29 ===== */
'''

css = css.rstrip() + patch + "\n"
path.write_text(css, encoding="utf-8")
print("CSS patched.")
PY

echo "==> Safety checks..."
grep -q "MEMEFLOW_TOKEN_FLOW_LEFT_MEDIA_V29" "$CSS"
git diff --check -- "$CSS"

CHANGED_BY_PATCH="$(git diff --name-only -- "$CSS")"
if [ "$CHANGED_BY_PATCH" != "$CSS" ]; then
  echo "ERROR: unexpected patch scope."
  exit 1
fi

echo "==> Diff summary:"
git diff --stat -- "$CSS"

echo "==> Committing ONLY $CSS ..."
git add -- "$CSS"
git commit -m "style(token-flow): enlarge left media and compact status"

COMMIT_SHA="$(git rev-parse HEAD)"

echo "==> Pushing $CURRENT_BRANCH ..."
git push origin "$CURRENT_BRANCH"

echo
echo "DONE"
echo "Commit: $COMMIT_SHA"
echo "Backup branch: $BACKUP_BRANCH"
echo "Touched: $CSS only"
echo
echo "Rollback:"
echo "  git revert $COMMIT_SHA && git push origin $CURRENT_BRANCH"
