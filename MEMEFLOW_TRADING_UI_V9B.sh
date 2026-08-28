#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_NAME="MEMEFLOW Trading UI V9B — correct frontend"
EXPECTED_REPO_FRAGMENT="16usa/memeflow-"
TARGET_BRANCH="memeflow-logo-sync"
COMMIT_MESSAGE="style(trading): quiet frames and improve compact readability"

TRADING_CSS="memeflow-app/trading.css"
TRADING_HTML="memeflow-app/trading.html"
TARGETS=("$TRADING_CSS" "$TRADING_HTML")

# Audited GitHub blobs on memeflow-logo-sync at preparation time.
EXPECTED_TRADING_CSS_BLOB="d28520a18e5d2b39d53acb3aa8a6a7f7903987c7"
EXPECTED_TRADING_HTML_BLOB="0fbc068946ecae5a09522cbf7cda64572a57c703"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this inside the MEMEFLOW Replit/Git repository."
  exit 1
fi
cd "$ROOT"

REMOTE="$(git remote get-url origin 2>/dev/null || true)"
if [[ "$REMOTE" != *"$EXPECTED_REPO_FRAGMENT"* ]]; then
  echo "ERROR: unexpected origin:"
  echo "  $REMOTE"
  exit 2
fi

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "$TARGET_BRANCH" ]]; then
  echo "ERROR: wrong branch: $BRANCH"
  echo "Expected: $TARGET_BRANCH"
  echo "Nothing changed."
  exit 3
fi

echo "==> $PATCH_NAME"
echo "==> Correct page: Trading Terminal / Trade control / Live candles"
echo "==> Branch: $BRANCH"
echo "==> Only trading.css + trading.html will be changed."
echo "==> No index.html. No JS. No trading/API/settings logic. No force-push."

git fetch origin "$TARGET_BRANCH"

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse "origin/$TARGET_BRANCH")"

if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  echo "ERROR: local branch is not at the GitHub tip."
  echo "Local : $LOCAL_HEAD"
  echo "Origin: $REMOTE_HEAD"
  echo "Nothing changed."
  exit 4
fi

if [[ -n "$(git diff --name-only --diff-filter=U)" ]]; then
  echo "ERROR: unresolved merge conflicts exist."
  exit 5
fi

if ! git diff --cached --quiet; then
  echo "ERROR: staged user changes exist. V9B will not mix them into its commit."
  echo "Run: git status"
  exit 6
fi

for p in "${TARGETS[@]}"; do
  if [[ ! -f "$p" ]]; then
    echo "ERROR: missing target: $p"
    exit 7
  fi
  if ! git diff --quiet -- "$p"; then
    echo "ERROR: $p has local edits. Refusing to overwrite it."
    exit 8
  fi
done

# Validate exact target contents instead of requiring a stale global HEAD.
CSS_BLOB="$(git rev-parse "HEAD:$TRADING_CSS")"
HTML_BLOB="$(git rev-parse "HEAD:$TRADING_HTML")"

if [[ "$CSS_BLOB" != "$EXPECTED_TRADING_CSS_BLOB" ]]; then
  echo "ERROR: trading.css changed since audit."
  echo "Expected blob: $EXPECTED_TRADING_CSS_BLOB"
  echo "Actual blob:   $CSS_BLOB"
  echo "Nothing changed."
  exit 9
fi

if [[ "$HTML_BLOB" != "$EXPECTED_TRADING_HTML_BLOB" ]]; then
  echo "ERROR: trading.html changed since audit."
  echo "Expected blob: $EXPECTED_TRADING_HTML_BLOB"
  echo "Actual blob:   $HTML_BLOB"
  echo "Nothing changed."
  exit 10
fi

BASE_SHA="$LOCAL_HEAD"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_BRANCH="backup/memeflow-trading-ui-v9b-before-$STAMP"
PATCH_COMMITTED=0

cleanup_on_error() {
  code=$?
  if [[ "$code" != "0" && "$PATCH_COMMITTED" == "0" ]]; then
    git restore --source="$BASE_SHA" --staged --worktree -- "${TARGETS[@]}" >/dev/null 2>&1 || true
  fi
  exit "$code"
}
trap cleanup_on_error EXIT

echo "==> Creating rollback branch: $BACKUP_BRANCH"
git branch "$BACKUP_BRANCH" "$BASE_SHA"
git push origin "$BACKUP_BRANCH"

python3 - <<'PY'
from pathlib import Path
import re

css_path = Path("memeflow-app/trading.css")
html_path = Path("memeflow-app/trading.html")
css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

def once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"ERROR: {label}: expected exactly 1 match, found {n}")
    return text.replace(old, new, 1)

# Canonical neutral frame variables.
css = once(
    css,
    "  --line: rgba(111, 154, 172, .15);",
    "  --line: rgba(111, 154, 172, .060);",
    "Trading --line",
)
css = once(
    css,
    "  --line-strong: rgba(111, 170, 190, .25);",
    "  --line-strong: rgba(111, 170, 190, .115);",
    "Trading --line-strong",
)

# Improve compact neutral text contrast without changing any font size.
css = once(
    css,
    "  --muted: #718894;",
    "  --muted: #91a3af;",
    "Trading --muted",
)
css = once(
    css,
    "  --faint: #455c67;",
    "  --faint: #607480;",
    "Trading --faint",
)

# Quiet only neutral hairlines.
# Green/blue/red semantic state borders are deliberately left intact.
border_pairs = [
    ("border-bottom: 1px solid rgba(111, 154, 172, .10);",
     "border-bottom: 1px solid rgba(111, 154, 172, .055);"),
    ("border-bottom: 1px solid rgba(111, 154, 172, .09);",
     "border-bottom: 1px solid rgba(111, 154, 172, .050);"),
    ("border-bottom: 1px solid rgba(111, 154, 172, .08);",
     "border-bottom: 1px solid rgba(111, 154, 172, .045);"),
    ("border-bottom: 1px solid rgba(111, 154, 172, .06);",
     "border-bottom: 1px solid rgba(111, 154, 172, .038);"),
    ("border-top: 1px solid rgba(111, 154, 172, .08);",
     "border-top: 1px solid rgba(111, 154, 172, .045);"),
    ("border-right: 1px solid rgba(111, 154, 172, .07);",
     "border-right: 1px solid rgba(111, 154, 172, .040);"),
    ("border: 1px solid rgba(111, 154, 172, .15);",
     "border: 1px solid rgba(111, 154, 172, .080);"),
    ("border: 1px solid rgba(111, 154, 172, .13);",
     "border: 1px solid rgba(111, 154, 172, .075);"),
    ("border: 1px solid rgba(111, 154, 172, .12);",
     "border: 1px solid rgba(111, 154, 172, .070);"),
    ("border: 1px solid rgba(111, 154, 172, .11);",
     "border: 1px solid rgba(111, 154, 172, .060);"),
    ("border: 1px solid rgba(111, 154, 172, .10);",
     "border: 1px solid rgba(111, 154, 172, .055);"),
]

groups = 0
for old, new in border_pairs:
    if old in css:
        css = css.replace(old, new)
        groups += 1

if groups < 8:
    raise SystemExit(
        f"ERROR: Trading CSS structure changed; only {groups} neutral border groups matched."
    )

# Secondary labels become clearer, same compact sizes.
text_pairs = [
    ("color: #56707c;", "color: #78909b;"),
    ("color: #657d88;", "color: #8497a0;"),
    ("color: #647d88;", "color: #8295a0;"),
    ("color: #526b76;", "color: #718590;"),
    ("color: #728a95;", "color: #91a4ae;"),
    ("color: #425963;", "color: #71858f;"),
    ("color: #748d98;", "color: #91a4ae;"),
    ("color: #526a75;", "color: #738893;"),
    ("color: #506874;", "color: #718691;"),
    ("color: #536c77;", "color: #748a95;"),
    ("color: #536b76;", "color: #748995;"),
    ("color: #607985;", "color: #7f939e;"),
    ("color: #465f6a;", "color: #718590;"),
    ("color: #5b7480;", "color: #7d929d;"),
]

text_matches = 0
for old, new in text_pairs:
    if old in css:
        text_matches += css.count(old)
        css = css.replace(old, new)

if text_matches < 10:
    raise SystemExit(
        f"ERROR: Trading readability anchors changed; only {text_matches} matches found."
    )

# Cache-bust only the existing canonical stylesheet.
html, n = re.subn(
    r'href="/trading\.css\?v=[^"]+"',
    'href="/trading.css?v=quiet-readable-v9b"',
    html,
    count=1,
)
if n != 1:
    raise SystemExit(f"ERROR: expected one trading.css link, found {n}")

# Prove this is the actual requested frontend.
for marker in (
    "<strong>Live candles</strong>",
    "<h2>Trade control</h2>",
    'class="panel chart-panel"',
):
    if marker not in html:
        raise SystemExit(f"ERROR: required Trading marker missing: {marker}")

css_path.write_text(css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")

print("Trading Terminal patched:")
print(" - neutral panel/control borders quieter")
print(" - compact secondary labels clearer")
print(" - font sizes unchanged")
print(" - semantic state colors unchanged")
print(" - no JavaScript or trading logic changed")
PY

echo "==> Validating..."
git diff --check -- "${TARGETS[@]}"

CHANGED="$(git diff --name-only -- "${TARGETS[@]}")"
EXPECTED="$(printf '%s\n' "${TARGETS[@]}" | sort)"
ACTUAL="$(printf '%s\n' "$CHANGED" | sort)"

if [[ "$ACTUAL" != "$EXPECTED" ]]; then
  echo "ERROR: expected exactly two changed files."
  echo "Expected:"
  printf '%s\n' "$EXPECTED"
  echo "Actual:"
  printf '%s\n' "$ACTUAL"
  exit 11
fi

# Explicitly protect previously corrected screens.
for forbidden in \
  memeflow-app/index.html \
  memeflow-app/system.css \
  memeflow-app/system.html \
  memeflow-app/system-tokens.css \
  memeflow-app/system-tokens.html \
  memeflow-app/memeflow-flow-v4.css
do
  if git diff --name-only -- | grep -qx "$forbidden"; then
    echo "ERROR: unrelated UI file changed unexpectedly: $forbidden"
    exit 12
  fi
done

git add -- "${TARGETS[@]}"
git diff --cached --check

STAGED="$(git diff --cached --name-only | sort)"
if [[ "$STAGED" != "$EXPECTED" ]]; then
  echo "ERROR: staged set is not exactly trading.css + trading.html."
  echo "$STAGED"
  exit 13
fi

echo "==> Diff stat:"
git diff --cached --stat

git commit -m "$COMMIT_MESSAGE"
NEW_SHA="$(git rev-parse HEAD)"
PATCH_COMMITTED=1

git fetch origin "$TARGET_BRANCH"
REMOTE_AFTER="$(git rev-parse "origin/$TARGET_BRANCH")"

if [[ "$REMOTE_AFTER" != "$BASE_SHA" ]]; then
  echo
  echo "ERROR: remote branch changed while V9B was running."
  echo "Local commit is safe and was NOT force-pushed:"
  echo "  $NEW_SHA"
  exit 14
fi

git push origin "HEAD:$TARGET_BRANCH"

trap - EXIT

echo
echo "SUCCESS"
echo "Trading UI commit: $NEW_SHA"
echo "Rollback branch:   $BACKUP_BRANCH"
echo
echo "Changed ONLY:"
echo " - $TRADING_CSS"
echo " - $TRADING_HTML"
echo
echo "Rollback:"
echo "  git revert $NEW_SHA"
echo "  git push origin $TARGET_BRANCH"
