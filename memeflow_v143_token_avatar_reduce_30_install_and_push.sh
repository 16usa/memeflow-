#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:---apply}"

resolve_project_dir() {
  if [ -n "${PROJECT_DIR:-}" ] && [ -d "${PROJECT_DIR}/.git" ]; then
    printf '%s\n' "$PROJECT_DIR"
    return 0
  fi

  if [ -d "$HOME/workspace/.git" ]; then
    printf '%s\n' "$HOME/workspace"
    return 0
  fi

  if git -C "$PWD" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "$PWD" rev-parse --show-toplevel
    return 0
  fi

  echo "ERROR: MemeFlow git project not found." >&2
  echo "Set PROJECT_DIR=/path/to/project and run again." >&2
  return 1
}

PROJECT_DIR="$(resolve_project_dir)"
cd "$PROJECT_DIR"

CSS="memeflow-app/trading-visual-hierarchy-v67.css"
HTML="memeflow-app/trading.html"
JS="memeflow-app/trading.js"
TARGET_FILES=("$CSS" "$HTML")

for f in "$CSS" "$HTML" "$JS"; do
  [ -f "$f" ] || { echo "ERROR: missing $f"; exit 1; }
done

BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
[ -n "$BRANCH" ] || { echo "ERROR: detached HEAD"; exit 1; }

ORIGIN="$(git remote get-url origin 2>/dev/null || true)"
case "$ORIGIN" in
  *16usa/memeflow-*) ;;
  *)
    echo "ERROR: wrong git origin: $ORIGIN"
    echo "Expected the MemeFlow repository under 16usa/memeflow-*"
    exit 1
    ;;
esac

read_only_contract_check() {
  python3 - "$CSS" "$HTML" "$JS" <<'PY'
from pathlib import Path
import re
import sys

css_path, html_path, js_path = map(Path, sys.argv[1:4])
css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

start_marker = "TRADING PUMPFUN AVATAR LINK V76"
end_marker = "/* MEMEFLOW_TRADING_VISUAL_HIERARCHY_V76_END */"

if css.count(start_marker) != 1:
    raise SystemExit(f"ERROR: expected exactly one V76 avatar block start, found {css.count(start_marker)}")
if css.count(end_marker) != 1:
    raise SystemExit(f"ERROR: expected exactly one V76 avatar block end, found {css.count(end_marker)}")

start = css.index(start_marker)
end = css.index(end_marker, start) + len(end_marker)
block = css[start:end]

required = [
    ".mf-trading-pump-avatar-link-v76",
    ".mf-trading-pump-avatar-link-v76 > .trade-token-avatar",
    ".mf-pump-avatar-badge-v76",
    "@media (max-width: 820px)",
]
for token in required:
    if token not in block:
        raise SystemExit(f"ERROR: V76 avatar contract missing: {token}")

# We support the current canonical size or an already-applied V143 size.
canonical = (
    block.count("width: 42px !important;") == 2
    and block.count("height: 42px !important;") == 2
    and block.count("width: 46px !important;") == 1
    and block.count("height: 46px !important;") == 1
)
reduced = (
    block.count("width: 29px !important;") == 2
    and block.count("height: 29px !important;") == 2
    and block.count("width: 32px !important;") == 1
    and block.count("height: 32px !important;") == 1
)
if not canonical and not reduced:
    raise SystemExit(
        "ERROR: avatar size owner is not the expected 42/46px contract or V143 29/32px contract.\n"
        "Refusing to add a competing CSS owner."
    )

# Pump.fun badge is deliberately NOT resized by V143.
if block.count("width: 16px !important;") != 1 or block.count("height: 16px !important;") != 1:
    raise SystemExit("ERROR: Pump.fun badge 16x16 contract changed; refusing patch")

# The V76 wrapper must still be used only at the three intended render sites.
render_contracts = [
    "pumpAvatarLinkMarkupV76(candidateAvatarMarkup(item)",
    "pumpAvatarLinkMarkupV76(positionAvatarMarkup(position)",
    "pumpAvatarLinkMarkupV76(avatarMarkup(avatarUrl, symbol)",
]
for token in render_contracts:
    if js.count(token) != 1:
        raise SystemExit(f"ERROR: expected exactly one render site: {token}")

# Cache-busted visual stylesheet link must be unique.
links = re.findall(r'href="/trading-visual-hierarchy-v67\.css\?v=([^"]+)"', html)
if len(links) != 1:
    raise SystemExit(f"ERROR: expected one trading visual stylesheet cache key, found {len(links)}")

if css.count("{") != css.count("}"):
    raise SystemExit("ERROR: CSS braces are unbalanced before patch")

state = "already reduced (29 desktop / 32 mobile)" if reduced else "current canonical (42 desktop / 46 mobile)"
print("V143 preflight contract: OK")
print("Avatar state:", state)
print("Scope: Open positions + Candidates + Recent trades only")
print("Pump.fun badge: preserved at 16x16")
print("Row/card geometry: untouched")
print("Current visual CSS cache key:", links[0])
PY
}

post_patch_verify() {
  python3 - "$CSS" "$HTML" "$JS" <<'PY'
from pathlib import Path
import re
import sys

css_path, html_path, js_path = map(Path, sys.argv[1:4])
css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

start_marker = "TRADING PUMPFUN AVATAR LINK V76"
end_marker = "/* MEMEFLOW_TRADING_VISUAL_HIERARCHY_V76_END */"
start = css.index(start_marker)
end = css.index(end_marker, start) + len(end_marker)
block = css[start:end]

checks = {
    "desktop wrapper/avatar width 29": block.count("width: 29px !important;") == 2,
    "desktop wrapper/avatar height 29": block.count("height: 29px !important;") == 2,
    "mobile wrapper/avatar width 32": block.count("width: 32px !important;") == 1,
    "mobile wrapper/avatar height 32": block.count("height: 32px !important;") == 1,
    "old 42 width removed from V76": "width: 42px !important;" not in block,
    "old 42 height removed from V76": "height: 42px !important;" not in block,
    "old 46 width removed from V76": "width: 46px !important;" not in block,
    "old 46 height removed from V76": "height: 46px !important;" not in block,
    "Pump badge width preserved": block.count("width: 16px !important;") == 1,
    "Pump badge height preserved": block.count("height: 16px !important;") == 1,
    "CSS braces balanced": css.count("{") == css.count("}"),
}
for name, ok in checks.items():
    if not ok:
        raise SystemExit("ERROR: post-patch verification failed: " + name)

for token in (
    "pumpAvatarLinkMarkupV76(candidateAvatarMarkup(item)",
    "pumpAvatarLinkMarkupV76(positionAvatarMarkup(position)",
    "pumpAvatarLinkMarkupV76(avatarMarkup(avatarUrl, symbol)",
):
    if js.count(token) != 1:
        raise SystemExit("ERROR: render scope changed unexpectedly: " + token)

links = re.findall(r'href="/trading-visual-hierarchy-v67\.css\?v=([^"]+)"', html)
if links != ["token-avatar-70-v143-20260908"]:
    raise SystemExit(f"ERROR: V143 cache key incorrect: {links}")

print("V143 static verification: OK")
print("Desktop avatar: 42px -> 29px  (~31% smaller)")
print("Mobile avatar : 46px -> 32px  (~30% smaller)")
print("Pump.fun badge: unchanged 16px")
print("No row height, spacing, typography, color, JS, or backend changes")
PY
}

rollback_contract_verify() {
  python3 - "$CSS" <<'PY'
from pathlib import Path
import sys

css = Path(sys.argv[1]).read_text(encoding="utf-8")
start_marker = "TRADING PUMPFUN AVATAR LINK V76"
end_marker = "/* MEMEFLOW_TRADING_VISUAL_HIERARCHY_V76_END */"
start = css.index(start_marker)
end = css.index(end_marker, start) + len(end_marker)
block = css[start:end]

required_counts = {
    "width: 42px !important;": 2,
    "height: 42px !important;": 2,
    "width: 46px !important;": 1,
    "height: 46px !important;": 1,
    "width: 16px !important;": 1,
    "height: 16px !important;": 1,
}
for token, count in required_counts.items():
    if block.count(token) != count:
        raise SystemExit(f"ERROR: rollback verification failed for {token}: got {block.count(token)}, expected {count}")
if css.count("{") != css.count("}"):
    raise SystemExit("ERROR: CSS braces unbalanced after rollback")
print("Rollback CSS verification: OK (42 desktop / 46 mobile restored)")
PY
}

sync_preflight() {
  git fetch origin "$BRANCH" --quiet

  if ! git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
    echo "ERROR: origin/$BRANCH does not exist"
    exit 1
  fi

  read -r BEHIND AHEAD < <(git rev-list --left-right --count "origin/$BRANCH...HEAD")
  if [ "$BEHIND" != "0" ] || [ "$AHEAD" != "0" ]; then
    echo "ERROR: local $BRANCH is not exactly synced with origin/$BRANCH"
    echo "behind=$BEHIND ahead=$AHEAD"
    exit 1
  fi

  if ! git diff --cached --quiet; then
    echo "ERROR: staged changes already exist."
    git status --short
    exit 1
  fi

  for f in "${TARGET_FILES[@]}"; do
    if ! git diff --quiet -- "$f"; then
      echo "ERROR: target file already has local changes: $f"
      echo "Patch stopped to avoid mixing styles."
      exit 1
    fi
  done
}

case "$MODE" in
  --check)
    echo "=========================================="
    echo "MEMEFLOW V143 TOKEN AVATAR 70% — CHECK"
    echo "=========================================="
    echo "Project: $PROJECT_DIR"
    echo "Branch : $BRANCH"
    echo "Origin : $ORIGIN"
    read_only_contract_check
    echo
    echo "Planned change:"
    echo "  Desktop main token avatar: 42px -> 29px"
    echo "  Mobile  main token avatar: 46px -> 32px"
    echo "  Pump.fun green badge      : stays 16px"
    echo "  Rows/cards/layout/text    : unchanged"
    echo "  Files changed on apply    :"
    printf '    %s\n' "${TARGET_FILES[@]}"
    exit 0
    ;;

  --apply)
    ;;

  --rollback)
    echo "=========================================="
    echo "MEMEFLOW V143 TOKEN AVATAR — ROLLBACK"
    echo "=========================================="

    sync_preflight

    META="$(find .memeflow-backups -maxdepth 2 -type f -name 'rollback.env' -path '*token-avatar-v143-*' 2>/dev/null | sort | tail -n 1 || true)"
    [ -n "$META" ] || {
      echo "ERROR: V143 rollback metadata not found under .memeflow-backups"
      exit 1
    }

    # shellcheck disable=SC1090
    source "$META"

    [ "${PATCH_BRANCH:-}" = "$BRANCH" ] || {
      echo "ERROR: V143 was installed on branch ${PATCH_BRANCH:-unknown}, current branch is $BRANCH"
      exit 1
    }
    [ -n "${PATCH_COMMIT:-}" ] || { echo "ERROR: PATCH_COMMIT missing in $META"; exit 1; }

    if ! git cat-file -e "$PATCH_COMMIT^{commit}" 2>/dev/null; then
      echo "ERROR: patch commit not found: $PATCH_COMMIT"
      exit 1
    fi

    if ! git merge-base --is-ancestor "$PATCH_COMMIT" HEAD; then
      echo "ERROR: patch commit $PATCH_COMMIT is not an ancestor of current HEAD"
      exit 1
    fi

    STAMP="$(date +%Y%m%d-%H%M%S)"
    PRE_ROLLBACK_BRANCH="backup/pre-rollback-token-avatar-v143-$STAMP"
    git branch "$PRE_ROLLBACK_BRANCH" HEAD
    git push origin "$PRE_ROLLBACK_BRANCH"

    echo "Creating revert commit for $PATCH_COMMIT ..."
    if ! git revert --no-edit "$PATCH_COMMIT"; then
      git revert --abort >/dev/null 2>&1 || true
      echo "ERROR: rollback produced a conflict. Revert aborted; project left unchanged."
      exit 1
    fi

    rollback_contract_verify
    git diff --check HEAD^ HEAD -- "${TARGET_FILES[@]}"

    ROLLBACK_COMMIT="$(git rev-parse HEAD)"
    if ! git push origin "HEAD:$BRANCH"; then
      echo "ERROR: rollback commit exists locally but push failed."
      echo "Local rollback commit: $ROLLBACK_COMMIT"
      echo "Remote backup branch: $PRE_ROLLBACK_BRANCH"
      exit 1
    fi

    echo
    echo "=========================================="
    echo "V143 ROLLBACK + PUSH OK"
    echo "=========================================="
    echo "Branch          : $BRANCH"
    echo "Reverted patch  : $PATCH_COMMIT"
    echo "Rollback commit : $ROLLBACK_COMMIT"
    echo "Safety branch   : $PRE_ROLLBACK_BRANCH"
    echo "Avatar sizes    : 42px desktop / 46px mobile restored"
    exit 0
    ;;

  *)
    echo "Usage:"
    echo "  bash $0 --check"
    echo "  bash $0 --apply"
    echo "  bash $0 --rollback"
    exit 2
    ;;
esac

echo "=========================================="
echo "MEMEFLOW V143 TOKEN AVATAR 70% — APPLY"
echo "=========================================="
echo "Project: $PROJECT_DIR"
echo "Branch : $BRANCH"
echo "Origin : $ORIGIN"

read_only_contract_check
sync_preflight

# If V143 dimensions are already present, stop rather than create a no-op commit.
python3 - "$CSS" <<'PY'
from pathlib import Path
import sys
css = Path(sys.argv[1]).read_text(encoding="utf-8")
start = css.index("TRADING PUMPFUN AVATAR LINK V76")
end = css.index("/* MEMEFLOW_TRADING_VISUAL_HIERARCHY_V76_END */", start)
block = css[start:end]
if (
    block.count("width: 29px !important;") == 2
    and block.count("height: 29px !important;") == 2
    and block.count("width: 32px !important;") == 1
    and block.count("height: 32px !important;") == 1
):
    raise SystemExit("ERROR: V143 avatar dimensions are already applied; refusing duplicate patch")
PY

REMOTE_BEFORE="$(git rev-parse "origin/$BRANCH")"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".memeflow-backups/token-avatar-v143-$STAMP"
BACKUP_BRANCH="backup/token-avatar-v143-$STAMP"
mkdir -p "$BACKUP_DIR"

for f in "${TARGET_FILES[@]}"; do
  mkdir -p "$BACKUP_DIR/$(dirname "$f")"
  cp "$f" "$BACKUP_DIR/$f"
done

cat > "$BACKUP_DIR/prechange.env" <<META
PRECHANGE_COMMIT=$REMOTE_BEFORE
PATCH_BRANCH=$BRANCH
BACKUP_BRANCH=$BACKUP_BRANCH
META

# Create a remote safety branch pointing at the exact pre-change commit.
if git show-ref --verify --quiet "refs/heads/$BACKUP_BRANCH"; then
  echo "ERROR: local backup branch already exists: $BACKUP_BRANCH"
  exit 1
fi
if git ls-remote --exit-code --heads origin "$BACKUP_BRANCH" >/dev/null 2>&1; then
  echo "ERROR: remote backup branch already exists: $BACKUP_BRANCH"
  exit 1
fi

git branch "$BACKUP_BRANCH" "$REMOTE_BEFORE"
git push origin "$BACKUP_BRANCH"

COMMITTED=0
restore_on_error() {
  rc=$?
  if [ "$rc" -ne 0 ] && [ "$COMMITTED" -eq 0 ]; then
    echo
    echo "V143 failed before commit. Restoring target files from backup..."
    for f in "${TARGET_FILES[@]}"; do
      cp "$BACKUP_DIR/$f" "$f"
    done
    git reset -- "${TARGET_FILES[@]}" >/dev/null 2>&1 || true
    echo "Restored target files."
    echo "Backup directory: $BACKUP_DIR"
    echo "Remote backup branch remains available: $BACKUP_BRANCH"
  fi
  exit "$rc"
}
trap restore_on_error EXIT

python3 - "$CSS" "$HTML" <<'PY'
from pathlib import Path
import re
import sys

css_path = Path(sys.argv[1])
html_path = Path(sys.argv[2])
css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

start_marker = "TRADING PUMPFUN AVATAR LINK V76"
end_marker = "/* MEMEFLOW_TRADING_VISUAL_HIERARCHY_V76_END */"
start = css.index(start_marker)
end = css.index(end_marker, start) + len(end_marker)
block = css[start:end]

expected = {
    "width: 42px !important;": 2,
    "height: 42px !important;": 2,
    "width: 46px !important;": 1,
    "height: 46px !important;": 1,
}
for token, count in expected.items():
    actual = block.count(token)
    if actual != count:
        raise SystemExit(f"ERROR: expected {count}x {token!r} inside V76, found {actual}")

# Edit the canonical existing owner instead of adding another CSS override.
block = block.replace("width: 42px !important;", "width: 29px !important;")
block = block.replace("height: 42px !important;", "height: 29px !important;")
block = block.replace("width: 46px !important;", "width: 32px !important;")
block = block.replace("height: 46px !important;", "height: 32px !important;")

css = css[:start] + block + css[end:]

pattern = re.compile(r'href="/trading-visual-hierarchy-v67\.css\?v=([^"]+)"')
matches = list(pattern.finditer(html))
if len(matches) != 1:
    raise SystemExit(f"ERROR: expected one visual CSS link in trading.html, found {len(matches)}")
html = pattern.sub('href="/trading-visual-hierarchy-v67.css?v=token-avatar-70-v143-20260908"', html, count=1)

css_path.write_text(css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")
print("V143 canonical avatar owner updated; no duplicate override added.")
PY

post_patch_verify

if command -v node >/dev/null 2>&1; then
  node --check "$JS"
else
  echo "ERROR: node is required for trading.js syntax verification"
  exit 1
fi

if [ -f "memeflow-app/tests/terminal-watch-merge-v37.mjs" ]; then
  echo
  echo "Running Trading regression test..."
  (
    cd memeflow-app
    node tests/terminal-watch-merge-v37.mjs
  )
fi

git diff --check -- "${TARGET_FILES[@]}"

# Confirm only the intended files are staged by this patch.
git add -- "${TARGET_FILES[@]}"
git diff --cached --check -- "${TARGET_FILES[@]}"

STAGED_FILES="$(git diff --cached --name-only)"
EXPECTED_STAGED="$(printf '%s\n' "${TARGET_FILES[@]}" | sort)"
ACTUAL_STAGED="$(printf '%s\n' "$STAGED_FILES" | sort)"
if [ "$ACTUAL_STAGED" != "$EXPECTED_STAGED" ]; then
  echo "ERROR: staged file set is not exactly the V143 target set"
  echo "Expected:"
  printf '%s\n' "$EXPECTED_STAGED"
  echo "Actual:"
  printf '%s\n' "$ACTUAL_STAGED"
  exit 1
fi

echo
echo "=========================================="
echo "V143 TARGET DIFF"
echo "=========================================="
git diff --cached --stat

git fetch origin "$BRANCH" --quiet
REMOTE_AFTER="$(git rev-parse "origin/$BRANCH")"
if [ "$REMOTE_AFTER" != "$REMOTE_BEFORE" ]; then
  echo "ERROR: origin/$BRANCH changed while V143 was prepared."
  echo "Nothing committed and nothing pushed to $BRANCH."
  exit 1
fi

git commit -m "style(trading): reduce module token avatars by 30 percent"
COMMITTED=1
PATCH_COMMIT="$(git rev-parse HEAD)"

cat > "$BACKUP_DIR/rollback.env" <<META
PATCH_COMMIT=$PATCH_COMMIT
PRECHANGE_COMMIT=$REMOTE_BEFORE
PATCH_BRANCH=$BRANCH
BACKUP_BRANCH=$BACKUP_BRANCH
BACKUP_DIR=$BACKUP_DIR
META

if ! git push origin "HEAD:$BRANCH"; then
  echo
  echo "ERROR: V143 commit exists locally but push failed."
  echo "Patch commit : $PATCH_COMMIT"
  echo "Backup branch: $BACKUP_BRANCH"
  echo "Main branch on origin was not force-updated."
  exit 1
fi

trap - EXIT

echo
echo "=========================================="
echo "V143 INSTALL + VERIFY + PUSH OK"
echo "=========================================="
echo "Branch        : $BRANCH"
echo "Commit        : $PATCH_COMMIT"
echo "Backup dir    : $BACKUP_DIR"
echo "Backup branch : $BACKUP_BRANCH"
echo "Desktop avatar: 29px (was 42px)"
echo "Mobile avatar : 32px (was 46px)"
echo "Pump badge    : unchanged 16px"
echo
echo "Rollback if you do not like it:"
echo "  bash $0 --rollback"
