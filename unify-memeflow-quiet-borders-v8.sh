#!/usr/bin/env bash
set -Eeuo pipefail

COMMIT_MESSAGE="style(ui): unify quiet borders across trading and token flow"
INDEX="memeflow-app/index.html"
TOKENS_CSS="memeflow-app/system-tokens.css"
TOKENS_HTML="memeflow-app/system-tokens.html"
TARGETS=("$INDEX" "$TOKENS_CSS" "$TOKENS_HTML")

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this inside the MEMEFLOW repository."
  exit 1
fi
cd "$ROOT"

BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
if [[ -z "$BRANCH" ]]; then
  echo "ERROR: detached HEAD."
  exit 1
fi

echo "==> MEMEFLOW UI V8"
echo "==> Main Trading + Live Token States"
echo "==> Existing canonical styles only."
echo "==> No stash. No force-push. No new CSS layer."

git fetch origin "$BRANCH"

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"
LOCAL_TREE="$(git rev-parse "HEAD^{tree}")"
REMOTE_TREE="$(git rev-parse "origin/$BRANCH^{tree}")"

if [[ "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
  if [[ "$LOCAL_TREE" == "$REMOTE_TREE" ]]; then
    echo "==> Local/remote content is identical; aligning branch pointer."
    git reset --mixed "origin/$BRANCH"
  else
    echo "ERROR: local and remote branch content differ."
    echo "Local:  $LOCAL_SHA"
    echo "Remote: $REMOTE_SHA"
    echo "Nothing changed."
    exit 1
  fi
fi

if [[ -n "$(git diff --name-only --diff-filter=U)" ]]; then
  echo "ERROR: unresolved merge conflicts exist. Nothing changed."
  exit 1
fi

# Never mix pre-staged user work into this UI commit.
if ! git diff --cached --quiet; then
  echo "ERROR: staged user changes exist. V8 will not mix them into its commit."
  echo "Run: git status"
  exit 1
fi

# Ignore unrelated dirty/untracked files, but never overwrite these three targets.
for p in "${TARGETS[@]}"; do
  if ! git diff --quiet -- "$p"; then
    echo "ERROR: $p has local edits. Refusing to overwrite it."
    exit 1
  fi
done

BASE_SHA="$(git rev-parse HEAD)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_BRANCH="backup/memeflow-site-ui-v8-before-$STAMP"

echo "==> Creating rollback branch: $BACKUP_BRANCH"
git branch "$BACKUP_BRANCH" "$BASE_SHA"
git push origin "$BACKUP_BRANCH"

python3 - <<'PY'
from pathlib import Path
import re

index_path = Path("memeflow-app/index.html")
tokens_css_path = Path("memeflow-app/system-tokens.css")
tokens_html_path = Path("memeflow-app/system-tokens.html")

index = index_path.read_text(encoding="utf-8")
tokens = tokens_css_path.read_text(encoding="utf-8")
tokens_html = tokens_html_path.read_text(encoding="utf-8")

# ------------------------------------------------------------------
# 1) MAIN TRADING
# Tighten the existing canonical Premium Mobile V1 variables.
# No selector layer is added: all existing panels/settings/controls keep
# using the same variables, just with the quieter System-page intensity.
# ------------------------------------------------------------------
old_index_root = """  --line:rgba(145,166,190,.085);
  --line2:rgba(145,166,190,.14);
  --line-soft:rgba(151,171,194,.06);
  --line-strong:rgba(151,171,194,.12);
  --ds-line:rgba(157,176,196,.085);
  --ds-line-strong:rgba(157,176,196,.14);
  --mf-hairline:rgba(255,255,255,.055);
  --mf-pm-line:rgba(145,166,190,.06);
  --mf-pm-line-strong:rgba(145,166,190,.105);"""

new_index_root = """  --line:rgba(145,166,190,.055);
  --line2:rgba(145,166,190,.095);
  --line-soft:rgba(151,171,194,.038);
  --line-strong:rgba(151,171,194,.085);
  --ds-line:rgba(157,176,196,.055);
  --ds-line-strong:rgba(157,176,196,.095);
  --mf-hairline:rgba(255,255,255,.040);
  --mf-pm-line:rgba(145,166,190,.042);
  --mf-pm-line-strong:rgba(145,166,190,.065);"""

if index.count(old_index_root) != 1:
    raise SystemExit(
        f"ERROR: expected exactly one canonical Trading variable block; "
        f"found {index.count(old_index_root)}."
    )
index = index.replace(old_index_root, new_index_root, 1)

# Slightly strengthen readability without changing font sizes.
old_muted = """  --muted:#a7b3c1;
  --ds-muted:#a7b3c1;
  --text-2:#c7d0da;
  --text-3:#a3afbd;"""
new_muted = """  --muted:#a8b5c2;
  --ds-muted:#a8b5c2;
  --text-2:#c9d2dc;
  --text-3:#a6b2bf;"""
if index.count(old_muted) != 1:
    raise SystemExit(
        f"ERROR: expected exactly one canonical Trading text block; "
        f"found {index.count(old_muted)}."
    )
index = index.replace(old_muted, new_muted, 1)

# ------------------------------------------------------------------
# 2) LIVE TOKEN STATES
# This page has its own stylesheet, so give it the same neutral frame
# intensity as System. Active semantic states remain clearly colored.
# ------------------------------------------------------------------
token_required = {
    "  --line: rgba(147, 178, 202, .16);":
        "  --line: rgba(147, 178, 202, .055);",
    "  --line-strong: rgba(147, 178, 202, .27);":
        "  --line-strong: rgba(147, 178, 202, .095);",
    "  --muted: #6f8290;":
        "  --muted: #91a3af;",
}
for old, new in token_required.items():
    count = tokens.count(old)
    if count != 1:
        raise SystemExit(f"ERROR: expected one token-flow rule, found {count}: {old.strip()}")
    tokens = tokens.replace(old, new, 1)

# Inactive state summary cards: semantic color remains, but stops reading as a box grid.
token_semantic = {
    "    rgba(77, 230, 161, .20);": "    rgba(77, 230, 161, .10);",
    "    rgba(92, 141, 255, .20);": "    rgba(92, 141, 255, .10);",
    "    rgba(255, 102, 121, .19);": "    rgba(255, 102, 121, .10);",
    # Token rows: preserve state color but calm the outline.
    "    rgba(77, 230, 161, .42);": "    rgba(77, 230, 161, .22);",
    "    rgba(92, 141, 255, .40);": "    rgba(92, 141, 255, .20);",
    "    rgba(146, 165, 178, .22);": "    rgba(146, 165, 178, .075);",
    "    rgba(255, 102, 121, .38);": "    rgba(255, 102, 121, .19);",
}
for old, new in token_semantic.items():
    count = tokens.count(old)
    if count != 1:
        raise SystemExit(f"ERROR: expected one token state border, found {count}: {old.strip()}")
    tokens = tokens.replace(old, new, 1)

# A few small neutral labels on this page are very dark. Improve contrast only.
neutral_text = {
    "  color: #738692;": "  color: #8fa1ad;",
    "  color: #627681;": "  color: #8295a1;",
    "  color: #596d79;": "  color: #788b97;",
    "  color: #637682;": "  color: #81939f;",
    "  color: #607480;": "  color: #7f929e;",
    "  color: #70838f;": "  color: #8b9da9;",
}
for old, new in neutral_text.items():
    if old in tokens:
        tokens = tokens.replace(old, new)

# ------------------------------------------------------------------
# 3) Cache-bust only the existing token-flow stylesheet.
# ------------------------------------------------------------------
tokens_html, n = re.subn(
    r'href="/system-tokens\.css\?v=[^"]+"',
    'href="/system-tokens.css?v=quiet-borders-v8"',
    tokens_html,
    count=1,
)
if n != 1:
    raise SystemExit(f"ERROR: expected one system-tokens.css link, found {n}.")

index_path.write_text(index, encoding="utf-8")
tokens_css_path.write_text(tokens, encoding="utf-8")
tokens_html_path.write_text(tokens_html, encoding="utf-8")

print("Updated canonical styles:")
print(" - Main Trading: quieter final panel/control variables")
print(" - Main Trading: slightly clearer compact secondary text")
print(" - Live Token States: quieter neutral + inactive state borders")
print(" - Live Token States: slightly clearer small neutral labels")
print(" - Token Flow CSS cache version bumped")
print(" - System page intentionally untouched")
PY

echo "==> Validating..."
git diff --check

git add -- "${TARGETS[@]}"

echo "==> Only these files will be committed:"
git diff --cached --name-only

COUNT="$(git diff --cached --name-only | wc -l | tr -d ' ')"
if [[ "$COUNT" != "3" ]]; then
  echo "ERROR: expected exactly 3 staged files, found $COUNT."
  git reset -- "${TARGETS[@]}" >/dev/null 2>&1 || true
  exit 1
fi

git commit -m "$COMMIT_MESSAGE"
NEW_SHA="$(git rev-parse HEAD)"

git fetch origin "$BRANCH"
if [[ "$(git rev-parse HEAD^)" != "$(git rev-parse "origin/$BRANCH")" ]]; then
  echo "ERROR: remote branch changed while V8 was running."
  echo "Commit is safe locally: $NEW_SHA"
  echo "No force-push was used."
  exit 1
fi

git push origin "$BRANCH"

echo
echo "SUCCESS"
echo "Site UI commit:  $NEW_SHA"
echo "Rollback branch: $BACKUP_BRANCH"
echo
echo "Affected:"
echo " - Main Trading / Settings / Trade control"
echo " - Live Token States"
echo "System page was not changed again."
echo
echo "Rollback:"
echo "  git revert $NEW_SHA"
echo "  git push origin $BRANCH"
